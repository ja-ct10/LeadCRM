import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notificationTestPostgres } from './notification-test-postgres.mjs';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { inspectDealIndustry, migration } = require('./check-deal-industry-retirement.cjs');
const root = resolve(import.meta.dirname, '../..');
const sql = readFileSync(resolve(root, 'backend/prisma/migrations', migration, 'migration.sql'), 'utf8');

test('Deal Industry retirement on populated disposable native PostgreSQL', { timeout: 180000 }, async t => {
  const pg = await notificationTestPostgres();
  let db;
  try {
    const name = 'leadcrm_deal_industry_1';
    const url = await pg.database(name, { before: migration });
    db = new PrismaClient({ datasources: { db: { url } } });
    for (const suffix of ['a', 'b']) {
      const tenantId = `industry-${suffix}`;
      await db.tenant.create({ data: { id: tenantId, name: tenantId, slug: tenantId } });
      await db.account.create({ data: { id: `account-${suffix}`, tenantId, name: 'Company', industry: 'Account-only value' } });
      await db.pipeline.create({ data: { id: `pipeline-${suffix}`, tenantId, name: 'Sales' } });
      await db.stage.create({ data: { id: `stage-${suffix}`, tenantId, pipelineId: `pipeline-${suffix}`, name: 'Lead', order: 0 } });
    }
    const tenantId = 'industry-a';
    await db.user.create({ data: { id: 'industry-actor', tenantId, email: 'industry@example.test', firstName: 'Test', lastName: 'Actor', role: 'Client Admin' } });
    await db.lead.create({ data: { id: 'industry-lead', tenantId, firstName: 'Linked', lastName: 'Lead', accountId: 'account-a' } });
    await db.contact.create({ data: { id: 'industry-contact', tenantId, firstName: 'Linked', lastName: 'Contact', accountId: 'account-a' } });
    await db.productInterest.create({ data: { id: 'industry-product', tenantId, name: 'Historical uncategorized Product', dealValue: 1234 } });
    const values = ['Legacy Deal value', null, '', '  ', 'Other value', 'Third value', null];
    for (const [index, value] of values.entries()) {
      const suffix = index < 4 ? 'a' : 'b';
      await db.deal.create({ data: { id: `industry-deal-${index}`, tenantId: `industry-${suffix}`, title: `Deal ${index}`, pipelineId: `pipeline-${suffix}`, stageId: `stage-${suffix}`, accountId: `account-${suffix}`, value: 1234, ...(index === 0 ? { productInterestId: 'industry-product', productInterestIds: ['industry-product'], productInterests: ['Historical uncategorized Product'] } : {}) } });
      await db.$executeRawUnsafe('UPDATE public."Deal" SET industry = $1 WHERE id = $2', value, `industry-deal-${index}`);
    }
    await db.leadDeal.create({ data: { tenantId, leadId: 'industry-lead', dealId: 'industry-deal-0' } });
    await db.contactDeal.create({ data: { tenantId, contactId: 'industry-contact', dealId: 'industry-deal-0' } });
    await db.leadProductInterest.create({ data: { tenantId, leadId: 'industry-lead', productInterestId: 'industry-product' } });
    await db.contactProductInterest.create({ data: { tenantId, contactId: 'industry-contact', productInterestId: 'industry-product', interested: true, activeProduct: true } });
    await db.dealStageHistory.create({ data: { tenantId, dealId: 'industry-deal-0', newStageId: 'stage-a', movedById: 'industry-actor', note: 'Preserve this stage history' } });
    await db.activity.create({ data: { tenantId, createdById: 'industry-actor', dealId: 'industry-deal-0', type: 'note', title: 'Historical note', description: 'Keep this history' } });
    await db.workflow.create({ data: { id: 'industry-workflow', tenantId, name: 'Preserved workflow', trigger: 'deal.updated', actions: [], status: 'PAUSED' } });
    const trigger = await db.workflowTriggerRecord.create({ data: { tenantId, workflowId: 'industry-workflow', triggerType: 'deal.updated', entityType: 'deal', entityId: 'industry-deal-0' } });
    const definition = { trigger: 'deal.updated', conditions: { operator: 'AND', conditions: [{ field: 'deal.industry', operator: 'equals', value: 'Legacy' }] }, actions: [] };
    const tables = await db.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
    const snapshot = () => db.$queryRawUnsafe(tables.map(({ table_name: table }) => {
      const identifier = '"' + table.replaceAll('"', '""') + '"';
      const row = table === 'Deal' ? "to_jsonb(t) - 'industry'" : 'to_jsonb(t)';
      return `SELECT '${table}' AS name, COALESCE(jsonb_agg(${row} ORDER BY (${row})::text), '[]'::jsonb) AS rows FROM public.${identifier} t`;
    }).join(' UNION ALL '));
    const schema = () => db.$queryRawUnsafe(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
    const initialImpact = await inspectDealIndustry(db);
    assert.deepEqual(initialImpact.impact, [
      { tenantId: 'industry-a', total: 4, nullValues: 1, emptyValues: 2, populatedValues: 1 },
      { tenantId: 'industry-b', total: 3, nullValues: 1, emptyValues: 0, populatedValues: 2 },
    ]);
    assert.deepEqual(initialImpact.dependencies, []);
    async function blocked(kind, setup, cleanup) {
      await setup();
      const before = await snapshot();
      const report = await inspectDealIndustry(db);
      assert.ok(report.dependencies.some(item => item.kind === kind), JSON.stringify(report));
      assert.throws(() => pg.executeSql(name, sql), /DEAL_INDUSTRY_DEPENDENCIES_REQUIRE_REPAIR/);
      assert.deepEqual(await snapshot(), before, 'A rejected migration must not change any row');
      assert.equal((await inspectDealIndustry(db)).columnPresent, true);
      await cleanup();
    }
    await t.test('blocks stage requirements', () => blocked('Stage',
      () => db.stage.update({ where: { id: 'stage-a' }, data: { requiredFields: ['industry'] } }),
      () => db.stage.update({ where: { id: 'stage-a' }, data: { requiredFields: [] } })));
    await t.test('blocks database dependencies instead of cascading or dropping an index implicitly', () => blocked('DatabaseObject',
      () => db.$executeRawUnsafe('CREATE INDEX "industry_fixture_index" ON public."Deal" (industry)'),
      () => db.$executeRawUnsafe('DROP INDEX public."industry_fixture_index"')));
    for (const data of [
      { conditions: definition.conditions },
      { actions: [{ type: 'update_field', config: { field: 'industry', value: 'Legacy' } }] },
      { conditions: { operator: 'AND', conditions: [{ field: 'event.changedFields', operator: 'contains', value: 'industry' }] } },
      { actions: [{ type: 'send_email', config: { body: '{{ industry }}' } }] },
    ]) await t.test('blocks active Workflow ' + JSON.stringify(data), () => blocked('Workflow',
      () => db.workflow.update({ where: { id: 'industry-workflow' }, data: { isActive: true, status: 'ACTIVE', ...data } }),
      () => db.workflow.update({ where: { id: 'industry-workflow' }, data: { isActive: false, status: 'PAUSED', actions: [], conditions: { operator: 'AND', conditions: [] } } })));
    await t.test('blocks current published workflow definitions', () => blocked('WorkflowPublication', async () => {
      await db.workflow.update({ where: { id: 'industry-workflow' }, data: { isActive: true, status: 'ACTIVE' } });
      await db.workflowPublication.create({ data: { tenantId, workflowId: 'industry-workflow', version: 1, definition } });
    }, async () => {
      await db.workflowPublication.deleteMany();
      await db.workflow.update({ where: { id: 'industry-workflow' }, data: { isActive: false, status: 'PAUSED' } });
    }));
    for (const status of ['queued', 'running']) await t.test(`blocks ${status} snapshots even after their Workflow was paused`, () => blocked('WorkflowExecutionRun',
      () => db.workflowExecutionRun.create({ data: { id: 'unfinished-run', tenantId, workflowId: 'industry-workflow', triggerId: trigger.id, entityType: 'deal', entityId: 'industry-deal-0', status, definitionSnapshot: definition } }),
      () => db.workflowExecutionRun.delete({ where: { id: 'unfinished-run' } })));
    await t.test('blocks active audience conditions', () => blocked('TargetAudience',
      () => db.targetAudience.create({ data: { id: 'industry-audience', tenantId, name: 'Audience', conditions: { create: { field: 'deal.industry', operator: 'equals', value: 'Legacy' } } } }),
      () => db.targetAudience.delete({ where: { id: 'industry-audience' } })));
    await t.test('blocks reusable templates', () => blocked('Template',
      () => db.template.create({ data: { id: 'industry-template', tenantId, name: 'Legacy template', type: 'Email', content: '{{ deal.industry }}' } }),
      () => db.template.delete({ where: { id: 'industry-template' } })));
    await t.test('blocks scheduled Campaign snapshots', () => blocked('Campaign',
      () => db.campaign.create({ data: { id: 'industry-campaign', tenantId, name: 'Scheduled', type: 'EMAIL', status: 'SCHEDULED', scheduleConfig: { conditions: [{ field: 'deal.industry', value: 'Legacy' }] } } }),
      () => db.campaign.delete({ where: { id: 'industry-campaign' } })));
    await t.test('preserves completed snapshots, old publications, paused rules and Account Industry references', async () => {
      await db.workflowExecutionRun.create({ data: { tenantId, workflowId: 'industry-workflow', triggerId: trigger.id, entityType: 'deal', entityId: 'industry-deal-0', status: 'completed', completedAt: new Date(), definitionSnapshot: definition } });
      await db.workflowPublication.create({ data: { tenantId, workflowId: 'industry-workflow', version: 0, definition } });
      await db.workflow.update({ where: { id: 'industry-workflow' }, data: { conditions: definition.conditions } });
      await db.template.create({ data: { tenantId, name: 'Account template', type: 'Email', content: '{{ account.industry }}' } });
      assert.deepEqual((await inspectDealIndustry(db)).dependencies, []);
      const beforeRows = await snapshot(), beforeSchema = await schema();
      pg.executeSql(name, sql);
      assert.deepEqual(await schema(), beforeSchema.filter(column => !(column.table_name === 'Deal' && column.column_name === 'industry')));
      assert.deepEqual(await snapshot(), beforeRows, 'Every other column and table row must be unchanged');
      assert.equal((await inspectDealIndustry(db)).columnPresent, false);
      assert.equal(await db.deal.count(), 7);
      assert.equal((await db.account.findUniqueOrThrow({ where: { id: 'account-a' } })).industry, 'Account-only value');
      assert.equal((await db.productInterest.findUniqueOrThrow({ where: { id: 'industry-product' } })).category, '');
      const output = resolve(root, 'data/outputs/system-audit/deal-industry-retirement');
      mkdirSync(output, { recursive: true });
      writeFileSync(resolve(output, 'migration-results.json'), JSON.stringify({ database: pg.version, initialImpact, columnRemoved: true, allOtherRowsPreserved: true, accountIndustryPreserved: true }, null, 2));
    });
  } finally { await db?.$disconnect(); pg.stop(); }
});
