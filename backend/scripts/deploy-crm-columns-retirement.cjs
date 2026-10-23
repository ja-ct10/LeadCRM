'use strict';
// One explicitly bounded cutover. Normal startup still defers every retirement.
const { readdirSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const rollout = require('./deploy-crm-imports.cjs');
const accounts = require('./deploy-account-columns-retirement.cjs');
const { verifyLeadRelease } = require('./deploy-lead-fields.cjs');
const { verifyContactRelease } = require('./deploy-contact-retirement.cjs');
const root = resolve(__dirname, '../prisma/migrations');
const retirements = [
  ['20261110000000_retire_unused_crm_columns', { Contact: ['lastContactedAt','qualifiedAt','disqualifiedReason'], Deal: ['billingFrequency'] }],
  ['20261112000000_retire_lead_nonform_columns', { Lead: ['description','website','productInterestOther'] }],
  ['20261129000000_retire_contact_obsolete_columns', { Contact: ['customerType','recordType','score','linkedinUrl','activeProducts'] }],
  ['20261130000000_remove_contact_job_title', { Contact: ['jobTitle'] }],
  ['20261210000000_retire_account_internal_notes', { Account: ['internalNotes'] }],
  ['20261227000000_retire_account_notes_and_tags', { Account: ['tags'] }],
];
const prerequisites = ['20261110000000_preserve_retired_lead_fields','20261128000000_preserve_contact_retirement_history','20261209000000_account_notes_preservation'];
const fields = Object.fromEntries(['Contact','Deal','Lead','Account'].map(table => [table, retirements.flatMap(([, scope]) => scope[table] || [])]));
const names = retirements.map(([name]) => name);
const completed = row => row.finished_at && !row.rolled_back_at;
const fail = (code, details) => { throw Object.assign(new Error(code), { code, details }); };
const quote = value => '"' + value.replaceAll('"','""') + '"';
const literal = value => value == null ? 'NULL' : "'" + value.replaceAll("'","''") + "'";
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function passiveFetch(url, options, fetcher = fetch) {
  for (let attempt=0;;attempt++) {
    const response = await fetcher(url,options);
    if (!['GET',undefined].includes(options?.method) || ![500,503].includes(response.status) || attempt===4) return response;
    await response.arrayBuffer?.();
    // Only passive reads can reconnect after the planned pool drain. Prisma
    // migration execution and preservation mutations are never retried here.
    await new Promise(done=>setTimeout(done,200));
  }
}

function environment(env) {
  const mapped = { ...env };
  for (const key of ['EXPECT_DATABASE','VERIFY_COMMIT','VERIFY_TOKEN','VERIFY_API','VERIFY_FRONTEND','PRODUCTION_APPROVAL','BACKUP_VERIFIED','FRONTEND_VERIFIED','WRITERS_STOPPED']) mapped['CRM_ACCOUNT_COLUMNS_' + key] = env['CRM_COLUMNS_' + key];
  return mapped;
}
function plan(records, local) {
  rollout.verifyAppliedHistory(records, local);
  if (records.some(row => !row.finished_at && !row.rolled_back_at)) fail('CRM_COLUMNS_FAILED_MIGRATION_REQUIRES_REVIEW');
  const pending = local.filter(name => !records.some(row => row.migration_name === name && completed(row)));
  const unexpected = pending.filter(name => !names.includes(name));
  if (unexpected.length) fail('CRM_COLUMNS_OUTSIDE_APPROVED_SCOPE', unexpected);
  if (prerequisites.some(name => !records.some(row => row.migration_name === name && completed(row)))) fail('CRM_COLUMNS_PRESERVATION_PREREQUISITE_MISSING');
  return names.filter(name => pending.includes(name));
}
async function ledger(db) {
  return db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at,checksum FROM public."_prisma_migrations"');
}
async function structure(db, records) {
  const columns = await db.$queryRawUnsafe("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('Contact','Deal','Lead','Account')");
  for (const [name, scope] of retirements) {
    const present = Object.entries(scope).flatMap(([table, keys]) => keys.filter(key => columns.some(row => row.table_name === table && row.column_name === key)));
    const expected = Object.values(scope).flat().length;
    if (records.some(row => row.migration_name === name && completed(row)) ? present.length !== 0 : present.length !== expected) fail('CRM_COLUMNS_SCHEMA_LEDGER_MISMATCH', { name, present });
  }
  if (!columns.some(row => row.table_name === 'Account' && row.column_name === 'notes')) fail('CRM_COLUMNS_ACCOUNT_NOTES_MISSING');
  return columns;
}

/** Fingerprints include all FK descendants and security/automation definitions.
 * Only the 15 approved columns are excluded. No row contents are logged. */
async function snapshot(db) {
  const tables = await db.$queryRawUnsafe(`WITH RECURSIVE affected(oid) AS (
    SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN
      ('Contact','Deal','Lead','Account','User','UserRole','Role','Permission','RolePermission','Group','UserGroup','Tenant','Workflow','WorkflowExecution','TargetAudience','TargetAudienceCondition','Campaign','Template','ClosingFieldDefinition','CustomFieldValue','TenantPreference','AuditLog','Activity')
    UNION SELECT c.conrelid FROM pg_constraint c JOIN affected a ON a.oid=c.confrelid WHERE c.contype='f'
  ) SELECT DISTINCT c.relname AS name FROM affected a JOIN pg_class c ON c.oid=a.oid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname NOT IN ('Session','_prisma_migrations') ORDER BY name`);
  const result = {};
  for (const { name } of tables) {
    const expression = `(to_jsonb(t) - ARRAY[${(fields[name] || []).map(literal).join(',')}]::text[])`;
    // Activities may receive only independently verified legacy-note additions.
    if (name === 'Activity') result[name] = await db.$queryRawUnsafe(`SELECT id,md5(${expression}::text) AS hash FROM public.${quote(name)} t ORDER BY id`);
    else {
      const [row] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(${expression}::text,'' ORDER BY ${expression}::text),'')) AS hash FROM public.${quote(name)} t`);
      result[name] = row;
    }
  }
  const history = await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='crm_history' ORDER BY tablename");
  for (const { tablename } of history) result['crm_history.' + tablename] = await db.$queryRawUnsafe(`SELECT id::text AS id,md5(to_jsonb(t)::text) AS hash FROM crm_history.${quote(tablename)} t ORDER BY id::text`);
  result.__schema = digest(await schemaSnapshot(db));
  return result;
}
async function schemaSnapshot(db) {
  const columns = (await db.$queryRawUnsafe(`SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default,identity_generation,is_generated,generation_expression
    FROM information_schema.columns WHERE table_schema IN ('public','crm_history') ORDER BY table_schema,table_name,column_name`)).filter(row => row.table_schema !== 'public' || !fields[row.table_name]?.includes(row.column_name));
  const constraints = await db.$queryRawUnsafe(`SELECT n.nspname AS schema,c.relname AS table,k.conname AS name,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','crm_history') ORDER BY 1,2,3`);
  const triggers = await db.$queryRawUnsafe(`SELECT n.nspname AS schema,c.relname AS table,t.tgname AS name,t.tgenabled AS enabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','crm_history') AND NOT t.tgisinternal AND NOT (n.nspname='public' AND ((c.relname='Lead' AND t.tgname='crm_preserve_retired_lead_fields') OR (c.relname='Account' AND t.tgname='preserve_account_note_write'))) ORDER BY 1,2,3`);
  const functions = await db.$queryRawUnsafe(`SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS args,pg_get_functiondef(p.oid) AS definition,pg_get_userbyid(p.proowner) AS owner,
    (SELECT jsonb_agg(value ORDER BY value::text) FROM (SELECT jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) AS value FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a) grants) AS grants
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','crm_history') AND p.prokind='f' AND NOT (n.nspname='public' AND p.proname='crm_preserve_retired_lead_fields') ORDER BY 1,2,3`);
  const security = await db.$queryRawUnsafe(`SELECT n.nspname AS schema,c.relname AS name,c.relkind::text AS kind,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,pg_get_userbyid(c.relowner) AS owner,
    (SELECT jsonb_agg(value ORDER BY value::text) FROM (SELECT jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) AS value FROM aclexplode(COALESCE(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a) grants) AS grants FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','crm_history') AND c.relkind IN ('r','S','v','m') ORDER BY 1,2`);
  const policies = await db.$queryRawUnsafe("SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','crm_history') ORDER BY schemaname,tablename,policyname");
  const indexes = await db.$queryRawUnsafe("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','crm_history') ORDER BY schemaname,tablename,indexname");
  const roles = await db.$queryRawUnsafe("SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolvaliduntil::text FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname");
  const memberships = await db.$queryRawUnsafe("SELECT pg_get_userbyid(roleid) AS role,pg_get_userbyid(member) AS member,pg_get_userbyid(grantor) AS grantor,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY 1,2,3");
  return { columns, constraints, triggers, functions, security, policies, indexes, roles, memberships };
}
async function compareSnapshot(db, before, after, allowPreservation = false) {
  if (Object.keys(before).join() !== Object.keys(after).join()) fail('CRM_COLUMNS_RETAINED_TABLES_CHANGED');
  for (const [name, expected] of Object.entries(before)) {
    const actual = after[name];
    if (allowPreservation && (name.startsWith('crm_history.') || name === 'Activity')) {
      if (expected.some(row => !actual.some(next => next.id === row.id && next.hash === row.hash))) fail('CRM_COLUMNS_HISTORICAL_ROWS_CHANGED', name);
      const additions = actual.filter(row => !expected.some(old => old.id === row.id));
      if (name === 'Activity' && additions.length) {
        const rows = await db.$queryRawUnsafe(`SELECT a.id FROM public."Activity" a JOIN crm_history.account_legacy_notes h ON h.activity_id=a.id
          WHERE a.id=ANY($1::text[]) AND a."tenantId"=h.tenant_id AND a.type='note' AND a.description=h.note_value
          AND a.metadata->>'legacyAccountNote'='v1' AND a.metadata->>'sourceAccountId'=h.account_id
          AND crm_history.account_note_destination(h.tenant_id,h.account_id,a."accountId")`, additions.map(row => row.id));
        if (rows.length !== additions.length) fail('CRM_COLUMNS_UNEXPECTED_ACTIVITY_ADDITIONS');
      }
    } else if (digest(expected) !== digest(actual)) fail('CRM_COLUMNS_RETAINED_VALUES_CHANGED', name);
  }
}

const aliases = { contact: new Set([...fields.Contact,'linkedin','activeProductIds']), lead: new Set(fields.Lead), deal: new Set(fields.Deal), account: new Set(fields.Account) };
function retiredField(field, entity) {
  if (typeof field !== 'string') return false;
  const parts = field.split('.');
  const qualified = parts[0].replace(/s$/, '');
  if (aliases[qualified] && parts.length === 2) return aliases[qualified].has(parts[1]);
  return aliases[entity]?.has(parts[0] === 'record' ? parts[1] : field) || false;
}
function references(payload, entity) {
  const found = new Set();
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (retiredField(node.field, entity)) found.add(node.field);
    for (const key of node.field === 'event.changedFields' ? [node.value, node.changedFields] : [node.changedFields]) {
      for (const field of Array.isArray(key) ? key : [key]) if (retiredField(field, entity)) found.add(field);
    }
    for (const [key, value] of Object.entries(node)) {
      if (['subject','body','message','content','title','description'].includes(key) && typeof value === 'string') {
        for (const token of value.matchAll(/{{\s*([\w.]+)\s*}}/g)) if (retiredField(token[1], entity)) found.add(token[1]);
      }
      visit(value);
    }
  };
  visit(payload);
  return [...found];
}
async function audit(db) {
  const hidden = await db.$queryRawUnsafe("SELECT n.nspname AS schema,c.relname AS table FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','crm_history') AND c.relkind='r' AND row_security_active(c.oid)");
  if (hidden.length) fail('CRM_COLUMNS_OPERATOR_RLS_SCOPE_REQUIRES_REVIEW',hidden);
  const templates = await db.$queryRawUnsafe('SELECT id,"tenantId",subject,content FROM public."Template"');
  const workflows = await db.$queryRawUnsafe('SELECT id,"tenantId",trigger,conditions,actions,"isActive",status,"isArchived" FROM public."Workflow"');
  const blockers = [];
  for (const w of workflows) {
    if (!(w.isActive || w.status === 'ACTIVE')) continue;
    const entity = w.trigger.split('.')[0];
    const hits = references(w.conditions, entity);
    const actions = Array.isArray(w.actions) ? w.actions : [];
    for (const action of actions) {
      // Qualified selectors retain their entity; SMS content uses its recipient.
      const target = action.type === 'send_sms' && ['deal','account'].includes(entity) && action.config?.recipient
        ? action.config.recipient === 'primary_lead' ? 'lead' : 'contact' : entity;
      const config = { ...action.config };
      const template = templates.find(t => t.id === config.templateId && t.tenantId === w.tenantId);
      if (template) Object.assign(config, { templateSubject: undefined, subject: config.subject || template.subject, body: config.body || template.content });
      hits.push(...references({ ...action, config: { ...config, subject: undefined, body: undefined, message: undefined } }, entity));
      hits.push(...references({ subject: config.subject, body: config.body, message: config.message }, target));
    }
    if (hits.length) blockers.push({ kind: 'Workflow', id: w.id, fields: [...new Set(hits)] });
  }
  const audiences = await db.$queryRawUnsafe('SELECT a.id,a.source,c.field FROM public."TargetAudience" a JOIN public."TargetAudienceCondition" c ON c."targetAudienceId"=a.id WHERE a."isActive"');
  for (const row of audiences) if (retiredField(row.field, row.source === 'LEADS' ? 'lead' : 'contact')) blockers.push({ kind: 'TargetAudience', id: row.id, fields: [row.field] });
  const campaigns = await db.$queryRawUnsafe(`SELECT id,"tenantId",subject,body,"audienceSource","scheduleConfig","emailTemplateId","smsTemplateId" FROM public."Campaign" WHERE NOT "isArchived" AND status::text IN ('SCHEDULED','SENDING','INTERRUPTED')`);
  for (const c of campaigns) {
    const entity = (c.scheduleConfig?.source || c.audienceSource) === 'LEADS' ? 'lead' : 'contact';
    const messages = templates.filter(t => t.tenantId === c.tenantId && [c.emailTemplateId,c.smsTemplateId].includes(t.id));
    const hits = references([c.scheduleConfig,{ subject: c.subject, body: c.body },...messages], entity);
    if (hits.length) blockers.push({ kind: 'Campaign', id: c.id, fields: hits });
  }
  const dependencies = await db.$queryRawUnsafe(`SELECT c.relname AS table,a.attname AS column,pg_describe_object(d.classid,d.objid,d.objsubid) AS dependency,
    t.tgname AS trigger,p.proname AS function,pn.nspname AS function_schema
    FROM pg_depend d JOIN pg_class c ON c.oid=d.refobjid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.refobjsubid
    LEFT JOIN pg_trigger t ON d.classid='pg_trigger'::regclass AND t.oid=d.objid LEFT JOIN pg_proc p ON p.oid=t.tgfoid LEFT JOIN pg_namespace pn ON pn.oid=p.pronamespace
    WHERE n.nspname='public' AND d.classid<>'pg_attrdef'::regclass AND NOT a.attisdropped`);
  for (const d of dependencies) {
    const migrationOwned = d.table === 'Lead' && fields.Lead.includes(d.column) && d.trigger === 'crm_preserve_retired_lead_fields' && d.function === 'crm_preserve_retired_lead_fields' && d.function_schema === 'public'
      || d.table === 'Account' && d.column === 'internalNotes' && d.trigger === 'preserve_account_note_write' && d.function === 'preserve_account_note_write' && d.function_schema === 'crm_history';
    if (fields[d.table]?.includes(d.column) && !migrationOwned) blockers.push({ kind: 'DatabaseDependency', ...d });
  }
  // The immutable Account migration invokes a reconciler which also changes old
  // layouts/workflow state. Require that every such mutation is already a no-op.
  const sideEffects = await db.$queryRawUnsafe(`SELECT 'Workflow' AS kind,id FROM public."Workflow" w WHERE ("isActive" OR status<>'PAUSED') AND crm_history.account_notes_workflow_references(w.trigger,w.conditions,w.actions,w."tenantId")
    UNION ALL SELECT 'ClosingFieldDefinition',id FROM public."ClosingFieldDefinition" WHERE definition->>'module'='accounts' AND (definition->>'groupId'='accounts:section:4' OR nullif(definition->>'groupId','') IS NULL AND definition->>'group'='Notes')
    UNION ALL SELECT 'TenantPreference',id FROM public."TenantPreference" WHERE module='accounts' AND key='field-layout' AND value IS DISTINCT FROM crm_history.normalize_account_notes_layout(value)`);
  blockers.push(...sideEffects.map(row => ({ ...row, reason: 'ACCOUNT_RECONCILIATION_WOULD_CHANGE_DEFINITION' })));
  if (blockers.length) fail('CRM_COLUMNS_DEPENDENCIES_REQUIRE_REPAIR', blockers);
  // JSON projection works before and after any of the six retirements.
  const [values] = await db.$queryRawUnsafe(`SELECT
    (SELECT count(*)::int FROM public."Contact" c WHERE EXISTS (SELECT 1 FROM jsonb_each(to_jsonb(c)) f WHERE f.key IN ('lastContactedAt','qualifiedAt','disqualifiedReason') AND f.value<>'null'::jsonb)) AS contacts,
    (SELECT count(*)::int FROM public."Deal" d WHERE to_jsonb(d)->'billingFrequency'<>'null'::jsonb) AS deals,
    (SELECT count(*)::int FROM public."Account" a WHERE jsonb_array_length(COALESCE(NULLIF(to_jsonb(a)->'tags','null'::jsonb),'[]'::jsonb))>0) AS tags`);
  if (values.contacts || values.deals || values.tags) fail('CRM_COLUMNS_IMMUTABLE_VALUE_GUARD_BLOCKED', values);
  return { workflows: workflows.length, templates: templates.length, activeAudiences: audiences.length, pendingCampaigns: campaigns.length, blockers: 0 };
}

