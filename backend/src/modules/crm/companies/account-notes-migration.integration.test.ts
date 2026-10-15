import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { replayCrmMigrations } from '../../../../scripts/replay-crm-migrations.mjs';

const preservation = '20261209000000_account_notes_preservation';
const retirement = '20261210000000_retire_account_internal_notes';
const sql = (name: string) => readFileSync(resolve(import.meta.dirname, '../../../../prisma/migrations', name, 'migration.sql'), 'utf8');
let db: PGlite;
describe('Account Activity notes preservation and guarded retirement', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    await replayCrmMigrations(db, { before: preservation });
    await db.exec(`INSERT INTO "Tenant"(id,name,slug,"updatedAt") VALUES ('notes-tenant','Notes','notes-tenant',now()),('other-notes','Other','other-notes',now());
      INSERT INTO "Account"(id,"tenantId",name,notes,"internalNotes","isArchived","updatedAt") VALUES
      ('notes-account','notes-tenant','Company','  Full public text\nSecond line  ','秘密 internal text',true,now()),
      ('blank-account','other-notes','Blank','\t\n','  ',false,now()),('merge-target','notes-tenant','Surviving Account',NULL,NULL,false,now());
      INSERT INTO "User"(id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('merge-operator','notes-tenant','merge@example.test','Merge','Operator','Client Admin',now());
      INSERT INTO "Workflow"(id,"tenantId",name,trigger,actions,"isActive",status,"updatedAt") VALUES
      ('notes-workflow','notes-tenant','Old notes writer','account.updated','[{"type":"update_field","config":{"field":"internalNotes","value":"Keep definition"}}]',true,'ACTIVE',now()),
      ('healthy-workflow','notes-tenant','Healthy','lead.created','[{"type":"create_task","config":{"title":"Ordinary internalNotes text"}}]',true,'ACTIVE',now());
      INSERT INTO "TenantPreference"(id,"tenantId",module,key,value,"updatedAt") VALUES ('notes-layout','notes-tenant','accounts','field-layout','{"version":1,"revision":3,"module":"accounts","groups":[{"id":"accounts:section:0","label":"Basic Information","order":0},{"id":"accounts:section:4","label":"Notes","order":4}],"fields":{"internalNotes":{"label":"Private","groupId":"accounts:section:4","order":0,"visibleInForm":true,"visibleInDetails":true},"custom-note":{"label":"Context","groupId":"accounts:section:4","order":2,"visibleInForm":false,"visibleInDetails":true}}}',now());
      INSERT INTO "ClosingFieldDefinition"(id,"tenantId",definition,"updatedAt") VALUES ('custom-note','notes-tenant','{"id":"custom-note","name":"Context","module":"accounts","group":"Notes","groupId":"accounts:section:4","order":2,"required":true,"active":true,"visibleInForm":false,"visibleInDetails":true,"type":"Text"}',now());
      INSERT INTO "CustomFieldValue"(id,"tenantId","fieldId",module,"accountId",value,"updatedAt") VALUES ('note-custom-value','notes-tenant','custom-note','accounts','notes-account','"Preserve this custom value"',now());`);
    await db.exec(sql(preservation));
  }, 120000);
  afterAll(async () => { await db?.close(); });

  it('imports exact nonblank text with provenance and unknown authors, including archived Accounts', async () => {
    const notes = (await db.query<{ title: string; description: string; createdById: null; metadata: { sourceField: string } }>('SELECT title,description,"createdById",metadata FROM "Activity" WHERE "accountId"=\'notes-account\' ORDER BY title')).rows;
    expect(notes).toHaveLength(2);
    expect(notes.map(note => note.title)).toEqual(['Legacy Internal Notes', 'Legacy Notes']);
    expect(notes.map(note => note.description)).toEqual(['秘密 internal text', '  Full public text\nSecond line  ']);
    expect(notes.every(note => note.createdById === null)).toBe(true);
    expect((await db.query('SELECT * FROM "Activity" WHERE "tenantId"=\'other-notes\'')).rows).toHaveLength(0);
    await db.exec('SELECT crm_history.reconcile_account_notes()');
    expect((await db.query('SELECT * FROM "Activity"')).rows).toHaveLength(2);
    await expect(db.exec(`UPDATE crm_history.account_legacy_notes SET note_value='changed'`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO "Activity"(id,"tenantId",type,title) VALUES('unauthored','notes-tenant','note','Invalid')`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO "Activity"(id,"tenantId","accountId",type,title) VALUES('unauthored-account','notes-tenant','notes-account','note','Invalid')`)).rejects.toThrow();
  });

  it('preserves configured custom fields and pauses only affected workflows without rewriting definitions', async () => {
    const workflow = (await db.query<{ isActive: boolean; status: string; actions: unknown }>('SELECT "isActive",status,actions FROM "Workflow" WHERE id=\'notes-workflow\'')).rows[0];
    expect(workflow).toMatchObject({ isActive: false, status: 'PAUSED', actions: [{ type: 'update_field', config: { field: 'internalNotes', value: 'Keep definition' } }] });
    expect((await db.query<{ isActive: boolean }>('SELECT "isActive" FROM "Workflow" WHERE id=\'healthy-workflow\'')).rows[0].isActive).toBe(true);
    const field = (await db.query<{ definition: Record<string, unknown> }>('SELECT definition FROM "ClosingFieldDefinition" WHERE id=\'custom-note\'')).rows[0].definition;
    expect(field).toMatchObject({ groupId: 'accounts:additional-information', required: true, visibleInForm: false, visibleInDetails: true, name: 'Context' });
    const layout = (await db.query<{ value: { groups: Array<{ id: string }>; fields: Record<string, unknown> } }>('SELECT value FROM "TenantPreference" WHERE id=\'notes-layout\'')).rows[0].value;
    expect(layout.groups.some(group => group.id === 'accounts:section:4')).toBe(false);
    expect(layout.fields).not.toHaveProperty('internalNotes');
    expect(layout.fields['custom-note']).toMatchObject({ label: 'Context', visibleInForm: false, groupId: 'accounts:additional-information' });
    expect((await db.query<{ value: string }>(`SELECT value FROM "CustomFieldValue" WHERE id='note-custom-value'`)).rows[0].value).toBe('Preserve this custom value');
  });

  it('captures old writer changes, rejects unverified and inconsistent cutover, then retires only internal notes', async () => {
    await db.exec(`UPDATE "Account" SET "internalNotes"='Last old-writer value' WHERE id='notes-account'`);
    expect((await db.query('SELECT * FROM "Activity"')).rows).toHaveLength(3);
    await expect(db.exec(sql(retirement))).rejects.toThrow('ACCOUNT_NOTES_VERIFIED_CUTOVER_REQUIRED');
    await db.exec('ROLLBACK');
    await db.exec(`COMMENT ON TABLE crm_history.account_legacy_notes IS 'leadcrm-account-notes-compatible-v1:${'a'.repeat(40)}';
      UPDATE "Activity" SET description='Wrong' WHERE title='Legacy Internal Notes' AND description='Last old-writer value';`);
    await expect(db.exec(sql(retirement))).rejects.toThrow('ACCOUNT_NOTES_PRESERVATION_MISMATCH');
    await db.exec('ROLLBACK');
    await db.exec(`UPDATE "Activity" SET description='Last old-writer value' WHERE title='Legacy Internal Notes' AND description='Wrong'`);
    await db.exec(`UPDATE "Activity" SET "accountId"='merge-target' WHERE "accountId"='notes-account'`);
    await expect(db.exec(sql(retirement))).rejects.toThrow('ACCOUNT_NOTES_PRESERVATION_MISMATCH');
    await db.exec('ROLLBACK');
    await db.exec(`INSERT INTO "AuditLog"(id,"tenantId","userId",action,"entityType","entityId",metadata) VALUES ('notes-merge-proof','notes-tenant','merge-operator','account.merged','Account','merge-target','{"secondaryId":"notes-account"}')`);
    await db.exec(sql(retirement));
    const columns = (await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='Account'`)).rows.map(row => row.column_name);
    expect(columns).not.toContain('internalNotes'); expect(columns).toContain('notes');
    expect((await db.query('SELECT * FROM "Activity"')).rows).toHaveLength(3);
    await db.exec(`UPDATE "Account" SET notes='Historical storage write' WHERE id='notes-account'`);
    expect((await db.query('SELECT * FROM "Activity"')).rows).toHaveLength(4);
  });
});

it('replays all migrations into an empty disposable database', async () => {
  const empty = await PGlite.create();
  try {
    await replayCrmMigrations(empty);
    expect((await empty.query(`SELECT column_name FROM information_schema.columns WHERE table_name='Account' AND column_name='internalNotes'`)).rows).toHaveLength(0);
    expect((await empty.query('SELECT * FROM "AccountCreationReceipt"')).rows).toHaveLength(0);
  } finally { await empty.close(); }
}, 120000);
