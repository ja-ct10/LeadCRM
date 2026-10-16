import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { replayCrmMigrations } from '../replay-crm-migrations';

it('allows assignment context deployment while unrelated compatibility retirements remain deferred', () => {
  const { deploymentPlan } = createRequire(__filename)('../../../scripts/deploy-crm-imports.cjs');
  const names = readdirSync(resolve(__dirname, '../../../prisma/migrations')).filter(name => /^\d+_/.test(name));
  const plan = deploymentPlan([{ migration_name: '20261028000000_retire_legacy_crm_imports', finished_at: new Date() }], names);
  expect(plan.through).toBe(names.sort().at(-1));
  expect(plan.exclude).toContain('20261102000000_retire_relationship_compatibility');
  expect(plan.exclude).toContain('20261202000000_retire_account_address_columns');
  expect(plan.exclude).toContain('20261208000000_retire_account_fields');
  expect(plan.exclude).not.toContain('20261206000000_assignment_notification_context');
});

it('updates only the producer function without changing notification, outbox, ledger or preference history', async () => {
  const db = await PGlite.create();
  try {
    await replayCrmMigrations(db, '20261206000000');
    await db.exec(`INSERT INTO "Tenant"(id,name,slug,"updatedAt") VALUES ('assignment-history','History','assignment-history',now());
      INSERT INTO "User"(id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('history-user','assignment-history','history@camxian.com','History','User','Sales',now());
      INSERT INTO "Notification"(id,"tenantId","userId",type,title,body,"eventKey","isRead","readAt","createdAt")
        VALUES ('history-read','assignment-history','history-user','lead_assigned','Original title','Original body','assignment:history',true,'2020-01-02','2020-01-01');
      SELECT crm_enqueue_notification('assignment-history','assignment:pending','lead_assigned','Lead','old-lead','history-user');
      UPDATE "NotificationEvent" SET attempts=3,"lastError"='delivery_failed',"leaseToken"='old-lease',"leaseUntil"='2020-01-04' WHERE "eventKey"='assignment:pending';
      INSERT INTO "NotificationDelivery"("tenantId","userId","eventKey",outcome) VALUES ('assignment-history','history-user','assignment:deleted','deleted');
      INSERT INTO "UserPreference"(id,"tenantId","userId",module,key,value,"updatedAt") VALUES ('history-pref','assignment-history','history-user','notifications','channels','{"inAppGeneral":false}',now());`);
    const snapshot = () => Promise.all(['Notification', 'NotificationEvent', 'NotificationDelivery', 'UserPreference'].map(async table => (await db.query(`SELECT * FROM "${table}" WHERE "tenantId"='assignment-history' ORDER BY 1,2,3`)).rows));
    const before = await snapshot();
    await db.exec(readFileSync(resolve(__dirname, '../../../prisma/migrations/20261206000000_assignment_notification_context/migration.sql'), 'utf8'));
    expect(await snapshot()).toEqual(before);
  } finally { await db.close(); }
});
