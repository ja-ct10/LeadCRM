// Disposable native PostgreSQL only; never loads application/provider credentials.
import { notificationTestPostgres, runNotificationTestFile } from './notification-test-postgres.mjs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const root = resolve(import.meta.dirname, '../..');
const pg = await notificationTestPostgres();
try {
  const rehearsal = 'leadcrm_security_migration_1';
  await pg.database(rehearsal, { before: '20261214000000' });
  pg.executeSql(rehearsal, `
    INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('preserve-tenant','Preserve','preserve',now());
    INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"passwordHash","passwordChangedAt","updatedAt")
      VALUES ('preserve-user','preserve-tenant','preserve@camxian.com','Preserve','User','Client Admin','fixture-hash',now(),now());
    INSERT INTO "ProductInterest" (id,"tenantId",name,"dealValue",active,"updatedAt") VALUES ('preserve-product','preserve-tenant','CCTV',25000,true,now());
    INSERT INTO "ProductInterest" (id,"tenantId",name,"dealValue",active,"updatedAt") VALUES ('preserve-archived','preserve-tenant','Archived catalog',12345.67,false,now());
    INSERT INTO "Pipeline" (id,"tenantId",name,"updatedAt") VALUES ('preserve-pipeline','preserve-tenant','Preserve',now());
    INSERT INTO "Stage" (id,"tenantId","pipelineId",name,"order","requiredFields") VALUES ('preserve-stage','preserve-tenant','preserve-pipeline','Lead',0,'{}');
    INSERT INTO "Deal" (id,"tenantId",title,"ownerId","pipelineId","stageId","productInterestId",value,currency,"updatedAt")
      VALUES ('preserve-deal','preserve-tenant','Preserve','preserve-user','preserve-pipeline','preserve-stage','preserve-product',25000,'PHP',now());
    INSERT INTO "LoginAttemptState" ("identityKey","failedAttempts","lockedUntil") VALUES ('preserve-identity',5,'2030-01-01T12:05:00Z');
  `);
  for (const migration of ['20261214000000_login_security_lock', '20261215000000_password_expiring_notification', '20261216000000_product_metadata']) pg.executeSql(rehearsal, readFileSync(resolve(root, 'backend/prisma/migrations', migration, 'migration.sql'), 'utf8'));
  pg.executeSql(rehearsal, `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM "ProductInterest" WHERE id='preserve-product' AND name='CCTV' AND category='CCTV' AND description='' AND "dealValue"=25000 AND active) THEN RAISE EXCEPTION 'Product data changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "ProductInterest" WHERE id='preserve-archived' AND name='Archived catalog' AND category='Archived catalog' AND "dealValue"=12345.67 AND NOT active) THEN RAISE EXCEPTION 'Archived product changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Deal" WHERE id='preserve-deal' AND "productInterestId"='preserve-product' AND value=25000 AND currency='PHP') THEN RAISE EXCEPTION 'Deal snapshot changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "LoginAttemptState" WHERE "identityKey"='preserve-identity' AND "failedAttempts"=5 AND "lockoutCycles"=1 AND "lockedUntil"='2030-01-01T12:05:00Z') THEN RAISE EXCEPTION 'Existing cooldown changed'; END IF;
    IF (SELECT count(*) FROM "NotificationEvent" WHERE type='password_expiring_soon' AND "entityId"='preserve-user') <> 1 THEN RAISE EXCEPTION 'Reminder backfill missing'; END IF;
  END $$;`);
  console.log('Migration preservation rehearsal passed (Product, Deal snapshot, existing cooldown, reminder backfill).');
  const url = await pg.database('leadcrm_login_lockout_1');
  const child = spawn(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run',
    'src/core/auth/__tests__/login-lockout.integration.test.ts', '--maxWorkers=1', '--reporter=json',
    '--outputFile=../data/outputs/system-audit/security/native-tests.json'], {
    cwd: resolve(root, 'backend'), windowsHide: true, stdio: 'inherit',
    env: qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url, LOGIN_LOCKOUT_POSTGRES_URL: url }),
  });
  process.exitCode = await new Promise((done, reject) => { child.on('exit', code => done(code ?? 1)); child.on('error', reject); });
  const expiry = await runNotificationTestFile('src/core/auth/__tests__/password-expiration.integration.test.ts', await pg.database('leadcrm_forms_test_2'));
  if (expiry) process.exitCode = expiry;
} finally { pg.stop(); }
