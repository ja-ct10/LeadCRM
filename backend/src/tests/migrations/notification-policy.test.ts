import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { replayCrmMigrations } from '../replay-crm-migrations';

it('applies the forward policy without changing notification, outbox, ledger or preference history', async () => {
  const db = await PGlite.create();
  try {
    await replayCrmMigrations(db, '20261126000000');
    await db.exec(`INSERT INTO "Tenant"(id,name,slug,"updatedAt") VALUES ('policy-history','History','policy-history',now());
      INSERT INTO "User"(id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('history-user','policy-history','history@camxian.com','History','User','Client Admin',now());
      INSERT INTO "Notification"(id,"tenantId","userId",type,title,body,"eventKey","isRead","readAt","createdAt")
        VALUES ('history-read','policy-history','history-user','customer_hot','Original Hot','Original body','history-visible',true,'2020-01-02','2020-01-01'),
          ('history-unread','policy-history','history-user','record_archived','Original archive','Original archive body',NULL,false,NULL,'2020-01-03');
      SELECT crm_enqueue_notification('policy-history','history-pending','deal_progressed','Deal','old-deal');
      SELECT crm_enqueue_notification('policy-history','history-processed','record_restored','Lead','old-lead');
      UPDATE "NotificationEvent" SET "processedAt"='2020-01-03' WHERE "eventKey"='history-processed';
      UPDATE "NotificationEvent" SET attempts=3,"lastError"='delivery_failed',"leaseToken"='old-lease',"leaseUntil"='2020-01-04' WHERE "eventKey"='history-pending';
      INSERT INTO "NotificationDelivery"("tenantId","userId","eventKey",outcome,"createdAt") VALUES ('policy-history','history-user','history-deleted','deleted','2020-01-01');
      INSERT INTO "UserPreference"(id,"tenantId","userId",module,key,value,"updatedAt") VALUES ('history-preference','policy-history','history-user','notifications','channels','{"leadAssignmentEmail":false,"dailyPipelineBriefing":false,"urgentHotLeadSms":false,"inAppGeneral":false}',now());`);
    const snapshot = async () => Promise.all(['Notification', 'NotificationEvent', 'NotificationDelivery', 'UserPreference']
      .map(async table => (await db.query(`SELECT * FROM "${table}" WHERE "tenantId"='policy-history' ORDER BY 1,2,3`)).rows));
    const before = await snapshot();
    await db.exec(await readFile(resolve(__dirname, '../../../prisma/migrations/20261126000000_notification_policy/migration.sql'), 'utf8'));
    expect(await snapshot()).toEqual(before);
    await db.exec("SELECT crm_enqueue_notification('policy-history','registered-role','role_permissions_changed','RoleDefinition','role-id')");
    await expect(db.exec("SELECT crm_enqueue_notification('policy-history','unregistered','arbitrary_security_string','User','history-user')")).rejects.toThrow();
  } finally { await db.close(); }
}, 120000);
