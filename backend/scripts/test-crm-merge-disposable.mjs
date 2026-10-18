// Upgrade the populated current-main schema, then exercise the combined features.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
const root = resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
let sequence = 0;
function runTest(file, url) {
  const report = resolve(root, `data/outputs/system-audit/crm-merge-${++sequence}.json`);
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', file, '--maxWorkers=1', '--reporter=default', '--reporter=json', `--outputFile=${report}`], {
    cwd: resolve(root, 'backend'), env: qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url }), windowsHide: true, stdio: 'inherit', timeout: 300000,
  });
  assert.equal(result.status, 0, `${file} failed`);
  const counts = JSON.parse(readFileSync(report, 'utf8'));
  assert.ok(counts.numPassedTests > 0, `${file} did not execute acceptance assertions`);
  assert.equal(counts.numPendingTests, 0, `${file} skipped required acceptance assertions`);
  assert.equal(counts.numFailedTests, 0, `${file} has failed assertions`);
}
const pg = await notificationTestPostgres();
try {
  const database = 'leadcrm_crm_merge_1';
  const url = await pg.database(database, { before: '20261217000000_inquiry_status' });
  pg.executeSql(database, `
    INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('merge-tenant','Merge fixture','merge-fixture',now());
    INSERT INTO "ProductInterest" (id,"tenantId",name,category,description,"dealValue","updatedAt")
      VALUES ('merge-product','merge-tenant','Existing product',repeat('C',200),'Preserved description',12345.67,now());
    INSERT INTO "Lead" (id,"tenantId","firstName","lastName",status,"updatedAt") VALUES ('merge-lead','merge-tenant','Existing','Lead','Warm',now());
    INSERT INTO "Contact" (id,"tenantId","firstName","lastName","companyName",status,"updatedAt") VALUES ('merge-contact','merge-tenant','Existing','Contact','Existing Company','WARM',now());
  `);
  const deployed = spawnSync(process.execPath, [resolve(root, 'backend/scripts/deploy-crm-imports.cjs'), '--deploy'], {
    cwd: resolve(root, 'backend'), env: qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url }), windowsHide: true, stdio: 'inherit', timeout: 180000,
  });
  assert.equal(deployed.status, 0, 'Guarded upgrade from current main must succeed.');
  pg.executeSql(database, `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM "ProductInterest" WHERE id='merge-product' AND category=repeat('C',200) AND description='Preserved description' AND "dealValue"=12345.67) THEN RAISE EXCEPTION 'Existing Product metadata changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Lead" WHERE id='merge-lead' AND status='Warm') THEN RAISE EXCEPTION 'Existing Lead status changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Contact" WHERE id='merge-contact' AND status='WARM' AND "companyName"='Existing Company') THEN RAISE EXCEPTION 'Existing Contact changed'; END IF;
  END $$;`);
  console.log('Populated current-main migration upgrade passed; categories, descriptions, prices, company names and statuses preserved.');
  for (const [file, fixture] of [
    ['src/modules/crm/__tests__/classification.integration.test.ts', null],
    ['src/modules/crm/contacts-v2/__tests__/company-name.test.ts', null],
    ['src/modules/marketing/campaigns/__tests__/quotations.integration.test.ts', 'leadcrm_quotation_test_1'],
    ['src/modules/operations/tasks/__tests__/tasks.integration.test.ts', 'leadcrm_workflow_test_1'],
  ]) {
    // Each suite deliberately requires its own disposable database name.
    const testUrl = fixture ? await pg.database(fixture) : url;
    runTest(file, testUrl);
  }
} finally { await pg.stop(); }
