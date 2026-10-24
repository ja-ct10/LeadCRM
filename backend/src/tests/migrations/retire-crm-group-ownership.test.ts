import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

it('retires Group references without changing customers, employee memberships or role permissions', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "TenantGroup" (id text PRIMARY KEY, "tenantId" text NOT NULL, UNIQUE(id,"tenantId"));
      CREATE TABLE "RoleDefinition" (id text PRIMARY KEY, "tenantId" text NOT NULL, UNIQUE(id,"tenantId"));
      CREATE TABLE "RolePermission" (id text PRIMARY KEY, "roleId" text NOT NULL, "canEdit" boolean NOT NULL);
      CREATE TABLE "TenantGroupMember" (id text PRIMARY KEY, "tenantId" text NOT NULL, "isHead" boolean NOT NULL);
      INSERT INTO "TenantGroup" VALUES ('group','tenant'),('other-group','other');
      INSERT INTO "RoleDefinition" VALUES ('role','tenant'),('other-role','other');
      INSERT INTO "RolePermission" VALUES ('grant','role',true);
      INSERT INTO "TenantGroupMember" VALUES ('member','tenant',true);`);
    for (const table of ['Lead', 'Contact', 'Account', 'Deal']) await db.exec(`CREATE TABLE "${table}" (id text PRIMARY KEY, "tenantId" text NOT NULL, "assignedUserId" text, status text, history jsonb);
      INSERT INTO "${table}" VALUES ('customer','tenant','agent','Warm','{"preserved":true}');`);
    const migration = (name: string) => readFileSync(resolve(__dirname, '../../../prisma/migrations', name, 'migration.sql'), 'utf8');
    await db.exec(migration('20261224000000_crm_group_status'));
    for (const table of ['Lead', 'Contact', 'Account', 'Deal']) await db.exec(`UPDATE "${table}" SET "ownerGroupId"='group'`);
    await db.exec(`UPDATE "TenantGroupMember" SET "crmRoleId"='role';
      UPDATE "Lead" SET "manualStatusContext"='{"status":"Warm"}';
      UPDATE "Contact" SET "manualStatusContext"='{"status":"Warm"}';`);
    const tables = ['Lead', 'Contact', 'Account', 'Deal', 'TenantGroupMember', 'RoleDefinition', 'RolePermission'];
    const before = await Promise.all(tables.map(table => db.query(`SELECT * FROM "${table}" ORDER BY id`)));
    await db.exec(migration('20261227000000_retire_crm_group_ownership'));
    const after = await Promise.all(tables.map(table => db.query(`SELECT * FROM "${table}" ORDER BY id`)));
    expect(after.map(result => result.rows)).toEqual(before.map(result => result.rows));
    expect((await db.query(`SELECT conname FROM pg_constraint WHERE conname LIKE '%ownerGroupId%' OR conname LIKE '%crmRoleId%'`)).rows).toEqual([]);
    expect((await db.query(`SELECT indexname FROM pg_indexes WHERE indexname LIKE '%ownerGroupId%' OR indexname LIKE '%crmRoleId%'`)).rows).toEqual([]);
    await db.exec(`DELETE FROM "RoleDefinition" WHERE id='role'; DELETE FROM "TenantGroup" WHERE id='group';`);
    expect((await db.query(`SELECT "isHead","crmRoleId" FROM "TenantGroupMember"`)).rows).toEqual([{ isHead: true, crmRoleId: 'role' }]);
    expect((await db.query(`SELECT "ownerGroupId","assignedUserId",history FROM "Lead"`)).rows).toEqual([{ ownerGroupId: 'group', assignedUserId: 'agent', history: { preserved: true } }]);
    expect((await db.query(`SELECT id FROM "TenantGroup"`)).rows).toEqual([{ id: 'other-group' }]);
  } finally { await db.close(); }
}, 60000);
