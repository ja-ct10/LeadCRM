import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
async function runSuite(file, url) {
  const root = resolve(import.meta.dirname, '../..');
  const report = join(tmpdir(), `leadcrm-sms-${process.pid}-${file.split('/').at(-1)}.json`);
  const child = spawn(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', file, '--maxWorkers=1', '--silent', '--reporter=json', `--outputFile=${report}`], {
    cwd: resolve(root, 'backend'), windowsHide: true, stdio: 'inherit', env: qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url }),
  });
  const code = await new Promise((done, fail) => { child.on('exit', code => done(code ?? 1)); child.on('error', fail); });
  const result = JSON.parse(readFileSync(report, 'utf8'));
  console.log(`${file}: ${result.numPassedTests} PASS / ${result.numFailedTests} FAIL / ${result.numPendingTests} SKIPPED`);
  for (const suite of result.testResults) for (const test of suite.assertionResults) if (test.status === 'failed') console.log('FAIL:', test.fullName, test.failureMessages.join('\n'));
  return code;
}

// This harness creates a fresh loopback-only PostgreSQL cluster. It never reads
// application .env credentials or connects to an existing database.
const pg = await notificationTestPostgres();
const migration = '20261205000000_sms_campaign_outcomes';
try {
  console.log('Native PostgreSQL:', pg.version, JSON.stringify(pg.durability));
  const database = 'leadcrm_sms_migration_1';
  await pg.database(database, { migrate: false });
  const directory = resolve(import.meta.dirname, '../prisma/migrations');
  const history = ['CREATE TABLE "_prisma_migrations" (migration_name text, finished_at timestamptz, rolled_back_at timestamptz);'];
  for (const name of readdirSync(directory).sort().filter(name => name < migration)) {
    history.push(readFileSync(resolve(directory, name, 'migration.sql'), 'utf8'), `INSERT INTO "_prisma_migrations" VALUES ('${name}',now(),NULL);`);
  }
  pg.executeSql(database, history.join('\n'));
  pg.executeSql(database, `
    INSERT INTO "Tenant"(id,name,slug,"updatedAt") VALUES ('sms-history','SMS History','sms-history',now());
    INSERT INTO "User"(id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('sms-history-user','sms-history','history@camxian.com','SMS','History','Client Admin',now());
    INSERT INTO "Notification"(id,"tenantId","userId",type,title,"eventKey","isRead","createdAt") VALUES ('sms-history-notification','sms-history','sms-history-user','campaign_failed','Original failure','old-result',true,'2020-01-01');
    INSERT INTO "NotificationDelivery"("tenantId","userId","eventKey",outcome,"createdAt") VALUES ('sms-history','sms-history-user','deleted-result','deleted','2020-01-01');
    INSERT INTO "Campaign"(id,"tenantId",name,type,status,"recipientCount","createdById","submissionStartedAt","submissionFinishedAt","updatedAt")
      VALUES ('sms-history-campaign','sms-history','Original SMS','SMS','SENDING',1,'sms-history-user',now(),now(),now());
    INSERT INTO "CampaignContact"(id,"tenantId","campaignId",phone,"messageId",status,"submittedAt")
      VALUES ('sms-history-recipient','sms-history','sms-history-campaign','+639171234567','66f7c3a8b1c2d3e4f5a6b7c0','submitted',now());
    INSERT INTO "SmsWebhookReceipt"("idempotencyKey","tenantId","campaignContactId") VALUES ('sms-history-receipt','sms-history','sms-history-recipient');
    CREATE TABLE sms_history_snapshot AS SELECT jsonb_build_object(
      'notifications',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM "Notification" n),
      'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM "NotificationEvent" e),
      'smsReceipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY "idempotencyKey") FROM "SmsWebhookReceipt" r),
      'deliveries',(SELECT jsonb_agg(to_jsonb(d) ORDER BY "eventKey") FROM "NotificationDelivery" d)) AS value;
  `);
  pg.executeSql(database, readFileSync(resolve(directory, migration, 'migration.sql'), 'utf8'));
  pg.executeSql(database, `DO $$ BEGIN
    IF (SELECT value FROM sms_history_snapshot) IS DISTINCT FROM jsonb_build_object(
      'notifications',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM "Notification" n),
      'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM "NotificationEvent" e),
      'smsReceipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY "idempotencyKey") FROM "SmsWebhookReceipt" r),
      'deliveries',(SELECT jsonb_agg(to_jsonb(d) ORDER BY "eventKey") FROM "NotificationDelivery" d))
    THEN RAISE EXCEPTION 'SMS migration modified historical notifications'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "CampaignContact" WHERE id='sms-history-recipient' AND status='submitted'
      AND phone='+639171234567' AND "messageId"='66f7c3a8b1c2d3e4f5a6b7c0' AND "nextSmsCheckAt" IS NOT NULL AND "smsCheckAttempts"=0)
    THEN RAISE EXCEPTION 'SMS migration changed a receipt or omitted its read-only verification'; END IF;
  END $$;`);
  console.log('PASS: forward migration preserves notification/outbox/delivery history');
  for (const file of process.argv.length > 2 ? process.argv.slice(2) : [
    'src/modules/marketing/campaigns/__tests__/sms-tracking.integration.test.ts',
    'src/modules/marketing/campaigns/__tests__/campaigns.integration.test.ts',
    'src/modules/notifications/notification-delivery.integration.test.ts',
    'src/modules/notifications/notification-policy.integration.test.ts',
  ]) {
    const name = file.includes('campaigns') ? 'leadcrm_campaign_test_2' : 'leadcrm_forms_test_2';
    const code = await runSuite(file, await pg.database(name));
    if (code) process.exitCode = code;
  }
} finally { pg.stop(); }
