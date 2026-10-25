import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
it('backfills only proven same-tenant workflow creators, preserves unknown history and makes creators immutable', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "User" (id text, "tenantId" text, UNIQUE(id,"tenantId"));
      CREATE TABLE "Workflow" (id text, "tenantId" text, "isArchived" boolean DEFAULT false);
      CREATE TABLE "Campaign" (id text, "tenantId" text, "createdById" text, "isArchived" boolean DEFAULT false);
      CREATE TABLE "AuditLog" ("tenantId" text, "entityId" text, "entityType" text, action text, "userId" text);
      INSERT INTO "User" VALUES ('a','t'),('b','t'),('foreign','f');
      INSERT INTO "Workflow"(id,"tenantId") VALUES ('proven','t'),('copy','t'),('ambiguous','t'),('foreign','t'),('unknown','t');
      INSERT INTO "AuditLog" VALUES ('t','proven','Workflow','workflow.created','a'),('t','copy','Workflow','workflow.duplicated','b'),
        ('t','ambiguous','Workflow','workflow.created','a'),('t','ambiguous','Workflow','workflow.created','b'),
        ('t','foreign','Workflow','workflow.created','foreign');`);
    await db.exec(readFileSync(new URL('../../../prisma/migrations/20261228000000_role_based_visibility/migration.sql', import.meta.url), 'utf8'));
    const result = await db.query<{ id: string; createdById: string | null }>('SELECT id,"createdById" FROM "Workflow" ORDER BY id');
    expect(result.rows).toEqual([{ id: 'ambiguous', createdById: null }, { id: 'copy', createdById: 'b' },
      { id: 'foreign', createdById: null }, { id: 'proven', createdById: 'a' }, { id: 'unknown', createdById: null }]);
    await expect(db.exec(`UPDATE "Workflow" SET "createdById"='b' WHERE id='proven'`)).rejects.toThrow('Workflow creator is immutable');
  } finally { await db.close(); }
});
