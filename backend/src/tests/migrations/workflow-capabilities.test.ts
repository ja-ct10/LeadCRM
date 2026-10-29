import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { replayCrmMigrations } from '../replay-crm-migrations';

it('migrates Workflow capabilities and named defaults without changing other modules or workflow history', async () => {
  const db = await PGlite.create();
  try {
    await replayCrmMigrations(db, '20261230000000_workflow_capabilities');
    await db.exec(`INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('workflow-rbac','RBAC','workflow-rbac',now());
      INSERT INTO "RoleDefinition" (id,"tenantId",name,"updatedAt") VALUES
      ('admin','workflow-rbac','Sales Admin',now()), ('associate','workflow-rbac','Sales Associate',now()),
      ('custom','workflow-rbac','Existing custom role',now());
      INSERT INTO "RolePermission" (id,"tenantId","roleId",module,"canView","canEdit","canActivate","canArchive") VALUES
      ('admin-leads','workflow-rbac','admin','leads',true,true,false,true),
      ('associate-tasks','workflow-rbac','associate','tasks',true,true,false,false),
      ('associate-workflows','workflow-rbac','associate','workflows',true,true,true,true),
      ('custom-workflows','workflow-rbac','custom','workflows',true,false,true,true);
      INSERT INTO "Workflow" (id,"tenantId",name,trigger,actions,"updatedAt") VALUES ('preserved','workflow-rbac','Existing','lead.created','[]',now());`);
    const unrelated = (await db.query(`SELECT * FROM "RolePermission" WHERE module <> 'workflows' ORDER BY id`)).rows;
    const workflow = (await db.query(`SELECT * FROM "Workflow"`)).rows;
    await db.exec(readFileSync(resolve(__dirname, '../../../prisma/migrations/20261230000000_workflow_capabilities/migration.sql'), 'utf8'));
    const rows = (await db.query(`SELECT "roleId","canView","canCreate","canEdit","canActivate","canPause","canExecute","canDelete","canArchive","canViewRuns" FROM "RolePermission" WHERE module='workflows' ORDER BY "roleId"`)).rows;
    expect(rows).toEqual([
      { roleId: 'admin', canView: true, canCreate: true, canEdit: true, canActivate: true, canPause: true, canExecute: true, canDelete: true, canArchive: false, canViewRuns: true },
      { roleId: 'associate', canView: true, canCreate: false, canEdit: false, canActivate: false, canPause: false, canExecute: true, canDelete: false, canArchive: false, canViewRuns: true },
      { roleId: 'custom', canView: true, canCreate: false, canEdit: false, canActivate: true, canPause: true, canExecute: true, canDelete: true, canArchive: false, canViewRuns: false },
    ]);
    expect((await db.query(`SELECT * FROM "RolePermission" WHERE module <> 'workflows' ORDER BY id`)).rows).toEqual(unrelated.map(row => ({ ...row, canPause: false, canExecute: false })));
    expect((await db.query(`SELECT * FROM "Workflow"`)).rows).toEqual(workflow);
    await db.exec(`UPDATE "RolePermission" SET "canPause"=true WHERE "roleId"='associate' AND module='workflows'`);
    expect((await db.query(`SELECT "canPause" FROM "RolePermission" WHERE "roleId"='associate' AND module='workflows'`)).rows[0]).toEqual({ canPause: true });
  } finally { await db.close(); }
}, 60000);
