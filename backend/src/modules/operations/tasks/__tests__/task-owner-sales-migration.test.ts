import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261121000000_task_creator_sales_group/migration.sql'), 'utf8');
async function fixture() {
  const db = await PGlite.create();
  await db.exec(`CREATE TABLE "Tenant" (id TEXT PRIMARY KEY);
    CREATE TABLE "User" (id TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, UNIQUE(id,"tenantId"));
    CREATE TABLE "Task" (id TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "createdAt" TIMESTAMP DEFAULT NOW());
    CREATE TABLE "AuditLog" ("tenantId" TEXT, "entityId" TEXT, "userId" TEXT, action TEXT, "entityType" TEXT);
    CREATE TABLE "TenantGroup" (id TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, name TEXT, "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW());
    CREATE TABLE "TenantGroupMember" ("groupId" TEXT, "userId" TEXT);
    INSERT INTO "Tenant" VALUES ('tenant'),('other');
    INSERT INTO "User" VALUES ('creator','tenant'),('assignee','tenant'),('foreign','other');`);
  return db;
}
it('replays on empty Task/Group data and provisions exactly one default Sales per tenant', async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    expect((await db.query(`SELECT "tenantId",name,"systemKey" FROM "TenantGroup" ORDER BY "tenantId"`)).rows).toEqual([
      { tenantId: 'other', name: 'Sales', systemKey: 'SALES' }, { tenantId: 'tenant', name: 'Sales', systemKey: 'SALES' },
    ]);
    await expect(db.exec(`INSERT INTO "TenantGroup" (id,"tenantId",name,"systemKey") VALUES ('duplicate','tenant','Renamed','SALES')`)).rejects.toThrow();
  } finally { await db.close(); }
}, 30000);
it('backfills only reliable same-tenant original audit creators and preserves legacy Sales memberships/timestamps', async () => {
  const db = await fixture();
  try {
    await db.exec(`INSERT INTO "Task" (id,"tenantId","createdAt") VALUES ('known','tenant','2020-01-01'),('unknown','tenant','2020-01-01'),('ambiguous','tenant','2020-01-01'),('foreign','tenant','2020-01-01');
      INSERT INTO "AuditLog" VALUES ('tenant','known','creator','task.created','Task'),('tenant','known','assignee','task.assigned','Task'),
        ('tenant','ambiguous','creator','task.created','Task'),('tenant','ambiguous','assignee','task.created','Task'),('tenant','foreign','foreign','task.created','Task');
      INSERT INTO "TenantGroup" (id,"tenantId",name) VALUES ('legacy','tenant',' sAlEs ');
      INSERT INTO "TenantGroupMember" VALUES ('legacy','assignee');`);
    await db.exec(migration);
    expect((await db.query(`SELECT id,"createdById" FROM "Task" ORDER BY id`)).rows).toEqual([
      { id: 'ambiguous', createdById: null }, { id: 'foreign', createdById: null }, { id: 'known', createdById: 'creator' }, { id: 'unknown', createdById: null },
    ]);
    expect((await db.query(`SELECT id,name,"systemKey" FROM "TenantGroup" WHERE "tenantId"='tenant'`)).rows).toEqual([{ id: 'legacy', name: ' sAlEs ', systemKey: 'SALES' }]);
    expect((await db.query(`SELECT * FROM "TenantGroupMember"`)).rows).toEqual([{ groupId: 'legacy', userId: 'assignee' }]);
    expect((await db.query(`SELECT count(*)::int AS count FROM "Task" WHERE "createdAt"='2020-01-01'`)).rows).toEqual([{ count: 4 }]);
    await expect(db.exec(`UPDATE "Task" SET "createdById"='assignee' WHERE id='known'`)).rejects.toThrow('Task creator is immutable');
    await expect(db.exec(`INSERT INTO "Task" (id,"tenantId","createdById") VALUES ('invalid','tenant','foreign')`)).rejects.toThrow();
  } finally { await db.close(); }
}, 30000);
it('aborts for ambiguous case-insensitive Sales groups before changing schema or memberships', async () => {
  const db = await fixture();
  try {
    await db.exec(`INSERT INTO "TenantGroup" (id,"tenantId",name) VALUES ('first','tenant','Sales'),('second','tenant','sales');`);
    await expect(db.exec(migration)).rejects.toThrow('Rename duplicates explicitly');
    await db.exec('ROLLBACK');
    expect((await db.query(`SELECT id FROM "TenantGroup" ORDER BY id`)).rows).toEqual([{ id: 'first' }, { id: 'second' }]);
    expect((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='Task' AND column_name='createdById'`)).rows).toEqual([]);
  } finally { await db.close(); }
}, 30000);
