import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notificationTestPostgres } from './notification-test-postgres.mjs';

const require = createRequire(import.meta.url), { PrismaClient } = require('@prisma/client');
const { inspectDealEngagement } = require('./check-deal-engagement.cjs');
const migration = '20261220000000_deal_engagement';
const root = resolve(import.meta.dirname, '../..');
const sql = readFileSync(resolve(root, 'backend/prisma/migrations', migration, 'migration.sql'), 'utf8');
test('Deal engagement migration preserves populated native PostgreSQL records', { timeout: 240000 }, async () => {
  const pg = await notificationTestPostgres(); let db;
  try {
    const name = 'leadcrm_deal_engagement_migration_1', url = await pg.database(name, { before: migration });
    db = new PrismaClient({ datasources: { db: { url } } });
    for (const id of ['one', 'two']) {
      await db.tenant.create({ data: { id, name: id, slug: id }, select: { id: true } });
      await db.user.create({ data: { id: `actor-${id}`, tenantId: id, firstName: 'Fixture', lastName: 'Admin', role: 'Client Admin', email: `${id}@example.test` }, select: { id: true } });
      await db.pipeline.create({ data: { id: `pipeline-${id}`, tenantId: id, name: id === 'one' ? 'Sales Pipeline' : 'Unrelated Pipeline' }, select: { id: true } });
      await db.stage.create({ data: { id: `won-${id}`, tenantId: id, pipelineId: `pipeline-${id}`, name: 'Closed Won', isWon: true, probability: 100, order: 0 } });
      await db.stage.create({ data: { id: `lost-${id}`, tenantId: id, pipelineId: `pipeline-${id}`, name: 'Closed Lost', isLost: true, probability: 0, order: 1 } });
      await db.$executeRawUnsafe(`INSERT INTO "Lead" (id, "tenantId", "firstName", "lastName", status) VALUES ($1, $2, 'Legacy', 'Customer', 'Closed')`, `lead-${id}`, id);
      await db.$executeRawUnsafe(`INSERT INTO "Contact" (id, "tenantId", "firstName", "lastName", status, "updatedAt", "productInterests") VALUES ($1, $2, 'Legacy', 'Contact', 'WARM', now(), '{}')`, `contact-${id}`, id);
      await db.$executeRawUnsafe(`UPDATE "Contact" SET status = 'CLOSED' WHERE id = $1`, `contact-${id}`);
      await db.$executeRawUnsafe(`INSERT INTO "Deal" (id, "tenantId", "pipelineId", "stageId", title, value, "updatedAt", tags, "productInterests") VALUES ($1, $2, $3, $4, 'Preserve this Deal', 12000, now(), '{}', '{}')`, `deal-${id}`, id, `pipeline-${id}`, `won-${id}`);
      await db.leadDeal.create({ data: { tenantId: id, leadId: `lead-${id}`, dealId: `deal-${id}` } });
      await db.dealStageHistory.create({ data: { tenantId: id, dealId: `deal-${id}`, newStageId: `won-${id}`, movedById: `actor-${id}`, note: 'Original Closed Won evidence' } });
    }
    await db.workflow.create({ data: { id: 'workflow', tenantId: 'one', name: 'Historical customer condition', trigger: 'lead.status_changed', status: 'PAUSED', actions: [],
      conditions: { operator: 'AND', conditions: [{ field: 'lead.status', operator: 'equals', value: 'Closed' }] } } });
    await db.activity.create({ data: { tenantId: 'one', createdById: 'actor-one', dealId: 'deal-one', type: 'note', title: 'Original Closed Won note' } });
    const financial = await db.$queryRawUnsafe('SELECT id, "stageId", value, "wonConfirmedAt" FROM "Deal" ORDER BY id');
    const history = await db.dealStageHistory.findMany({ orderBy: { id: 'asc' } });
    const links = await db.leadDeal.findMany({ orderBy: { id: 'asc' } });
    const before = await inspectDealEngagement(db); assert.deepEqual(before.blockers, []);
    await db.stage.create({ data: { id: 'collision', tenantId: 'one', pipelineId: 'pipeline-one', name: 'Closed Deal', isWon: true, order: 2 } });
    assert.ok((await inspectDealEngagement(db)).blockers.length);
    assert.throws(() => pg.executeSql(name, sql), /Duplicate Sales Pipeline terminal/);
    assert.equal((await db.stage.findUnique({ where: { id: 'won-one' } })).name, 'Closed Won');
    await db.stage.delete({ where: { id: 'collision' } });
    pg.executeSql(name, sql);
    assert.equal((await db.stage.findUnique({ where: { id: 'won-one' } })).name, 'Closed Deal');
    assert.equal((await db.stage.findUnique({ where: { id: 'lost-one' } })).name, 'Cancelled');
    assert.equal((await db.stage.findUnique({ where: { id: 'won-two' } })).name, 'Closed Won');
    assert.equal((await db.lead.findUnique({ where: { id: 'lead-one' } })).status, 'Closed Deal');
    assert.equal((await db.contact.findUnique({ where: { id: 'contact-one' } })).status, 'CLOSED_DEAL');
    assert.equal((await db.workflow.findUnique({ where: { id: 'workflow' } })).conditions.conditions[0].value, 'Closed Deal');
    assert.deepEqual(await db.$queryRawUnsafe('SELECT id, "stageId", value, "wonConfirmedAt" FROM "Deal" ORDER BY id'), financial);
    assert.deepEqual(await db.dealStageHistory.findMany({ orderBy: { id: 'asc' } }), history);
    assert.deepEqual(await db.leadDeal.findMany({ orderBy: { id: 'asc' } }), links);
    await db.lead.update({ where: { id: 'lead-one' }, data: { status: 'Cancelled', manualCancellation: false } });
    pg.executeSql(name, sql);
    assert.equal((await db.lead.findUnique({ where: { id: 'lead-one' } })).manualCancellation, false);
    assert.equal((await db.activity.findFirst({ where: { dealId: 'deal-one' } })).title, 'Original Closed Won note');
    const after = await inspectDealEngagement(db); assert.deepEqual(after.blockers, []);
    const output = resolve(root, 'data/outputs/system-audit/deal-engagement'); mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, 'migration-impact.json'), JSON.stringify({ database: 'Disposable native PostgreSQL', before, after, financialRowsPreserved: financial.length, historyRowsPreserved: history.length, success: true }, null, 2));
  } finally { await db?.$disconnect(); await pg.stop(); }
});
