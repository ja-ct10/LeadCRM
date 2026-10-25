
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { notificationTestPostgres } from './notification-test-postgres.mjs';

const migration = '20261228000000_role_based_visibility';
test('role visibility migration preserves populated history and proves only tenant-safe immutable creators', { timeout: 180000 }, async () => {
  const pg = await notificationTestPostgres(); let db;
  try {
    const name = 'leadcrm_role_visibility_migration_1';
    const url = await pg.database(name, { before: migration });
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$executeRawUnsafe(`INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('t','Visibility','visibility',now()),('f','Foreign','foreign',now())`);
    await db.$executeRawUnsafe(`INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"updatedAt")
      VALUES ('a','t','a@example.test','A','Staff','Staff',now()),('b','t','b@example.test','B','Staff','Staff',now()),
        ('foreign','f','foreign@example.test','Foreign','Staff','Staff',now())`);
    for (const id of ['proven','copy','ambiguous','foreign','unknown','activation-only']) {
      await db.$executeRawUnsafe(`INSERT INTO "Workflow" (id,"tenantId",name,trigger,actions,"isArchived","updatedAt","activatedById")
        VALUES ($1,'t',$1,'lead.created','[]',true,'2025-01-01','a')`, id);
    }
    await db.$executeRawUnsafe(`INSERT INTO "AuditLog" (id,"tenantId","userId",action,"entityType","entityId")
      VALUES ('a1','t','a','workflow.created','Workflow','proven'),
        ('a2','t','b','workflow.duplicated','Workflow','copy'),
        ('a3','t','a','workflow.created','Workflow','ambiguous'),
        ('a4','t','b','workflow.created','Workflow','ambiguous'),
        ('a5','t','foreign','workflow.created','Workflow','foreign'),
        ('a6','t','a','workflow.updated','Workflow','activation-only')`);
    const before = await db.$queryRawUnsafe(`SELECT jsonb_agg(to_jsonb(w) ORDER BY id) AS rows FROM "Workflow" w`);
    const audits = await db.auditLog.findMany({ orderBy: { id: 'asc' } });
    pg.executeSql(name, readFileSync(resolve(import.meta.dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8'));
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT jsonb_agg(to_jsonb(w)-'createdById' ORDER BY id) AS rows FROM "Workflow" w`), before);
    assert.deepEqual(await db.auditLog.findMany({ orderBy: { id: 'asc' } }), audits);
    assert.deepEqual(await db.workflow.findMany({ orderBy: { id: 'asc' }, select: { id: true, createdById: true } }), [
      { id: 'activation-only', createdById: null }, { id: 'ambiguous', createdById: null },
      { id: 'copy', createdById: 'b' }, { id: 'foreign', createdById: null },
      { id: 'proven', createdById: 'a' }, { id: 'unknown', createdById: null },
    ]);
    await assert.rejects(db.workflow.update({ where: { id: 'proven' }, data: { createdById: 'b' } }), /Workflow creator is immutable/);
    await assert.rejects(db.workflow.create({ data: { tenantId: 't', name: 'Foreign creator', trigger: 'lead.created', actions: [], createdById: 'foreign' } }), /Foreign key constraint/);
    const indexes = await db.$queryRawUnsafe(`SELECT indexname FROM pg_indexes WHERE indexname IN ('Workflow_tenantId_createdById_isArchived_idx','Campaign_tenantId_createdById_isArchived_idx') ORDER BY indexname`);
    assert.equal(indexes.length, 2);
  } finally { await db?.$disconnect(); pg.stop(); }
});
