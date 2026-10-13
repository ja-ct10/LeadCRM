import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261204000000_workflow_stage_entry_identity/migration.sql'), 'utf8');

it('backfills only proven stage identities, preserves history, and initializes new Deals transactionally', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY, "tenantId" TEXT);
      CREATE TABLE "Deal" (id TEXT PRIMARY KEY, "tenantId" TEXT, "pipelineId" TEXT, "stageId" TEXT,
        "ownerId" TEXT, "assignedUserId" TEXT, "createdAt" TIMESTAMP, "stageChangedAt" TIMESTAMP);
      CREATE TABLE "DealStageHistory" (id TEXT PRIMARY KEY, "tenantId" TEXT, "dealId" TEXT,
        "previousStageId" TEXT, "newStageId" TEXT, "movedById" TEXT, "movedAt" TIMESTAMP, note TEXT);
      CREATE FUNCTION leadcrm_record_deal_start() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
      CREATE TRIGGER record_deal_start AFTER INSERT ON "Deal" FOR EACH ROW EXECUTE FUNCTION leadcrm_record_deal_start();
      INSERT INTO "User" VALUES ('actor','tenant');
      INSERT INTO "Deal" VALUES
        ('proven','tenant','pipeline','b',NULL,NULL,'2026-01-01','2026-01-02'),
        ('tied','tenant','pipeline','b',NULL,NULL,'2026-01-01','2026-01-02'),
        ('wrong','tenant','pipeline','b',NULL,NULL,'2026-01-01','2026-01-02'),
        ('missing','tenant','pipeline','b',NULL,NULL,'2026-01-01','2026-01-02'),
        ('foreign','tenant','pipeline','b',NULL,NULL,'2026-01-01','2026-01-02'),
        ('created','tenant','pipeline','a',NULL,NULL,'2026-01-01',NULL);
      INSERT INTO "DealStageHistory" VALUES
        ('p-old','tenant','proven',NULL,'a','actor','2026-01-01','Preserved'),
        ('p-new','tenant','proven','a','b','actor','2026-01-02','Preserved'),
        ('t-one','tenant','tied','a','b','actor','2026-01-02','Preserved'),
        ('t-two','tenant','tied','b','a','actor','2026-01-02','Preserved'),
        ('w-one','tenant','wrong','b','a','actor','2026-01-02','Preserved'),
        ('f-one','other','foreign','a','b','actor','2026-01-02','Preserved'),
        ('c-one','tenant','created',NULL,'a','actor','2026-01-01','Preserved');`);
    const history = (await db.query('SELECT * FROM "DealStageHistory" ORDER BY id')).rows;
    await db.exec(sql);
    expect((await db.query('SELECT id,"currentStageHistoryId" FROM "Deal" ORDER BY id')).rows).toEqual([
      { id: 'created', currentStageHistoryId: 'c-one' }, { id: 'foreign', currentStageHistoryId: null },
      { id: 'missing', currentStageHistoryId: null }, { id: 'proven', currentStageHistoryId: 'p-new' },
      { id: 'tied', currentStageHistoryId: null }, { id: 'wrong', currentStageHistoryId: null },
    ]);
    expect((await db.query('SELECT * FROM "DealStageHistory" ORDER BY id')).rows).toEqual(history);
    await expect(db.exec(`UPDATE "Deal" SET "currentStageHistoryId"='p-new' WHERE id='wrong'`)).rejects.toThrow('must belong');
    await db.exec(`UPDATE "Deal" SET "stageId"='a' WHERE id='proven'`);
    expect((await db.query('SELECT "currentStageHistoryId" FROM "Deal" WHERE id=\'proven\'')).rows[0]).toEqual({ currentStageHistoryId: null });
    await db.exec(`INSERT INTO "Deal" (id,"tenantId","pipelineId","stageId","ownerId","createdAt")
      VALUES ('new','tenant','pipeline','a','actor','2026-01-03')`);
    const entry = (await db.query<{ id: string }>('SELECT id FROM "DealStageHistory" WHERE "dealId"=\'new\'')).rows[0];
    expect((await db.query('SELECT "currentStageHistoryId" FROM "Deal" WHERE id=\'new\'')).rows[0]).toEqual({ currentStageHistoryId: entry.id });
    await db.exec('BEGIN');
    await db.exec(`UPDATE "Deal" SET "stageId"='b' WHERE id='new';
      INSERT INTO "DealStageHistory" VALUES ('rolled-back','tenant','new','a','b','actor','2026-01-03','Preserved');
      UPDATE "Deal" SET "currentStageHistoryId"='rolled-back' WHERE id='new';`);
    await db.exec('ROLLBACK');
    expect((await db.query('SELECT "stageId","currentStageHistoryId" FROM "Deal" WHERE id=\'new\'')).rows[0]).toEqual({ stageId: 'a', currentStageHistoryId: entry.id });
    expect((await db.query('SELECT id FROM "DealStageHistory" WHERE id=\'rolled-back\'')).rows).toEqual([]);
  } finally { await db.close(); }
}, 60000);