async function preserveContacts(db, columns) {
  if (columns.some(c => c.table_name === 'Contact' && fields.Contact.includes(c.column_name) && c.column_name !== 'jobTitle')) await db.$executeRawUnsafe('SELECT crm_history.capture_contact_retirement()');
  // Independent versions keep the five-column contract migration's exact JSON
  // guard intact. Include null job titles too; never rewrite old snapshots.
  for (const keys of [fields.Contact.filter(k => k !== 'jobTitle'), ['jobTitle']]) {
    const present = keys.filter(key => columns.some(c => c.table_name === 'Contact' && c.column_name === key));
    if (!present.length) continue;
    await db.$executeRawUnsafe(`INSERT INTO crm_history.contact_retired_values(tenant_id,contact_id,source_updated_at,was_archived,retired_values,product_links,contact_deals)
      SELECT c."tenantId",c.id,c."updatedAt",c."isArchived",v.value,p.value,d.value FROM public."Contact" c
      CROSS JOIN LATERAL(SELECT jsonb_object_agg(key,value) AS value FROM jsonb_each(to_jsonb(c)) WHERE key=ANY(ARRAY[${present.map(literal).join(',')}]::text[])) v
      CROSS JOIN LATERAL(SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l."productInterestId"),'[]'::jsonb) AS value FROM public."ContactProductInterest" l WHERE l."contactId"=c.id AND l."tenantId"=c."tenantId") p
      CROSS JOIN LATERAL(SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l."dealId"),'[]'::jsonb) AS value FROM public."ContactDeal" l WHERE l."contactId"=c.id AND l."tenantId"=c."tenantId") d
      WHERE NOT EXISTS(SELECT 1 FROM crm_history.contact_retired_values h WHERE h.tenant_id=c."tenantId" AND h.contact_id=c.id AND h.source_updated_at=c."updatedAt" AND h.was_archived=c."isArchived" AND h.retired_values=v.value AND h.product_links=p.value AND h.contact_deals=d.value)`);
  }
}
async function retiredValues(db) {
  const result = {};
  for (const [table, keys] of Object.entries(fields)) result[table] = await db.$queryRawUnsafe(`SELECT t.id,t."tenantId" AS tenant_id,(SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(to_jsonb(t)) WHERE key=ANY(ARRAY[${keys.map(literal).join(',')}]::text[])) AS values${table === 'Contact' ? `,
    t."updatedAt" AS source_updated_at,t."isArchived" AS was_archived,
    (SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l."productInterestId"),'[]'::jsonb) FROM public."ContactProductInterest" l WHERE l."contactId"=t.id AND l."tenantId"=t."tenantId") AS product_links,
    (SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l."dealId"),'[]'::jsonb) FROM public."ContactDeal" l WHERE l."contactId"=t.id AND l."tenantId"=t."tenantId") AS contact_deals` : ''} FROM public.${quote(table)} t ORDER BY t.id`);
  return result;
}
async function verifyArchives(db, expected) {
  const contacts = await db.$queryRawUnsafe('SELECT tenant_id,contact_id,retired_values,source_updated_at,was_archived,product_links,contact_deals FROM crm_history.contact_retired_values');
  const leads = await db.$queryRawUnsafe(`SELECT "tenantId" AS tenant_id,"leadId" AS lead_id,"fieldId" AS field_id,value FROM public."CustomFieldValue" WHERE module='leads' AND "fieldId" IN ('retired-lead-description','retired-lead-website','retired-lead-productInterestOther')`);
  const notes = await db.$queryRawUnsafe('SELECT tenant_id,account_id,source_field,note_value FROM crm_history.account_legacy_notes');
  for (const row of expected.Contact) for (const keys of [Object.keys(row.values).filter(key => key !== 'jobTitle'),Object.hasOwn(row.values,'jobTitle') ? ['jobTitle'] : []]) {
    if (keys.length && !contacts.some(h => h.tenant_id === row.tenant_id && h.contact_id === row.id && h.was_archived === row.was_archived && +h.source_updated_at === +row.source_updated_at
      && digest(h.product_links) === digest(row.product_links) && digest(h.contact_deals) === digest(row.contact_deals)
      && keys.every(key => Object.hasOwn(h.retired_values,key) && digest(h.retired_values[key]) === digest(row.values[key])))) fail('CRM_COLUMNS_CONTACT_ARCHIVE_MISMATCH', { id:row.id, keys });
  }
  for (const row of expected.Lead) for (const [key,value] of Object.entries(row.values)) if (value !== null && !leads.some(h => h.tenant_id === row.tenant_id && h.lead_id === row.id && h.field_id === 'retired-lead-' + key && h.value === value)) fail('CRM_COLUMNS_LEAD_ARCHIVE_MISMATCH', { id: row.id, key });
  for (const row of expected.Account) if (row.values.internalNotes != null && !notes.some(h => h.tenant_id === row.tenant_id && h.account_id === row.id && h.source_field === 'internalNotes' && h.note_value === row.values.internalNotes)) fail('CRM_COLUMNS_ACCOUNT_ARCHIVE_MISMATCH', row.id);
}

