import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { replayCrmMigrations } from '../replay-crm-migrations';

it('backfills existing CRM View grants and leaves new, denied and unrelated rows disabled', async () => {
  const db = await PGlite.create();
  try {
    await replayCrmMigrations(db, '20261221000000_crm_tab_permissions');
    await db.exec(`INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('tabs','Tabs','tabs',now());
      INSERT INTO "RoleDefinition" (id,"tenantId",name,"updatedAt") VALUES ('role','tabs','Staff',now());`);
    for (const module of ['leads', 'contacts', 'accounts', 'deals', 'tasks']) {
      await db.query(`INSERT INTO "RolePermission" (id,"tenantId","roleId",module,"canView","canEdit") VALUES ($1,'tabs','role',$1,true,true)`, [module]);
    }
    await db.exec(`INSERT INTO "RoleDefinition" (id,"tenantId",name,"updatedAt") VALUES ('denied-role','tabs','Denied',now());
      INSERT INTO "RolePermission" (id,"tenantId","roleId",module) VALUES ('denied','tabs','denied-role','leads')`);
    await db.exec(readFileSync(resolve(__dirname, '../../../prisma/migrations/20261221000000_crm_tab_permissions/migration.sql'), 'utf8'));
    const rows = (await db.query(`SELECT id,"canView","canEdit","canViewAll","canViewMy","canViewActive" FROM "RolePermission" ORDER BY id`)).rows as any[];
    for (const row of rows) {
      expect(row.canViewAll).toBe(!['denied', 'tasks'].includes(row.id));
      expect(row.canViewMy).toBe(['leads', 'contacts', 'deals'].includes(row.id));
      expect(row.canViewActive).toBe(['leads', 'contacts'].includes(row.id));
      expect(row.canView).toBe(row.id !== 'denied'); expect(row.canEdit).toBe(row.id !== 'denied');
    }
    await db.exec(`INSERT INTO "RolePermission" (id,"tenantId","roleId",module,"canView") VALUES ('new','tabs','denied-role','deals',true)`);
    expect((await db.query(`SELECT "canViewAll","canViewMy","canViewActive" FROM "RolePermission" WHERE id='new'`)).rows[0]).toEqual({ canViewAll: false, canViewMy: false, canViewActive: false });
  } finally { await db.close(); }
}, 60000);
