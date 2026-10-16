// Owns a fresh loopback PostgreSQL cluster; never reads application credentials.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { notificationTestPostgres } from './notification-test-postgres.mjs';

const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const { deploymentPlan } = require('./deploy-crm-imports.cjs');
const root = resolve(import.meta.dirname, '../..');
const correction = '20261213000000_account_note_trigger_permissions';
const migrationOwner = 'account_test_migrator';
const runtimeRole = 'account_test_app';

test('Account HTTP creation with separate migration and runtime roles', { timeout: 180000 }, async t => {
  const cluster = await notificationTestPostgres();
  let owner, runtime, server;
  try {
    const database = `leadcrm_account_trigger_${Date.now()}`;
    const bootstrapUrl = await cluster.database(database, { migrate: false });
    const names = readdirSync(join(root, 'backend/prisma/migrations')).filter(name => /^\d+_/.test(name)).sort();
    // Match production: address retirement is applied; other guarded retirements
    // remain pending, including the legacy Account note and assignment columns.
    const plan = deploymentPlan(['20261028000000_retire_legacy_crm_imports', '20261202000000_retire_account_address_columns']
      .map(migration_name => ({ migration_name, finished_at: new Date() })), names);
    let source = `CREATE ROLE ${migrationOwner} LOGIN; CREATE ROLE ${runtimeRole} LOGIN;
      GRANT CREATE ON DATABASE "${database}" TO ${migrationOwner};
      GRANT ALL ON SCHEMA public TO ${migrationOwner}; SET ROLE ${migrationOwner};
      CREATE TABLE "_prisma_migrations" (id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL,
        finished_at timestamptz, migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz,
        started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0);\n`;
    for (const name of names.filter(name => name < correction && !plan.exclude.includes(name))) {
      const sql = readFileSync(join(root, 'backend/prisma/migrations', name, 'migration.sql'), 'utf8');
      source += `${sql}\nINSERT INTO "_prisma_migrations" (id,checksum,migration_name,finished_at,applied_steps_count)
        VALUES ('${randomUUID()}','${createHash('sha256').update(sql).digest('hex')}','${name}',now(),1);\n`;
    }
    source += `RESET ROLE; GRANT USAGE ON SCHEMA public TO ${runtimeRole};
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${runtimeRole};
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ${runtimeRole};
      REVOKE ALL ON "_prisma_migrations" FROM ${runtimeRole};`;
    cluster.executeSql(database, source);
    const roleUrl = role => { const url = new URL(bootstrapUrl); url.username = role; return url.toString(); };
    const env = qaEnvironment(root, {
      DATABASE_URL: roleUrl(runtimeRole), DIRECT_URL: roleUrl(migrationOwner),
      TS_NODE_PROJECT: join(root, 'backend/tsconfig.json'),
    });
    Object.assign(process.env, env);
    require('ts-node/register/transpile-only');
    const app = require('../src/app.ts').default;
    runtime = require('../src/config/database.config.ts').default;
    const { issueAuthSession } = require('../src/core/auth/auth-session.ts');
    owner = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
    const tenant = await runtime.tenant.create({ data: { name: 'Account trigger QA', slug: randomUUID(), onboardingCompletedAt: new Date() } });
    const admin = await runtime.user.create({ data: { tenantId: tenant.id, firstName: 'Account', lastName: 'Tester', email: `${randomUUID()}@camxian.com`, role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    const token = (await issueAuthSession(admin)).token;
    server = app.listen(0, '127.0.0.1');
    await new Promise(done => server.once('listening', done));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const call = async (path, method = 'GET', body, auth = token) => {
      const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    };
    const standard = { name: 'Clinical', industry: 'Healthcare', size: '51-200', website: 'https://company.com' };
    const payloads = [
      ['name only', { name: 'Clinical' }],
      ['standard fields', standard],
      ['frontend payload', { ...standard, customFieldValues: {}, tenantId: tenant.id }],
    ];
    for (const [label, payload] of payloads) await t.test(`before migration: ${label} fails at Account INSERT without residue`, async tt => {
      const errors = [];
      tt.mock.method(console, 'error', (...args) => errors.push(args));
      const result = await call('/crm/accounts', 'POST', payload);
      assert.equal(result.status, 500);
      const logged = errors.find(args => args[0] === '[Error]')?.[1];
      assert.equal(logged?.name, 'PrismaClientUnknownRequestError');
      assert.match(logged.message, /account\.create/);
      assert.match(logged.message, /42501.*permission denied for schema crm_history/);
      assert.equal(await runtime.account.count({ where: { tenantId: tenant.id } }), 0);
      assert.equal(await runtime.customFieldValue.count({ where: { tenantId: tenant.id } }), 0);
      assert.equal(await runtime.auditLog.count({ where: { tenantId: tenant.id, action: 'account.created' } }), 0);
    });

    await t.test('guarded db:deploy applies reviewed corrections and retains the private history boundary', async () => {
      const before = await owner.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
      const child = spawn(process.execPath, ['scripts/deploy-crm-imports.cjs', '--deploy'], { cwd: join(root, 'backend'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
      const code = await new Promise((done, fail) => { child.on('exit', done); child.on('error', fail); });
      assert.equal(code, 0, output);
      const after = await owner.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
      const reviewed = names.filter(name => name >= correction && !plan.exclude.includes(name));
      assert.deepEqual(after.filter(row => !before.some(prior => prior.migration_name === row.migration_name)), reviewed.map(migration_name => ({ migration_name })));
      const [trigger] = await owner.$queryRawUnsafe(`SELECT p.prosecdef, p.proconfig, r.rolname AS owner,
        has_function_privilege('${runtimeRole}',p.oid,'EXECUTE') AS runtime_execute
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
        WHERE n.nspname='crm_history' AND p.proname='preserve_account_note_write'`);
      assert.deepEqual(trigger, { prosecdef: true, proconfig: ['search_path=pg_catalog, public, pg_temp'], owner: migrationOwner, runtime_execute: false });
      const [privileges] = await runtime.$queryRawUnsafe(`SELECT has_schema_privilege(current_user,'crm_history','USAGE') AS history_usage,
        has_schema_privilege(current_user,'public','CREATE') AS public_create`);
      assert.deepEqual(privileges, { history_usage: false, public_create: false });
      await assert.rejects(runtime.$queryRawUnsafe('SELECT * FROM crm_history.account_legacy_notes'), /permission denied for schema crm_history/);
    });

    const createdIds = [];
    for (const [label, payload] of payloads) await t.test(`after migration: ${label} returns 201, persists and appears in the sorted list`, async () => {
      const result = await call('/crm/accounts', 'POST', payload);
      assert.equal(result.status, 201, JSON.stringify(result.body));
      const account = result.body.data;
      createdIds.push(account.id);
      assert.equal(account.name, 'Clinical');
      if (payload.size) assert.equal(account.size, '51-200');
      assert.equal(await runtime.auditLog.count({ where: { tenantId: tenant.id, entityId: account.id, action: 'account.created' } }), 1);
      const list = await call('/crm/accounts?page=1&pageSize=25&sort=size%3Aasc');
      assert.equal(list.status, 200); assert.equal(list.body.meta.limit, 25);
      assert.ok(list.body.data.some(row => row.id === account.id));
      assert.ok(list.body.data.every(row => row.tenantId === tenant.id));
    });

    let customAccountId;
    await t.test('required custom values return 400 and roll back the Account; valid values and audits persist', async () => {
      const definition = await call('/administration/closing-requirements', 'POST', { module: 'accounts', group: 'Basic Information', name: 'Registration code', type: 'Text', required: true });
      assert.equal(definition.status, 200, JSON.stringify(definition.body));
      const fieldId = definition.body.data.id;
      const invalid = await call('/crm/accounts', 'POST', { name: 'Missing custom value', customFieldValues: {} });
      assert.equal(invalid.status, 400, JSON.stringify(invalid.body));
      assert.match(invalid.body.error, /Registration code/);
      assert.ok(invalid.body.fieldErrors.customFieldValues?.length);
      assert.equal(await runtime.account.count({ where: { tenantId: tenant.id, name: 'Missing custom value' } }), 0);
      assert.equal(await runtime.account.count({ where: { tenantId: tenant.id } }), createdIds.length);
      assert.equal(await runtime.customFieldValue.count({ where: { tenantId: tenant.id } }), 0);
      assert.equal(await runtime.auditLog.count({ where: { tenantId: tenant.id, action: 'account.created' } }), createdIds.length);
      const valid = await call('/crm/accounts', 'POST', { ...standard, customFieldValues: { [fieldId]: 'REG-123' } });
      assert.equal(valid.status, 201, JSON.stringify(valid.body)); customAccountId = valid.body.data.id;
      const values = await call(`/crm/accounts/${customAccountId}/custom-fields`);
      assert.equal(values.body.data.values[fieldId], 'REG-123');
      assert.equal(await runtime.customFieldValue.count({ where: { tenantId: tenant.id, accountId: customAccountId, fieldId } }), 1);
      assert.equal(await runtime.auditLog.count({ where: { tenantId: tenant.id, entityId: customAccountId, action: 'account.created' } }), 1);
    });

    await t.test('note writes still create immutable history and Activity without direct runtime access', async () => {
      const result = await call(`/crm/accounts/${customAccountId}`, 'PUT', { notes: 'Historical note remains supported.' });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      const history = await owner.$queryRawUnsafe('SELECT note_value FROM crm_history.account_legacy_notes WHERE account_id=$1', customAccountId);
      assert.deepEqual(history, [{ note_value: 'Historical note remains supported.' }]);
      assert.equal(await runtime.activity.count({ where: { tenantId: tenant.id, accountId: customAccountId, title: 'Legacy Notes' } }), 1);
      await assert.rejects(owner.$executeRawUnsafe('UPDATE crm_history.account_legacy_notes SET note_value=\'changed\' WHERE account_id=$1', customAccountId), /immutable/);
      await assert.rejects(runtime.$executeRawUnsafe('DELETE FROM crm_history.account_legacy_notes WHERE account_id=$1', customAccountId), /permission denied/);
    });

    await t.test('Account lists, record reads and submitted tenant IDs remain isolated', async () => {
      const other = await runtime.tenant.create({ data: { name: 'Other Account tenant', slug: randomUUID(), onboardingCompletedAt: new Date() } });
      const user = await runtime.user.create({ data: { tenantId: other.id, firstName: 'Other', lastName: 'Admin', email: `${randomUUID()}@camxian.com`, role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
      const otherToken = (await issueAuthSession(user)).token;
      const created = await call('/crm/accounts', 'POST', { name: 'Other tenant account', customFieldValues: {}, tenantId: tenant.id }, otherToken);
      assert.equal(created.status, 201); assert.equal(created.body.data.tenantId, other.id);
      assert.equal((await call(`/crm/accounts/${createdIds[0]}`, 'GET', undefined, otherToken)).status, 404);
      const list = await call('/crm/accounts?page=1&pageSize=25&sort=size%3Aasc', 'GET', undefined, otherToken);
      assert.equal(list.status, 200); assert.deepEqual(list.body.data.map(row => row.id), [created.body.data.id]);
    });
    await t.test('the correction survives the existing separately guarded note-column retirement', async () => {
      const retirement = readFileSync(join(root, 'backend/prisma/migrations/20261210000000_retire_account_internal_notes/migration.sql'), 'utf8');
      cluster.executeSql(database, `SET ROLE ${migrationOwner};
        COMMENT ON TABLE crm_history.account_legacy_notes IS 'leadcrm-account-notes-compatible-v1:${'a'.repeat(40)}';
        ${retirement}`);
      const result = await call(`/crm/accounts/${customAccountId}`, 'PUT', { notes: 'Preserved after retirement.' });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      const history = await owner.$queryRawUnsafe('SELECT note_value FROM crm_history.account_legacy_notes WHERE account_id=$1 ORDER BY note_value', customAccountId);
      assert.deepEqual(history.map(row => row.note_value), ['Historical note remains supported.', 'Preserved after retirement.']);
      await assert.rejects(runtime.$queryRawUnsafe('SELECT * FROM crm_history.account_legacy_notes'), /permission denied for schema crm_history/);
    });
    console.log(`Verified ${cluster.version}: restricted-role HTTP reproduction, guarded migration, Account/custom-field persistence, notes, list sorting and tenant isolation.`);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
    await runtime?.$disconnect(); await owner?.$disconnect(); cluster.stop();
  }
});
