// Synthetic, loopback-only PostgreSQL. Never uses application .env or providers.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { cpSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { notificationTestPostgres } from './notification-test-postgres.mjs';

const root = resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run the guarded startup rehearsal through npm run test:integration:native');
if (process.platform === 'linux') assert.notEqual(process.getuid(), 0, 'Native runner must initialize PostgreSQL as an unprivileged user');
const pg = await notificationTestPostgres();
const name = 'leadcrm_startup_test_1';
const deferred = ['20261102000000_retire_relationship_compatibility', '20261110000000_retire_unused_crm_columns', '20261112000000_retire_lead_nonform_columns', '20261129000000_retire_contact_obsolete_columns', '20261130000000_remove_contact_job_title', '20261202000000_retire_account_address_columns', '20261208000000_retire_account_fields'];
const pending = '20261204000000_workflow_stage_entry_identity';
let env;
const checks = [];
let server;
const run = args => spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 120000 });
try {
  const url = await pg.database(name, { before: pending, exclude: deferred });
  env = qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url });
  pg.executeSql(name, `INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('startup','Startup QA','startup',now());
    INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('actor','startup','actor@example.test','QA','Actor','Client Admin',now());
    INSERT INTO "Pipeline" (id,"tenantId",name,"updatedAt") VALUES ('pipeline','startup','Existing Sales',now());
    INSERT INTO "Stage" (id,"tenantId","pipelineId",name,"order","requiredFields") VALUES ('stage','startup','pipeline','Lead',0,ARRAY[]::text[]);
    INSERT INTO "Deal" (id,"tenantId",title,"pipelineId","stageId","ownerId","updatedAt") VALUES ('deal','startup','Preserved deal','pipeline','stage','actor',now());
    INSERT INTO "Account" (id,"tenantId",name,"assignedUserId","productInterests","activeProducts","updatedAt") VALUES ('startup-account','startup','Preserved Account','actor',ARRAY['Unresolved interest'],ARRAY['Historical purchase'],now());`);
  const before = pg.executeSql(name, `SELECT row_to_json(h) FROM "DealStageHistory" h ORDER BY id;`);
  const deploy = run([npmCli, '--prefix', 'backend', 'run', 'db:deploy']);
  assert.equal(deploy.status, 0, deploy.stdout + deploy.stderr);
  assert.equal(pg.executeSql(name, `SELECT row_to_json(h) FROM "DealStageHistory" h ORDER BY id;`), before);
  assert.match(pg.executeSql(name, `SELECT title,"currentStageHistoryId" IS NOT NULL FROM "Deal" WHERE id='deal';`), /Preserved deal\s*\| t/);
  for (const migration of deferred) assert.match(pg.executeSql(name, `SELECT count(*) FROM "_prisma_migrations" WHERE migration_name='${migration}';`), /\b0\b/);
  assert.match(pg.executeSql(name, `SELECT column_name FROM information_schema.columns WHERE table_name='Deal' AND column_name='leadId';`), /leadId/);
  assert.match(pg.executeSql(name, `SELECT column_name FROM information_schema.columns WHERE table_name='Account' AND column_name='assignedUserId';`), /assignedUserId/);
  assert.match(pg.executeSql(name, `SELECT retired_values->>'assignedUserId',retired_values->'productInterests',retired_values->'activeProducts' FROM crm_history.account_retired_values WHERE account_id='startup-account';`), /actor\s*\| \["Unresolved interest"\]\s*\| \["Historical purchase"\]/);
  checks.push('Real db:deploy applies the reviewed pending migration, preserves CRM/history and defers retirement');
  // Actual guard against a future unreviewed pending migration, using an owned
  // copy of the release. The workspace migration inventory remains untouched.
  const copy = resolve(env.TEMP, 'unreviewed-release');
  mkdirSync(resolve(copy, 'scripts'), { recursive: true });
  cpSync(resolve(root, 'backend/prisma'), resolve(copy, 'prisma'), { recursive: true });
  for (const script of ['deploy-crm-imports.cjs', 'verify-crm-import-rollout.cjs', 'verify-crm-import-browser.cjs']) cpSync(resolve(root, 'backend/scripts', script), resolve(copy, 'scripts', script));
  const unexpected = resolve(copy, 'prisma/migrations/20261205000000_unreviewed');
  mkdirSync(unexpected); writeFileSync(resolve(unexpected, 'migration.sql'), 'CREATE TABLE must_not_be_created (id integer);');
  const rejection = spawnSync(process.execPath, [resolve(copy, 'scripts/deploy-crm-imports.cjs'), '--deploy'], { cwd: copy, env: { ...env, NODE_PATH: resolve(root, 'node_modules') }, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.notEqual(rejection.status, 0);
  assert.match(rejection.stderr, /REVIEW_MIGRATIONS_AFTER_DEFERRED_RELATIONSHIP_RETIREMENT/);
  assert.match(pg.executeSql(name, `SELECT to_regclass('public.must_not_be_created') IS NULL;`), /\bt\b/);
  assert.equal(realpathSync(copy), resolve(realpathSync(env.TEMP), 'unreviewed-release'));
  rmSync(copy, { recursive: true });
  checks.push('Real startup guard refuses an unreviewed pending migration before any SQL is applied');
  const probe = createServer(); await new Promise(done => probe.listen(0, '127.0.0.1', done));
  const port = probe.address().port; await new Promise(done => probe.close(done));
  server = spawn(process.execPath, [resolve(root, 'backend/dist/start.js')], { cwd: resolve(root, 'backend'), env: { ...env, PORT: String(port), SOURCE_COMMIT: 'a'.repeat(40) }, stdio: 'ignore', windowsHide: true });
  let health;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw Error('Backend startup exited before readiness');
    try { health = await (await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: AbortSignal.timeout(1000) })).json(); if (health.status === 'ok') break; } catch { /* bounded readiness */ }
    await delay(500);
  }
  assert.equal(health?.commit, 'a'.repeat(40));
  checks.push('Built backend starts after guarded deployment and serves its runtime release identity');
} finally {
  try {
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(done => server.once('exit', done));
      server.kill('SIGTERM'); await Promise.race([exited, delay(5000)]);
      if (server.exitCode === null && server.signalCode === null) { server.kill('SIGKILL'); await Promise.race([exited, delay(5000)]); }
      assert.ok(server.exitCode !== null || server.signalCode !== null, 'Owned backend process must exit before fixture shutdown');
    }
  } finally { pg.stop(); }
}
console.log(JSON.stringify({ status: 'PASS', passed: checks.length, failed: 0, skipped: 0, version: pg.version, durability: pg.durability, checks }));
