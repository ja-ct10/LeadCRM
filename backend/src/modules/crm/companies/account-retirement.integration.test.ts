import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getCrmFieldCatalog, defaultFieldLayout, hasCrmRecordAssignmentAccess, retiredAccountWorkflowReferences, upgradeAccountFieldLayout } from '@leadcrm/shared';
import { CreateCompanySchema, UpdateCompanySchema } from './companies.dto';
import { replayCrmMigrations } from '../../../../scripts/replay-crm-migrations.mjs';

const preservation = '20261207000000_account_field_preservation';
const retirement = '20261208000000_retire_account_fields';
const sql = (name: string) => readFileSync(resolve(import.meta.dirname, '../../../../prisma/migrations', name, 'migration.sql'), 'utf8');
let db: PGlite;
describe('Account field retirement', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    await replayCrmMigrations(db, { before: preservation });
    await db.exec(`
      INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('retirement-tenant','Retirement','retirement',now());
      INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('retirement-owner','retirement-tenant','owner@example.test','Old','Owner','Sales',now());
      INSERT INTO "ProductInterest" (id,"tenantId",name,"dealValue","updatedAt") VALUES ('retirement-product','retirement-tenant','Historical product',100,now());
      INSERT INTO "Account" (id,"tenantId",name,"assignedUserId","productInterests","activeProducts","productInterestOther","productsNormalized","updatedAt") VALUES ('retirement-account','retirement-tenant','Company','retirement-owner',ARRAY['Unresolved historical text'],ARRAY['Purchased'],'Historical detail',false,now());
      INSERT INTO "Account" (id,"tenantId",name,"isArchived","updatedAt") VALUES ('retirement-archived','retirement-tenant','Archived company',true,now());
      INSERT INTO "AccountProductInterest" ("accountId","tenantId","productInterestId",position,interested,"activeProduct") VALUES ('retirement-account','retirement-tenant','retirement-product',7,true,true);
      INSERT INTO "UserPreference" (id,"tenantId","userId",module,key,value,"updatedAt") VALUES
      ('retirement-columns','retirement-tenant','retirement-owner','accounts','columns','[{"id":"name","visible":true,"order":0},{"id":"assignedUser","visible":true,"order":1}]',now()),
      ('retirement-filters','retirement-tenant','retirement-owner','accounts','filters','[{"field":"assignedUserId","operator":"equals","value":"retirement-owner"}]',now());
      INSERT INTO "Workflow" (id,"tenantId",name,trigger,conditions,actions,"isActive",status,"updatedAt") VALUES
      ('retired-workflow','retirement-tenant','Account assignment','account.updated','{"operator":"AND","conditions":[{"field":"account.assignedUserId","operator":"equals","value":"retirement-owner"}]}','[]',true,'ACTIVE',now()),
      ('healthy-workflow','retirement-tenant','Contact assignment','contact.updated',null,'[{"type":"assign_owner","config":{"userId":"retirement-owner"}}]',true,'ACTIVE',now()),
      ('task-workflow','retirement-tenant','Account follow-up','account.updated',null,'[{"type":"create_task","config":{"assignedUserId":"retirement-owner","title":"Follow up"}}]',true,'ACTIVE',now());
      INSERT INTO "TenantPreference" (id,"tenantId",module,key,value,"updatedAt") VALUES ('retirement-layout','retirement-tenant','accounts','field-layout','{"version":1,"revision":3,"module":"accounts","groups":[{"id":"accounts:section:0","label":"Basic Information","order":0},{"id":"accounts:section:2","label":"Assigned Agent","order":6},{"id":"accounts:section:3","label":"Products & Interests","order":3},{"id":"accounts:section:4","label":"Notes","order":4}],"fields":{"assignedUserId":{"label":"Agent","groupId":"accounts:section:2","order":1,"visibleInForm":true,"visibleInDetails":true},"custom_note":{"label":"Custom","groupId":"accounts:section:3","order":2,"visibleInForm":true,"visibleInDetails":true}}}',now());
      INSERT INTO "ClosingFieldDefinition" (id,"tenantId",definition,"updatedAt") VALUES ('retirement-custom','retirement-tenant','{"id":"retirement-custom","name":"Custom","module":"accounts","group":"Products & Interests","groupId":"accounts:section:3","order":2,"required":true,"active":true,"visibleInForm":true,"visibleInDetails":true,"type":"Text"}',now());
      INSERT INTO "ClosingFieldDefinition" (id,"tenantId",definition,"updatedAt") VALUES ('retirement-agent-custom','retirement-tenant','{"id":"retirement-agent-custom","name":"Assignment context","module":"accounts","group":"Assigned Agent","groupId":"accounts:section:2","order":8,"required":false,"active":true,"visibleInForm":false,"visibleInDetails":true,"type":"Text"}',now());
      UPDATE "TenantPreference" SET value=jsonb_set(value,'{fields,custom_agent}','{"label":"Assignment context","groupId":"accounts:section:2","order":8,"visibleInForm":false,"visibleInDetails":true}') WHERE id='retirement-layout';
      INSERT INTO "CustomFieldValue" (id,"tenantId","fieldId",module,"accountId",value,"updatedAt") VALUES ('retirement-custom-value','retirement-tenant','retirement-custom','accounts','retirement-account','"Keep this exact value"',now());
      INSERT INTO "Template" (id,"tenantId",name,type,subject,content,"updatedAt") VALUES ('retired-account-template','retirement-tenant','Old Account template','Email','Original subject','Purchased {{account.activeProductIds}}',now());
      INSERT INTO "Workflow" (id,"tenantId",name,trigger,actions,"isActive",status,"updatedAt") VALUES
      ('retired-template-workflow','retirement-tenant','Template dependency','contact.updated','[{"type":"send_email","config":{"templateId":"retired-account-template"}}]',true,'ACTIVE',now()),
      ('sms-workflow','retirement-tenant','Contact personalization','account.updated','[{"type":"send_sms","config":{"recipient":"primary_contact","message":"{{assignedUserId}} {{productInterestIds}}"}}]',true,'ACTIVE',now());
      INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('retirement-custom-layout','Custom layout','retirement-custom-layout',now());
      INSERT INTO "TenantPreference" (id,"tenantId",module,key,value,"updatedAt") VALUES ('existing-additional-layout','retirement-custom-layout','accounts','field-layout','{"version":1,"revision":7,"module":"accounts","groups":[{"id":"accounts:section:2","label":"Previous agent section","order":2},{"id":"accounts:section:4","label":"Notes","order":4},{"id":"existing-additional","label":"Additional Information","order":5},{"id":"custom-product-section","label":"Products & Interests","order":6}],"fields":{"preserved_custom":{"label":"Context","groupId":"accounts:section:2","order":3,"visibleInForm":true,"visibleInDetails":true}}}',now());
      INSERT INTO "ClosingFieldDefinition" (id,"tenantId",definition,"updatedAt") VALUES
      ('move-into-existing','retirement-custom-layout','{"id":"move-into-existing","name":"Moved custom","module":"accounts","group":"Previous agent section","groupId":"accounts:section:2","order":3,"required":false,"active":true,"type":"Text"}',now()),
      ('retain-custom-group','retirement-custom-layout','{"id":"retain-custom-group","name":"Keep custom group","module":"accounts","group":"Products & Interests","groupId":"custom-product-section","order":4,"required":false,"active":true,"type":"Text"}',now());
    `);
  }, 120000);
  afterAll(async () => { await db?.close(); });

  it('rejects retired request fields and preserves supported Account fields', () => {
    for (const key of ['assignedUserId','productInterests','activeProducts','productInterestIds','activeProductIds','productInterestOther']) {
      expect(CreateCompanySchema.safeParse({ name: 'Company', [key]: [] }).success).toBe(false);
      expect(UpdateCompanySchema.safeParse({ [key]: [] }).success).toBe(false);
    }
    expect(CreateCompanySchema.parse({ name: 'Company', address: '42 Street', country: 'Philippines' }).address).toBe('42 Street');
    expect(getCrmFieldCatalog('accounts').map(field => field.technicalKey)).not.toContain('assignedUserId');
    expect(getCrmFieldCatalog('accounts').some(field => field.type === 'products')).toBe(false);
    expect(defaultFieldLayout('accounts').groups.find(group=>group.label==='Notes')).toBeUndefined();
  });
  it('removes ownership only for Accounts while retaining tenant and role boundaries', () => {
    const policy = { userId: 'sales', tenantId: 'tenant', assignmentRestricted: true, clientAdmin: false };
    expect(hasCrmRecordAssignmentAccess(policy, { tenantId: 'tenant' }, 'accounts')).toBe(true);
    expect(hasCrmRecordAssignmentAccess(policy, { tenantId: 'foreign' }, 'accounts')).toBe(false);
    expect(hasCrmRecordAssignmentAccess(undefined, { tenantId: 'tenant' }, 'accounts')).toBe(false);
    expect(hasCrmRecordAssignmentAccess(policy, { tenantId: 'tenant', assignedUserId: 'other' }, 'leads')).toBe(false);
  });
  it('detects Account references without confusing Task assignment or ordinary text', () => {
    expect(retiredAccountWorkflowReferences({ trigger:'account.updated',actions:[{type:'assign_owner'}] })).toEqual(['assignedUserId']);
    expect(retiredAccountWorkflowReferences({ trigger:'contact.updated',actions:[{type:'assign_owner'}] })).toEqual([]);
    expect(retiredAccountWorkflowReferences({ trigger:'account.updated',actions:[{type:'create_task',config:{assignedUserId:'user',title:'assignedUserId'}}] })).toEqual([]);
    expect(retiredAccountWorkflowReferences({ trigger:'contact.updated',actions:[{type:'send_email',config:{body:'{{account.productInterests}}'}}] })).toEqual(['account.productInterests']);
    expect(retiredAccountWorkflowReferences({ trigger:'account.updated',conditions:{conditions:[{field:'event.changedFields',value:['productInterestId']}]} })).toEqual(['productInterestId']);
    expect(retiredAccountWorkflowReferences({ trigger:'account.updated',actions:[{type:'create_task',config:{assignmentTarget:{type:'record_owner'}}}] })).toEqual(['assignedUserId']);
    expect(retiredAccountWorkflowReferences({ trigger:'contact.updated',conditions:{conditions:[{field:'event.changedFields',value:['assignedUserId']}]} })).toEqual([]);
    expect(retiredAccountWorkflowReferences({ trigger:'account.updated',actions:[{type:'send_sms',config:{recipient:'primary_contact',message:'{{assignedUserId}} {{productInterestIds}}'}}] })).toEqual([]);
    expect(retiredAccountWorkflowReferences({ trigger:'account.updated',conditions:{conditions:[{field:'account.name',value:'{{assignedUserId}}'}]} })).toEqual([]);
  });
  it('preserves populated/archived Accounts and configuration, pauses only affected workflows, and reconciles idempotently', async () => {
    await db.exec(sql(preservation));
    const values = (await db.query<{retired_values: Record<string, unknown>;product_links: Array<Record<string, unknown>>}>(`SELECT retired_values,product_links FROM crm_history.account_retired_values WHERE account_id='retirement-account'`)).rows[0];
    expect(values.retired_values).toMatchObject({assignedUserId:'retirement-owner',productInterests:['Unresolved historical text'],activeProducts:['Purchased'],productInterestOther:'Historical detail'});
    expect(values.product_links[0]).toMatchObject({position:7,interested:true,activeProduct:true});
    expect((await db.query(`SELECT * FROM crm_history.account_retired_values WHERE account_id='retirement-archived'`)).rows).toHaveLength(1);
    expect((await db.query(`SELECT id,"isActive" FROM "Workflow" ORDER BY id`)).rows).toEqual([{id:'healthy-workflow',isActive:true},{id:'retired-template-workflow',isActive:false},{id:'retired-workflow',isActive:false},{id:'sms-workflow',isActive:true},{id:'task-workflow',isActive:true}]);
    expect((await db.query<{payload:{content:string}}>(`SELECT payload FROM crm_history.account_retired_configuration WHERE source_type='Template' AND source_id='retired-account-template'`)).rows[0].payload.content).toBe('Purchased {{account.activeProductIds}}');
    expect((await db.query<{payload:{isActive:boolean}}>(`SELECT payload FROM crm_history.account_retired_configuration WHERE source_id='retired-workflow'`)).rows[0].payload.isActive).toBe(true);
    for (const id of ['retirement-columns','retirement-filters']) {
      const original = (await db.query<{value:unknown}>(`SELECT value FROM "UserPreference" WHERE id=$1`,[id])).rows[0].value;
      const preserved = (await db.query<{payload:{value:unknown}}>(`SELECT payload FROM crm_history.account_retired_configuration WHERE source_type='UserPreference' AND source_id=$1`,[id])).rows[0].payload.value;
      expect(preserved).toEqual(original);
    }
    const layout = (await db.query<{value: ReturnType<typeof defaultFieldLayout>}>(`SELECT value FROM "TenantPreference" WHERE id='retirement-layout'`)).rows[0].value;
    expect(layout.fields.assignedUserId).toBeUndefined();
    expect(layout.fields.custom_note.groupId).toBe('accounts:additional-information');
    expect(layout.fields.custom_agent).toMatchObject({ groupId:'accounts:additional-information',order:1,visibleInForm:false,visibleInDetails:true });
    expect(layout.fields.custom_note.order).toBe(0);
    const originalLayout = (await db.query<{payload:{value: typeof layout}}>(`SELECT payload FROM crm_history.account_retired_configuration WHERE source_type='TenantPreference' AND source_id='retirement-layout' ORDER BY id LIMIT 1`)).rows[0].payload.value;
    expect(upgradeAccountFieldLayout(originalLayout).fields).toEqual(layout.fields);
    const currentLayout = upgradeAccountFieldLayout(layout);
    expect(currentLayout.groups.some(group => group.id === 'accounts:section:4')).toBe(false);
    expect(upgradeAccountFieldLayout(currentLayout)).toEqual(currentLayout);
    await db.exec('SELECT crm_history.reconcile_account_fields(); SELECT crm_history.reconcile_account_fields();');
    expect((await db.query<{value:typeof layout}>(`SELECT value FROM "TenantPreference" WHERE id='retirement-layout'`)).rows[0].value).toEqual(layout);
    expect((await db.query<{definition:{groupId:string;required:boolean}}>(`SELECT definition FROM "ClosingFieldDefinition" WHERE id='retirement-custom'`)).rows[0].definition).toMatchObject({groupId:'accounts:additional-information',required:true});
    expect((await db.query<{definition:{order:number}}>(`SELECT definition FROM "ClosingFieldDefinition" WHERE "tenantId"='retirement-tenant' ORDER BY id`)).rows.map(row=>row.definition.order)).toEqual([1,0]);
    const customized = (await db.query<{value:typeof layout}>(`SELECT value FROM "TenantPreference" WHERE id='existing-additional-layout'`)).rows[0].value;
    expect(customized.fields.preserved_custom.groupId).toBe('existing-additional');
    expect(customized.groups.filter(group=>group.label==='Additional Information')).toHaveLength(1);
    expect(customized.groups.find(group=>group.label==='Notes')?.id).toBe('accounts:section:4');
    expect((await db.query<{definition:{groupId:string}}>(`SELECT definition FROM "ClosingFieldDefinition" WHERE id='move-into-existing'`)).rows[0].definition.groupId).toBe('existing-additional');
    const retained = (await db.query<{definition:import('@leadcrm/shared').ClosingField}>(`SELECT definition FROM "ClosingFieldDefinition" WHERE id='retain-custom-group'`)).rows[0].definition;
    expect(getCrmFieldCatalog('accounts',[retained],customized).find(field=>field.customFieldId===retained.id)?.groupId).toBe('custom-product-section');
    expect((await db.query<{value:string}>(`SELECT value FROM "CustomFieldValue" WHERE id='retirement-custom-value'`)).rows[0].value).toBe('Keep this exact value');
    for (const [trigger,conditions,actions,expected] of [
      ['account.updated',{conditions:[{field:'event.changedFields',value:['productInterestId']}]},[],true],
      ['contact.updated',{conditions:[{field:'event.changedFields',value:['assignedUserId']}]},[],false],
      ['account.updated',null,[{type:'create_task',config:{assignmentTarget:{type:'record_owner'}}}],true],
      ['account.updated',null,[{type:'create_task',config:{assignmentTarget:{type:'user',id:'staff'}}}],false],
      ['account.updated',null,[{type:'send_sms',config:{recipient:'primary_contact',message:'{{assignedUserId}} {{productInterestIds}}'}}],false],
      ['account.updated',{conditions:[{field:'account.name',value:'{{assignedUserId}}'}]},[],false],
    ] as const) expect((await db.query<{retired:boolean}>(`SELECT crm_history.account_workflow_references($1,$2::jsonb,$3::jsonb) AS retired`,[trigger,JSON.stringify(conditions),JSON.stringify(actions)])).rows[0].retired).toBe(expected);
    await expect(db.query(`UPDATE crm_history.account_retired_values SET retired_values='{}'`)).rejects.toThrow();
  });
  it('refuses an unverified populated cutover, then removes only the retired storage after preservation', async () => {
    await expect(db.exec(sql(retirement))).rejects.toThrow('ACCOUNT_FIELDS_VERIFIED_CUTOVER_REQUIRED');
    await db.exec('ROLLBACK');
    await db.exec(`COMMENT ON TABLE crm_history.account_retired_values IS 'leadcrm-accounts-fields-compatible-v1:${'a'.repeat(40)}'`);
    await db.exec(`CREATE VIEW public.account_retirement_dependency AS SELECT "assignedUserId" FROM public."Account";`);
    await expect(db.exec(sql(retirement))).rejects.toThrow('depend');
    await db.exec('ROLLBACK; DROP VIEW public.account_retirement_dependency;');
    await db.exec(sql(retirement));
    expect((await db.query(`SELECT * FROM information_schema.columns WHERE table_name='Account' AND column_name IN ('assignedUserId','productInterests','activeProducts','productInterestOther','productsNormalized')`)).rows).toEqual([]);
    expect((await db.query(`SELECT id FROM "Account"`)).rows).toHaveLength(2);
    expect((await db.query(`SELECT id FROM "ProductInterest"`)).rows).toHaveLength(1);
    expect((await db.query(`SELECT * FROM crm_history.account_retired_values`)).rows).toHaveLength(2);
    await db.exec(`INSERT INTO "Account" (id,"tenantId",name,"updatedAt") VALUES ('after-retirement','retirement-tenant','New company',now()); UPDATE "User" SET status='INACTIVE' WHERE id='retirement-owner';`);
    expect((await db.query(`SELECT name FROM "Account" WHERE id='after-retirement'`)).rows).toEqual([{name:'New company'}]);
  });
});
