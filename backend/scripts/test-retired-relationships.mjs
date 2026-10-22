// Native, loopback-only acceptance. Never reads a configured application database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { notificationTestPostgres, runNotificationTestFile } from './notification-test-postgres.mjs';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const expansion = '20261225000000_preserve_retired_relationships';
const retirement = '20261226000000_retire_unused_relationship_tables';
const pg = await notificationTestPostgres();
const stamp = Date.now();
let db;
try {
  console.log(`${pg.version}; disposable loopback PostgreSQL, durability enabled.`);
  const fixtureName = `leadcrm_retired_test_${stamp}`;
  const url = await pg.database(fixtureName, { before: expansion });
  db = new PrismaClient({ datasources: { db: { url } } });
  // Explicit selects avoid reading future columns; raw inserts below also avoid
  // Prisma sending its new JSON defaults before the expansion exists.
  const tenant = await db.tenant.create({ data: { name: 'Retirement fixture', slug: randomUUID() }, select: { id: true } });
  const user = await db.user.create({ data: { tenantId: tenant.id, firstName: 'Retirement', lastName: 'Tester', email: `${randomUUID()}@example.test`, role: 'Client Admin', status: 'ACTIVE' }, select: { id: true } });
  const account = await db.account.create({ data: { tenantId: tenant.id, name: 'Original account' }, select: { id: true } });
  const task = { id: randomUUID() };
  await db.$executeRawUnsafe('INSERT INTO "Task" (id,"tenantId",title,"assignedUserId","createdById","dueDate","updatedAt") VALUES ($1,$2,$3,$4,$4,$5,$5)', task.id, tenant.id, 'Original direct Account task', user.id, new Date('2026-01-01T00:00:00Z'));
  const campaign = await db.campaign.create({ data: { tenantId: tenant.id, name: 'Original SMS', type: 'SMS', createdById: user.id, smsTrackingVersion: 1 }, select: { id: true } });
  const recipient = { id: randomUUID() };
  await db.$executeRawUnsafe('INSERT INTO "CampaignContact" (id,"tenantId","campaignId",phone,status) VALUES ($1,$2,$3,$4,$5)', recipient.id, tenant.id, campaign.id, '+639171234567', 'sent');
  const token = 'abcdefghijklmnopqrstuvwx';
  await db.$executeRawUnsafe('INSERT INTO "TaskAccount" ("taskId","accountId","tenantId",position) VALUES ($1,$2,$3,2)', task.id, account.id, tenant.id);
  await db.$executeRawUnsafe('INSERT INTO "SmsCampaignLink" (id,"tenantId","campaignContactId",url,"clickedAt","lastClickedAt","clickCount") VALUES ($1,$2,$3,$4,$5,$6,4)', token, tenant.id, recipient.id, 'https://example.test/original?a=1&b=2#section', new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z'));
  const originals = await db.$queryRawUnsafe('SELECT to_jsonb(l) AS row FROM "SmsCampaignLink" l');
  const oldTaskTime = (await db.task.findUniqueOrThrow({ where: { id: task.id }, select: { updatedAt: true } })).updatedAt;
  const historyCounts = () => db.$queryRawUnsafe('SELECT (SELECT count(*)::int FROM "Activity") AS activity, (SELECT count(*)::int FROM "AuditLog") AS audit, (SELECT count(*)::int FROM "NotificationEvent") AS notifications');
  const originalHistory = await historyCounts();
  const apply = name => {
    const sql = readFileSync(resolve(import.meta.dirname, '../prisma/migrations', name, 'migration.sql'), 'utf8');
    pg.executeSql(fixtureName, sql + `\nINSERT INTO "_prisma_migrations" (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ('${randomUUID()}','${createHash('sha256').update(sql).digest('hex')}','${name}',now(),1);`);
  };
  apply(expansion);
  assert.deepEqual(await historyCounts(), originalHistory);
  assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id }, select: { updatedAt: true } })).updatedAt.getTime(), oldTaskTime.getTime());
  assert.deepEqual((await db.campaignContact.findUniqueOrThrow({ where: { id: recipient.id }, select: { smsLinkHistory: true } })).smsLinkHistory, originals.map(row => row.row));
  // The actual Prisma query used by the public redirect resolves preserved tokens.
  const lookup = () => db.campaignContact.findMany({ where: { smsLinkHistory: { array_contains: [{ id: token }] } }, select: { id: true }, take: 2 });
  assert.deepEqual(await lookup(), [{ id: recipient.id }]);
  const plan = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET LOCAL enable_seqscan=off');
    return tx.$queryRawUnsafe(`EXPLAIN SELECT id FROM "CampaignContact" WHERE "smsLinkHistory" @> '[{"id":"${token}"}]'::jsonb`);
  });
  assert.match(JSON.stringify(plan), /CampaignContact_smsLinkHistory_idx/);
  await assert.rejects(db.$executeRawUnsafe('UPDATE "SmsCampaignLink" SET "clickCount"=9'), /SOURCE_FROZEN/);
  const marker = 'leadcrm-retired-relationships-v1:' + 'a'.repeat(40);
  await db.$executeRawUnsafe(`COMMENT ON TABLE "TaskAccount" IS '${marker}'`);
  await db.$executeRawUnsafe(`COMMENT ON TABLE "SmsCampaignLink" IS '${marker}'`);
  apply(retirement);
  assert.deepEqual(await historyCounts(), originalHistory);
  assert.deepEqual(await lookup(), [{ id: recipient.id }]);
  assert.deepEqual((await db.task.findUniqueOrThrow({ where: { id: task.id }, select: { retiredAccountLinks: true } })).retiredAccountLinks,
    [{ taskId: task.id, accountId: account.id, tenantId: tenant.id, position: 2 }]);
  await assert.rejects(db.campaignContact.update({ where: { id: recipient.id }, data: { smsLinkHistory: [] } }), /ARCHIVE_IMMUTABLE/);
  const counts = await db.$queryRawUnsafe(`SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname IN ('public','crm_history')`);
  pg.executeSql(fixtureName, readFileSync(resolve(import.meta.dirname, 'audit-tasks-deal-only.sql'), 'utf8'));
  console.log('Populated migration: exact preservation, unchanged history, immutable archives, native Prisma token lookup and GIN index verified.', counts);
  await db.$disconnect(); db = undefined;
  for (const [kind, file] of process.argv.includes('--migration-only') ? [] : [
    ['campaign', 'src/modules/marketing/campaigns/__tests__/sms-links.integration.test.ts'],
    ['campaign', 'src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts'],
    ['workflow', 'src/modules/operations/tasks/__tests__/tasks.integration.test.ts'],
  ]) {
    const url = await pg.database(`leadcrm_${kind}_test_${Date.now()}`);
    if (await runNotificationTestFile(file, url)) throw Error(`Acceptance failed: ${file}`);
  }
} finally {
  await db?.$disconnect();
  pg.stop();
}