async function verifyRelease(env, fetcher = fetch) {
  const sha = env.CRM_COLUMNS_VERIFY_COMMIT;
  const mapped = environment(env);
  const passive = (url, options) => passiveFetch(url, { ...options, headers: { ...options?.headers, 'x-leadcrm-passive': '1' } },fetcher);
  const actor = await accounts.verifyRelease(mapped, passive);
  const healthResponse = await passive(env.CRM_COLUMNS_VERIFY_API.replace(/\/$/,'') + '/health', { redirect:'error', signal:AbortSignal.timeout(20000) });
  if (!healthResponse.ok || !(await healthResponse.json()).capabilities?.includes('crm-columns-retirement-v1')) fail('CRM_COLUMNS_OPERATOR_RELEASE_NOT_SERVING');
  const source = env.SOURCE_COMMIT || spawnSync('git',['rev-parse','HEAD'],{cwd:resolve(__dirname,'../..'),encoding:'utf8',windowsHide:true}).stdout?.trim();
  if (source !== sha) fail('CRM_COLUMNS_LOCAL_RELEASE_MISMATCH');
  const config = { api: env.CRM_COLUMNS_VERIFY_API, commit: sha, token: env.CRM_COLUMNS_VERIFY_TOKEN };
  const contact = await verifyContactRelease(config, passive);
  const lead = await verifyLeadRelease(config, passive);
  if ([contact,lead].some(row => row.userId !== actor.userId || row.tenantId !== actor.tenantId)) fail('CRM_COLUMNS_ACTOR_MISMATCH');
  for (const [module, table] of [['contacts','Contact'],['deals','Deal']]) {
    const response = await passive(config.api.replace(/\/$/,'') + `/crm/${module}?limit=100`, { headers: { Authorization: `Bearer ${config.token}`, Cookie: `leadcrm_token=${config.token}` }, redirect:'error', signal:AbortSignal.timeout(20000) });
    if (!response.ok) fail('CRM_COLUMNS_API_CHECK_FAILED');
    const data = (await response.json()).data;
    if (!Array.isArray(data) || data.some(row => fields[table].some(key => Object.hasOwn(row,key)))) fail('CRM_COLUMNS_PUBLIC_CONTRACT_INVALID');
  }
  return actor;
}
function deadline(env, reserve = 90000) {
  const until = Date.parse(env.CRM_COLUMNS_DEADLINE);
  if (!Number.isFinite(until) || until - Date.now() < reserve || until - Date.now() > 600000) fail('CRM_COLUMNS_MAINTENANCE_DEADLINE_REQUIRED');
  return until;
}
async function writeFence(env, clientFactory) {
  const runtime = clientFactory(env.DATABASE_URL);
  try {
    const [row] = await runtime.$queryRawUnsafe("SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS readonly");
    if (row.database !== env.CRM_COLUMNS_EXPECT_DATABASE || row.readonly !== 'on') fail('APPLICATION_WRITES_NOT_PAUSED');
  } finally { await runtime.$disconnect(); }
  const response = await fetch(env.CRM_COLUMNS_VERIFY_API.replace(/\/$/,'') + '/health', { redirect:'error', signal:AbortSignal.timeout(10000) });
  const health = response.ok && await response.json();
  if (health?.commit !== env.CRM_COLUMNS_VERIFY_COMMIT || !health.maintenance?.active || !health.maintenance?.drained || health.maintenance.deadline !== Date.parse(env.CRM_COLUMNS_DEADLINE)) fail('CRM_COLUMNS_WRITERS_NOT_DRAINED');
}
async function marker(db, target, value, work) {
  const column = target === 'public."Account".tags';
  const [row] = await db.$queryRawUnsafe(column ? `SELECT col_description(attrelid,attnum) AS comment FROM pg_attribute WHERE attrelid='public."Account"'::regclass AND attname='tags' AND NOT attisdropped` : `SELECT obj_description($1::regclass) AS comment`, ...column ? [] : [target]);
  if (!row) fail('CRM_COLUMNS_MARKER_TARGET_MISSING');
  const type = column ? 'COLUMN' : 'TABLE';
  await db.$executeRawUnsafe(`COMMENT ON ${type} ${target} IS ${literal(value)}`);
  try { return await work(); }
  finally {
    if (!column || (await db.$queryRawUnsafe("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' AND column_name='tags'")).length) await db.$executeRawUnsafe(`COMMENT ON ${type} ${target} IS ${literal(row.comment)}`);
  }
}
async function run(db, mode, env = process.env, dependencies = {}) {
  if (!['--plan','--verify','--retire'].includes(mode)) fail('CRM_COLUMNS_INVALID_MODE');
  accounts.connectionIdentity(environment(env));
  const local = readdirSync(root).filter(name => /^\d+_/.test(name)).sort();
  let records = await ledger(db);
  const pending = plan(records, local);
  const columns = await structure(db, records);
  const auditResult = await audit(db);
  if (mode === '--plan') return { pending, applied: records.filter(completed).length, checksums:'verified', audit:auditResult };
  const actor = await verifyRelease(env, dependencies.fetcher);
  const identity = await db.$queryRawUnsafe('SELECT id FROM public."User" WHERE id=$1 AND "tenantId"=$2 AND role=\'Client Admin\' AND status=\'ACTIVE\'', actor.userId, actor.tenantId);
  if (identity.length !== 1) fail('CRM_COLUMNS_API_DATABASE_MISMATCH');
  if (mode === '--verify') return { pending, commit:actor.commit, audit:auditResult, snapshotDigest:digest(await snapshot(db)) };
  if (!pending.length) return { commit:actor.commit, receipts:[], remaining:[], preservation:'previous cutover verified' };
  accounts.cutoverApproval(environment(env));
  const clientFactory = dependencies.clientFactory || (url => new (require('@prisma/client').PrismaClient)({datasources:{db:{url}},log:[]}));
  deadline(env);
  await (dependencies.writeFence || writeFence)(env, clientFactory);
  const evidence = JSON.parse(readFileSync(env.CRM_COLUMNS_BACKUP_EVIDENCE, 'utf8'));
  if (evidence.database !== env.CRM_COLUMNS_EXPECT_DATABASE || evidence.commit !== actor.commit || !/^[0-9a-f]{64}$/.test(evidence.backupSha256 || '') || evidence.restored !== true) fail('CRM_COLUMNS_RESTORE_EVIDENCE_REQUIRED');
  const initial = await snapshot(db);
  if (digest(initial) !== evidence.snapshotDigest) fail('CRM_COLUMNS_BACKUP_BASELINE_CHANGED');
  const expectedValues = await retiredValues(db);
  if (digest(expectedValues) !== evidence.retiredDigest) fail('CRM_COLUMNS_RETIRED_BACKUP_VALUES_CHANGED');
  const lockUrl = new URL(env.DIRECT_URL || env.DATABASE_URL);
  lockUrl.searchParams.set('connection_limit','1');
  lockUrl.searchParams.set('application_name','leadcrm_crm_columns_lock');
  const lockDb = clientFactory(lockUrl.href);
  const receipts = [];
  try {
    const [connection] = await lockDb.$queryRawUnsafe("SELECT current_setting('application_name') AS name");
    if (connection.name !== 'leadcrm_crm_columns_lock') fail('CRM_COLUMNS_OPERATOR_CONNECTION_TAG_REQUIRED');
    const locked = await lockDb.$queryRawUnsafe("SELECT pg_try_advisory_lock(hashtext('leadcrm-crm-columns-retirement')) AS locked");
    if (!locked[0]?.locked) fail('CRM_COLUMNS_CUTOVER_ALREADY_RUNNING');
    // Recheck the baseline after acquiring the exclusive operator lock too.
    if (digest(await snapshot(db)) !== evidence.snapshotDigest) fail('CRM_COLUMNS_BACKUP_BASELINE_CHANGED');
    if (digest(await retiredValues(db)) !== evidence.retiredDigest) fail('CRM_COLUMNS_RETIRED_BACKUP_VALUES_CHANGED');
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL lock_timeout=\'10s\'');
      await tx.$executeRawUnsafe('LOCK TABLE public."Contact",public."Lead",public."Account",public."ContactDeal",public."ContactProductInterest" IN SHARE ROW EXCLUSIVE MODE');
      await preserveContacts(tx, columns);
      await tx.$executeRawUnsafe('SELECT crm_history.reconcile_account_notes()');
      await verifyArchives(tx, expectedValues);
      await compareSnapshot(tx, initial, await snapshot(tx), true);
    }, { timeout:60000 });
    const retained = await snapshot(db);
    for (const [name] of retirements) {
      records = await ledger(db);
      const next = plan(records, local);
      await structure(db, records);
      if (!next.includes(name)) continue;
      deadline(env);
      await (dependencies.writeFence || writeFence)(env, clientFactory);
      await audit(db);
      const apply = async () => {
        const exclude = local.filter(candidate => candidate !== name && !records.some(row => row.migration_name === candidate && completed(row)));
        // Include all applied history, including migrations newer than this drop.
        const migrationUrl = new URL(env.DIRECT_URL || env.DATABASE_URL);
        migrationUrl.searchParams.set('application_name','leadcrm_crm_columns_migration');
        await (dependencies.migrate || rollout.migrate)(local.at(-1), exclude, { timeoutMs:60000, env:{...process.env,DIRECT_URL:migrationUrl.href} });
      };
      if (name === names[1]) await marker(db, 'public."Lead"', 'lead-form-contract-api-verified-v1', apply);
      else if (name === names[2]) await marker(db, 'crm_history.contact_retired_values', 'leadcrm-contact-retirement-compatible-v1:' + actor.commit, apply);
      else if (name === names[4]) await marker(db, 'crm_history.account_legacy_notes', 'leadcrm-account-notes-compatible-v1:' + actor.commit, apply);
      else if (name === names[5]) await marker(db, 'public."Account".tags', 'leadcrm-account-columns-v1:' + actor.commit, apply);
      else await apply();
      const after = await ledger(db);
      plan(after, local);
      await structure(db, after);
      await compareSnapshot(db, retained, await snapshot(db));
      await verifyArchives(db, expectedValues);
      const receipt = after.find(row => row.migration_name === name && completed(row));
      if (!receipt) fail('CRM_COLUMNS_MIGRATION_RECEIPT_MISSING', name);
      receipts.push({ migration:name, checksum:receipt.checksum, finishedAt:receipt.finished_at });
      console.log(JSON.stringify({ migration:name, status:'PASS', checksum:receipt.checksum }));
    }
    const remaining = plan(await ledger(db), local);
    if (remaining.length) fail('CRM_COLUMNS_RETIREMENTS_REMAIN_PENDING', remaining);
    return { commit:actor.commit, receipts, remaining, preservation:'verified', snapshotDigest:digest(retained) };
  } finally {
    try { await lockDb.$queryRawUnsafe("SELECT pg_advisory_unlock(hashtext('leadcrm-crm-columns-retirement'))"); }
    finally { await lockDb.$disconnect(); }
  }
}
module.exports = { run, plan, structure, snapshot, schemaSnapshot, compareSnapshot, audit, references, retiredField, preserveContacts, verifyArchives, retiredValues, verifyRelease, passiveFetch, writeFence, deadline, retirements, fields, digest };
if (require.main === module) {
  require('dotenv').config({quiet:true});
  const { PrismaClient } = require('@prisma/client');
  const direct = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL);
  direct.searchParams.set('application_name','leadcrm_crm_columns_operator');
  const db = new PrismaClient({datasources:{db:{url:direct.href}},log:[]});
  run(db,process.argv[2]).then(report => console.log(JSON.stringify(report,null,2))).catch(error => {
    console.error('[crm-columns-retirement]',error.code || error.name,JSON.stringify(error.details || null)); process.exitCode=1;
  }).finally(() => db.$disconnect());
}
