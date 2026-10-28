// Read-only operator inventory. This script deliberately has no deletion mode.
const { PrismaClient } = require('@prisma/client');
const archiveStates = {
  Lead: '"isArchived"', Contact: '"isArchived"', Account: '"isArchived"', Deal: '"isArchived"',
  Task: '"isArchived"', Campaign: '"isArchived"', Workflow: '"isArchived"', Pipeline: '"isArchived"',
  Template: '"isArchived"', MarketingForm: '"isArchived"', RoleDefinition: '"isArchived"',
  ProductInterest: 'NOT "active"', User: '"status" = \'INACTIVE\'',
};
const retained = /^(Activity|AuditLog|DealStageHistory|MailboxMessage|MailboxSendReceipt|EmailDeliveryLog|EmailEvent|SmsDeliveryLog|SmsInboundReceipt|CampaignContact|CampaignRecipientAttempt|WorkflowTriggerRecord|WorkflowExecutionRun|WorkflowExecutionStep|WorkflowPublication|CrmImportRowResult|ContactCreationReceipt|AccountCreationReceipt|DealCreationReceipt)$/;
const quote = name => '"' + name.replaceAll('"', '""') + '"';
async function inventoryArchived(db, tenantId) {
  if (!tenantId) throw Error('An explicit target tenant ID is required.');
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");
    const tenants = await tx.$queryRawUnsafe('SELECT id,name,status FROM "Tenant" ORDER BY name');
    if (!tenants.some(tenant => tenant.id === tenantId)) throw Error('Target tenant does not exist.');
    const columns = await tx.$queryRawUnsafe("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'");
    const has = (table, column) => columns.some(row => row.table_name === table && row.column_name === column);
    const fks = await tx.$queryRawUnsafe(`SELECT child.relname AS child, parent.relname AS parent, c.confdeltype::text AS rule,
      array_agg(ca.attname ORDER BY k.ord) AS "childColumns", array_agg(pa.attname ORDER BY k.ord) AS "parentColumns"
      FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_class parent ON parent.oid=c.confrelid
      JOIN pg_namespace n ON n.oid=child.relnamespace CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum,ord)
      JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=k.attnum
      JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[k.ord]
      WHERE c.contype='f' AND n.nspname='public' GROUP BY c.oid,child.relname,parent.relname,c.confdeltype ORDER BY child.relname`);
    const counts = [], records = [], anomalies = [];
    for (const [table, state] of Object.entries(archiveStates)) {
      if (!has(table, 'tenantId')) continue;
      const grouped = await tx.$queryRawUnsafe(`SELECT "tenantId",count(*) FILTER(WHERE ${state})::int AS archived,count(*) FILTER(WHERE NOT (${state}))::int AS active FROM ${quote(table)} GROUP BY "tenantId"`);
      for (const tenant of tenants) counts.push({ tenantId: tenant.id, tenant: tenant.name, module: table, archived: grouped.find(row => row.tenantId === tenant.id)?.archived ?? 0, active: grouped.find(row => row.tenantId === tenant.id)?.active ?? 0 });
      if (has(table, 'deletedAt')) anomalies.push(...(await tx.$queryRawUnsafe(`SELECT id,"tenantId" FROM ${quote(table)} WHERE "tenantId"=$1 AND "deletedAt" IS NOT NULL AND NOT (${state})`, tenantId)).map(row => ({ ...row, table, reason: 'Soft-deleted without archive flag; requires separate scope review.' })));
      const rows = await tx.$queryRawUnsafe(`SELECT id,"tenantId" FROM ${quote(table)} WHERE "tenantId"=$1 AND (${state}) ORDER BY id`, tenantId);
      for (const row of rows) {
        const record = { table, ...row, dependencies: [], blockers: [], retainedAuditIds: [] };
        for (const fk of fks.filter(fk => fk.parent === table)) {
          if (fk.parentColumns.some(column => !['id', 'tenantId'].includes(column))) { record.blockers.push('Unsupported reference: ' + fk.child); continue; }
          const selected = [...new Set(['id','tenantId','isArchived','active','status', ...fks.filter(ref => ref.child === fk.child).flatMap(ref => ref.childColumns)])].filter(column => has(fk.child, column));
          const predicate = fk.childColumns.map((column, i) => quote(column) + '=$' + (i + 1)).join(' AND ');
          const children = await tx.$queryRawUnsafe(`SELECT ${selected.map(quote).join(',')} FROM ${quote(fk.child)} WHERE ${predicate}`, ...fk.parentColumns.map(column => row[column]));
          if (!children.length) continue;
          const dependency = { table: fk.child, deleteRule: ({ a:'NO ACTION', r:'RESTRICT', c:'CASCADE', n:'SET NULL', d:'SET DEFAULT' })[fk.rule], rows: children, activeReferences: [] };
          for (const child of children) {
            if (child.tenantId && child.tenantId !== tenantId) record.blockers.push('Cross-tenant dependency: ' + fk.child);
            if ('isArchived' in child && !child.isArchived || 'active' in child && child.active || fk.child === 'User' && child.status !== 'INACTIVE') record.blockers.push('Active dependent record: ' + fk.child + ':' + child.id);
            for (const ref of fks.filter(ref => ref.child === fk.child && ref.parent !== table && archiveStates[ref.parent])) {
              const values = ref.childColumns.map(column => child[column]);
              if (values.some(value => value == null)) continue;
              const linked = await tx.$queryRawUnsafe(`SELECT id FROM ${quote(ref.parent)} WHERE ${ref.parentColumns.map((column,i) => quote(column) + '=$' + (i+1)).join(' AND ')} AND NOT (${archiveStates[ref.parent]})`, ...values);
              for (const item of linked) dependency.activeReferences.push({ table: ref.parent, id: item.id });
            }
          }
          if (dependency.activeReferences.length) record.blockers.push('Dependency links active records: ' + fk.child);
          if (retained.test(fk.child) && !['SET NULL'].includes(dependency.deleteRule)) record.blockers.push('Required retained history: ' + fk.child);
          record.dependencies.push(dependency);
        }
        if (has('AuditLog','entityId')) record.retainedAuditIds = (await tx.$queryRawUnsafe('SELECT id FROM "AuditLog" WHERE "tenantId"=$1 AND "entityId"=$2 ORDER BY id', tenantId, row.id)).map(item => item.id);
        if (table === 'ProductInterest') record.blockers.push('Product references in saved JSON/array configuration require review before deletion.');
        if (table === 'User') record.blockers.push('Inactive user identities and attribution require retention review.');
        if (table === 'RoleDefinition') record.blockers.push('Archived roles require protected-role and saved-workflow reference review.');
        record.blockers = [...new Set(record.blockers)];
        record.proposedForDeletion = record.blockers.length === 0;
        records.push(record);
      }
    }
    return { capturedAt: new Date().toISOString(), tenantId, tenants, counts, anomalies, records,
      proposedRecords: records.filter(record => record.proposedForDeletion).map(({table,id}) => ({table,id})),
      status: 'REVIEW REQUIRED: no deletion has been executed; exact dependency disposition must be confirmed.' };
  }, { maxWait: 10000, timeout: 180000 });
}
module.exports = { inventoryArchived };
if (require.main === module) {
  const db = new PrismaClient();
  inventoryArchived(db, process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.code || error.name, 'Read-only inventory failed.'); process.exitCode=1; }).finally(() => db.$disconnect());
}
