import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { DEFAULT_CLOSING_FIELDS } from '@leadcrm/shared';
import { replayCrmMigrations } from '../replay-crm-migrations';
const name = '20261203000000_optional_closed_won_defaults';
const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations', name, 'migration.sql'), 'utf8');

it('corrects only untouched required defaults and preserves tenant customizations, values and evidence', async () => {
  const db = await PGlite.create();
  try {
    await replayCrmMigrations(db, name);
    await db.exec(`INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('default','Default','default',now()), ('edited','Edited','edited',now()), ('audited','Audited','audited',now());
      INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('admin','audited','admin@example.test','Admin','Test','Client Admin',now());`);
    for (const tenant of ['default', 'edited', 'audited']) {
      for (const original of DEFAULT_CLOSING_FIELDS) {
        const definition = { ...original, technicalAlias: original.id, required: ['confirmation-type', 'confirmation-date'].includes(original.id), ...(tenant === 'edited' && original.id === 'confirmation-type' ? { version: 2 } : {}), ...(tenant === 'edited' && original.id === 'confirmation-date' ? { name: 'Admin date' } : {}) };
        await db.query('INSERT INTO "ClosingFieldDefinition" ("tenantId",id,definition,"updatedAt") VALUES ($1,$2,$3,now())', [tenant, original.id, JSON.stringify(definition)]);
      }
      await db.query('INSERT INTO "TenantPreference" (id,"tenantId",module,key,value,"updatedAt") VALUES ($1,$2,\'deals\',\'field-layout\',\'{"version":1,"revision":4}\',now())', [tenant, tenant]);
    }
    await db.exec(`INSERT INTO "AuditLog" (id,"tenantId","userId",action,"entityType","entityId") VALUES ('audit','audited','admin','closing_field.updated','ClosingField','confirmation-type');`);
    await db.exec(`INSERT INTO "Pipeline" (id,"tenantId",name,"updatedAt") VALUES ('pipeline','default','Sales',now());
      INSERT INTO "Stage" (id,"tenantId","pipelineId",name,"order") VALUES ('stage','default','pipeline','Qualified',0);
      INSERT INTO "Deal" (id,"tenantId","pipelineId","stageId",title,"closingValues","closingSnapshot","updatedAt") VALUES ('deal','default','pipeline','stage','Preserved evidence','{"confirmation-date":"2024-01-01"}','{"fields":[],"values":{"confirmation-date":"2024-01-01"}}',now());
      INSERT INTO "CustomFieldValue" (id,"tenantId","fieldId",module,"dealId",value,"updatedAt") VALUES ('value','default','confirmation-date','deals','deal','"2024-01-01"',now());`);
    const evidence = (await db.query('SELECT * FROM "Deal"')).rows;
    const values = (await db.query('SELECT * FROM "CustomFieldValue"')).rows;
    const before = (await db.query('SELECT "tenantId",id,definition FROM "ClosingFieldDefinition" ORDER BY "tenantId",id')).rows;
    await db.exec(sql);
    const after = (await db.query<{ tenantId: string; id: string; definition: { required: boolean; version: number } }>('SELECT "tenantId",id,definition FROM "ClosingFieldDefinition" ORDER BY "tenantId",id')).rows;
    const corrected = new Set(['default:confirmation-type', 'default:confirmation-date', 'audited:confirmation-date']);
    after.forEach((row, index) => expect(row).toEqual(corrected.has(`${row.tenantId}:${row.id}`) ? { ...before[index], definition: { ...(before[index].definition as object), required: false, version: 2 } } : before[index]));
    expect((await db.query('SELECT "tenantId",value FROM "TenantPreference" ORDER BY "tenantId"')).rows).toEqual([{ tenantId: 'audited', value: { version: 1, revision: 5 } }, { tenantId: 'default', value: { version: 1, revision: 5 } }, { tenantId: 'edited', value: { version: 1, revision: 4 } }]);
    await db.exec(sql);
    expect((await db.query('SELECT "tenantId",id,definition FROM "ClosingFieldDefinition" ORDER BY "tenantId",id')).rows).toEqual(after);
    expect((await db.query('SELECT * FROM "Deal"')).rows).toEqual(evidence);
    expect((await db.query('SELECT * FROM "CustomFieldValue"')).rows).toEqual(values);
  } finally { await db.close(); }
}, 60000);
