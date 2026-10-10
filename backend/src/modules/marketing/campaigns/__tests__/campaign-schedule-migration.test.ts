import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261123000000_campaign_schedule/migration.sql'), 'utf8');
async function fixture() {
  const db = await PGlite.create();
  await db.exec(`CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT','SENDING','INTERRUPTED','SENT','PARTIALLY_SENT','DELIVERED','FAILED');
    CREATE TABLE "Campaign" (id TEXT PRIMARY KEY, status "CampaignStatus" NOT NULL DEFAULT 'DRAFT', "scheduledFor" TIMESTAMP, "createdAt" TIMESTAMP DEFAULT NOW());
    CREATE TABLE "TargetAudience" (id TEXT PRIMARY KEY, source TEXT NOT NULL);`);
  return db;
}

it('adds schedule schema on an empty database and enforces default AND plus explicit AND/OR values', async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    await db.exec(`INSERT INTO "TargetAudience" (id,source) VALUES ('default','LEADS');
      INSERT INTO "TargetAudience" (id,source,"matchMode") VALUES ('or','CONTACTS','OR');
      INSERT INTO "Campaign" (id,status,"scheduledById","scheduleConfig") VALUES ('scheduled','SCHEDULED','actor','{"source":"LEADS","matchMode":"AND","conditions":[],"timezone":"Asia/Manila"}');`);
    expect((await db.query(`SELECT id,"matchMode" FROM "TargetAudience" ORDER BY id`)).rows).toEqual([{ id: 'default', matchMode: 'AND' }, { id: 'or', matchMode: 'OR' }]);
    await expect(db.exec(`UPDATE "TargetAudience" SET "matchMode"='UNKNOWN' WHERE id='or'`)).rejects.toThrow();
    expect((await db.query(`SELECT status FROM "Campaign" WHERE id='scheduled'`)).rows).toEqual([{ status: 'SCHEDULED' }]);
  } finally { await db.close(); }
}, 30000);

it('preserves historical ALL, Draft due timestamps and completed records without activating legacy schedules', async () => {
  const db = await fixture();
  try {
    await db.exec(`INSERT INTO "TargetAudience" (id,source) VALUES ('legacy','ALL'),('lead','LEADS');
      INSERT INTO "Campaign" (id,status,"scheduledFor","createdAt") VALUES ('old-draft','DRAFT','2020-02-03 04:05:06','2020-01-01'),('finished','SENT',NULL,'2021-01-01');`);
    await db.exec(migration);
    expect((await db.query(`SELECT id,source,"matchMode" FROM "TargetAudience" ORDER BY id`)).rows).toEqual([{ id: 'lead', source: 'LEADS', matchMode: 'AND' }, { id: 'legacy', source: 'ALL', matchMode: 'AND' }]);
    expect((await db.query(`SELECT id,status,"scheduledFor"::text,"createdAt"::text,"scheduledById","scheduleConfig" FROM "Campaign" ORDER BY id`)).rows).toEqual([
      { id: 'finished', status: 'SENT', scheduledFor: null, createdAt: '2021-01-01 00:00:00', scheduledById: null, scheduleConfig: null },
      { id: 'old-draft', status: 'DRAFT', scheduledFor: '2020-02-03 04:05:06', createdAt: '2020-01-01 00:00:00', scheduledById: null, scheduleConfig: null },
    ]);
    expect((await db.query(`SELECT count(*)::int AS count FROM "Campaign" WHERE status='SCHEDULED'`)).rows).toEqual([{ count: 0 }]);
  } finally { await db.close(); }
}, 30000);
