import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

it('adds nullable CRM ownership and checkpoints without rewriting history, enforcing tenant-scoped references', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "Tenant" (id text PRIMARY KEY);
      INSERT INTO "Tenant" VALUES ('tenant'),('other');
      CREATE TABLE "TenantGroup" (id text PRIMARY KEY, "tenantId" text NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE, UNIQUE(id,"tenantId"));
      CREATE TABLE "RoleDefinition" (id text PRIMARY KEY, "tenantId" text NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE, UNIQUE(id,"tenantId"));
      CREATE TABLE "TenantGroupMember" (id text PRIMARY KEY, "tenantId" text NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE, "isHead" boolean NOT NULL);
      INSERT INTO "TenantGroup" VALUES ('own','tenant'),('foreign','other');
      INSERT INTO "RoleDefinition" VALUES ('own-role','tenant'),('foreign-role','other');
      INSERT INTO "TenantGroupMember" VALUES ('member','tenant',true);`);
    for (const table of ['Lead', 'Contact', 'Account', 'Deal']) await db.exec(`CREATE TABLE "${table}" (id text PRIMARY KEY, "tenantId" text NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE, historical text NOT NULL);
      INSERT INTO "${table}" VALUES ('record','tenant','Preserved status, stage and history');`);
    await db.exec(readFileSync(resolve(__dirname, '../../../prisma/migrations/20261224000000_crm_group_status/migration.sql'), 'utf8'));
    for (const table of ['Lead', 'Contact', 'Account', 'Deal']) {
      expect((await db.query(`SELECT id, "tenantId", historical, "ownerGroupId" FROM "${table}"`)).rows).toEqual([
        { id: 'record', tenantId: 'tenant', historical: 'Preserved status, stage and history', ownerGroupId: null },
      ]);
      await expect(db.exec(`UPDATE "${table}" SET "ownerGroupId"='foreign'`)).rejects.toThrow(/foreign key/i);
      await db.exec(`UPDATE "${table}" SET "ownerGroupId"='own'`);
    }
    for (const table of ['Lead', 'Contact']) expect((await db.query(`SELECT "manualStatusContext" FROM "${table}"`)).rows).toEqual([{ manualStatusContext: null }]);
    expect((await db.query(`SELECT "isHead", "crmRoleId" FROM "TenantGroupMember"`)).rows).toEqual([{ isHead: true, crmRoleId: null }]);
    await expect(db.exec(`UPDATE "TenantGroupMember" SET "crmRoleId"='foreign-role'`)).rejects.toThrow(/foreign key/i);
    await db.exec(`UPDATE "TenantGroupMember" SET "crmRoleId"='own-role'`);
    await expect(db.exec(`DELETE FROM "RoleDefinition" WHERE id='own-role'`)).rejects.toThrow(/foreign key/i);
    await expect(db.exec(`DELETE FROM "TenantGroup" WHERE id='own'`)).rejects.toThrow(/foreign key/i);
    await db.exec(`DELETE FROM "Tenant" WHERE id='tenant'`);
    expect((await db.query(`SELECT id FROM "TenantGroupMember"`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT id FROM "TenantGroup"`)).rows).toEqual([{ id: 'foreign' }]);
  } finally { await db.close(); }
}, 60000);
