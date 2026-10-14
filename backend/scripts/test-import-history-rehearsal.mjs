// Populated historical import migration + real authenticated HTTP verification.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
const root = resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url), { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const native = process.argv.includes('--native');
const cluster = native ? await notificationTestPostgres() : undefined;
const databaseName = 'leadcrm_forms_test_2';
const nativeUrl = cluster ? await cluster.database(databaseName, { migrate: false }) : undefined;
const literal = value => typeof value === 'number' ? String(value) : value === null ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'";
const db = cluster ? {
  exec: source => cluster.executeSql(databaseName, source),
  query: (source, parameters = []) => cluster.executeSql(databaseName, source.replace(/\$(\d+)/g, (_, number) => literal(parameters[Number(number) - 1]))),
  close: () => cluster.stop(),
} : await PGlite.create();
let socket;
try {
  const expansion = '20261027000000_crm_import_integrity', retirement = '20261028000000_retire_legacy_crm_imports';
  await replayCrmMigrations(db, { before: expansion });
  await db.exec(`INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('import-rollout-tenant','Historical import rehearsal','historical-import-rehearsal',now());
    INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('import-rollout-actor','import-rollout-tenant','history@camxian.com','History','Tester','Client Admin',now());`);
  for (const module of ['Lead', 'Contact', 'Account', 'Deal']) {
    const jobs = module === 'Lead' ? 2 : 1, rows = module === 'Lead' ? 4 : 2;
    for (let index = 0; index < jobs; index++) {
      const id = `${module}-historic-${index}`;
      await db.query(`INSERT INTO "${module}Import" (id,"tenantId","createdById","fileName","totalRecords","successfulRecords","failedRecords",status,"createdAt","completedAt") VALUES ($1,'import-rollout-tenant','import-rollout-actor','historical.csv',$2,$3,1,'completed_with_errors','2026-09-01','2026-09-02')`, [id, rows, rows - 1]);
      for (let row = 0; row < rows; row++) {
        const columns = module === 'Deal' ? ',data' : module === 'Account' ? ',name,industry' : ',"firstName",email';
        const values = module === 'Deal' ? `,'{"title":"Original Deal","resolvedValue":"25000","nested":{"keep":true}}'` : module === 'Account' ? `,'Historical Acme',NULL` : `,'José','ORIGINAL@example.test'`;
        await db.query(`INSERT INTO "${module}ImportResult" (id,"importId","rowNumber",status,remarks,"createdAt"${columns}) VALUES ($1,$2,$3,$4,$5,'2026-09-02'${values})`, [`${id}-${row}`, id, row + 2, row ? 'imported' : 'failed', row ? null : 'Original failure reason']);
      }
    }
  }
  await replayCrmMigrations(db, { from: expansion, before: retirement });
  // Keep the original readonly tables/views so the authenticated verifier can
  // compare every migrated payload before a real retirement approval.
  await replayCrmMigrations(db, { from: retirement, exclude: [retirement,
    '20261102000000_retire_relationship_compatibility',
    '20261110000000_retire_unused_crm_columns',
    '20261112000000_retire_lead_nonform_columns',
    '20261129000000_retire_contact_obsolete_columns'] });
  await db.exec(`UPDATE "Tenant" SET status='ACTIVE',"onboardingStep"=3,"onboardingCompletedAt"=now() WHERE id='import-rollout-tenant';
    UPDATE "User" SET status='ACTIVE',"mustChangePassword"=false,"onboardingCompletedAt"=now() WHERE id='import-rollout-actor';`);
  // Added nullable columns must preserve original payload comparison and must not
  // permit a changed historical field or invented source provenance.
  for (const mutation of [
    `UPDATE "CrmImportJob" SET "fileName"='changed.csv' WHERE id='Lead-historic-0'`,
    `UPDATE "CrmImportRowResult" SET remarks='changed reason' WHERE id='Lead-historic-0-0'`,
    `UPDATE "CrmImportRowResult" SET data='{"title":"Changed historical Deal"}' WHERE id='Deal-historic-0-0'`,
    `UPDATE "CrmImportJob" SET "sourceDigest"='invented',"sourceReference"='invented' WHERE id='Lead-historic-0'`,
  ]) {
    try {
      await assert.rejects(async () => db.exec(`BEGIN; ${mutation}; SELECT * FROM crm_verify_import_normalization(); ROLLBACK;`), /Import (?:job|result) migration mismatch/);
    } finally { await db.exec('ROLLBACK;'); }
    await db.exec('SELECT * FROM crm_verify_import_normalization();');
  }
  console.log('[qa] Historical verifier rejects changed job, result and invented source identity; rollback restores exact preserved payloads.');
  if (!native) { socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 }); await socket.start(); }
  const url = nativeUrl ?? `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_forms_test_2?connection_limit=1&statement_cache_size=0`;
  const output = resolve(root, 'data/outputs/system-audit/import-history'); mkdirSync(output, { recursive: true });
  const reportPath = process.env.LEADCRM_IMPORT_HISTORY_REPORT || resolve(output, 'results-' + Date.now() + '.json');
  const child = spawn(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', 'src/modules/crm/imports/imports.integration.test.ts', '--maxWorkers=1', '--reporter=default', '--reporter=json', '--outputFile=' + reportPath], {
    cwd: resolve(root, 'backend'), windowsHide: true, stdio: 'inherit', env: qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url, CRM_IMPORT_ROLLOUT_TEST: '1' }),
  });
  const code = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
  const result = JSON.parse(readFileSync(reportPath, 'utf8'));
  const assertions = result.testResults.flatMap(suite => suite.assertionResults);
  const historical = assertions.find(test => test.fullName.includes('verifies migrated History through deployed APIs'));
  assert.equal(code, 0); assert.equal(historical?.status, 'passed');
  assert.ok(assertions.length > 0 && assertions.every(test => test.status === 'passed'), 'Every populated import assertion must execute successfully');
  console.log(JSON.stringify({ status: 'PASS', database: `Populated disposable ${native ? 'native PostgreSQL' : 'PGlite'}, guarded retirement deferred`, passed: assertions.length, failed: 0, skipped: 0, report: reportPath }));
} finally {
  await socket?.stop(); await db.close();
}
