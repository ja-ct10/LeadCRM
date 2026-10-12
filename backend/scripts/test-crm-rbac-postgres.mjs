// Disposable native PostgreSQL cluster. Never reads DATABASE_URL or a configured server.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, existsSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createServer } from 'node:net';
const bin = process.env.LEADCRM_TEST_POSTGRES_BIN || 'C:/Program Files/PostgreSQL/17/bin';
if (process.argv.includes('--stop')) {
  const target = resolve(process.argv[process.argv.indexOf('--stop') + 1]);
  const within = relative(tmpdir(), target);
  if (isAbsolute(within) || within.includes('..') || !/^leadcrm-rbac-postgres-[^\\/]+$/.test(within)) throw Error('Stop target must be a runner-created temporary cluster.');
  const result = spawnSync(join(bin, 'pg_ctl.exe'), ['-D', join(target, 'data'), '-m', 'fast', '-w', 'stop'], { windowsHide: true, stdio: 'inherit', timeout: 40000 });
  process.exit(result.status ?? 1);
}
const directory = mkdtempSync(join(tmpdir(), 'leadcrm-rbac-postgres-'));
const data = join(directory, 'data');
function command(name, args, sql) {
  if (name !== 'psql') console.log(`Disposable PostgreSQL: ${name} ${args.at(-1)}`);
  const log = name === 'psql' ? undefined : openSync(join(directory, `${name}.log`), 'a');
  const result = spawnSync(join(bin, name + (process.platform === 'win32' ? '.exe' : '')), args,
    { windowsHide: true, encoding: 'utf8', input: sql, ...(log !== undefined ? { stdio: ['ignore', log, log] } : {}), timeout: 40000 });
  if (log !== undefined) closeSync(log);
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout || readFileSync(join(directory, `${name}.log`), 'utf8'));
  return result.stdout;
}
const reservation = createServer();
await new Promise(done => reservation.listen(0, '127.0.0.1', done));
const port = reservation.address().port;
await new Promise(done => reservation.close(done));
const modes = ['--permissions', '--workflow', '--completion', '--custom-fields', '--campaigns', '--login-lockout', '--contact-retirement'].filter(mode => process.argv.includes(mode));
if (modes.length > 1) throw new Error('Choose one disposable database mode.');
const database = modes[0] === '--permissions' ? `leadcrm_environment_test_${process.pid}`
  : modes[0] === '--workflow' ? `leadcrm_workflow_test_${process.pid}`
  : modes[0] === '--completion' ? 'leadcrm_completion_test_1'
  : modes[0] === '--custom-fields' ? 'leadcrm_custom_fields_test'
  : modes[0] === '--campaigns' ? `leadcrm_campaign_test_${process.pid}`
  : modes[0] === '--login-lockout' ? `leadcrm_login_lockout_${process.pid}`
  : modes[0] === '--contact-retirement' ? `leadcrm_contact_retirement_${process.pid}` : 'leadcrm_forms_test_2';
let started = false;
try {
  command('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C']);
  started = true;
  command('pg_ctl', ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start']);
  const connection = ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'];
  command('psql', [...connection, '-d', 'postgres'], `CREATE DATABASE "${database}";`);
  command('psql', [...connection, '-d', database], 'CREATE TABLE "_prisma_migrations" (migration_name text, finished_at timestamptz, rolled_back_at timestamptz);');
  const migrations = resolve(import.meta.dirname, '../prisma/migrations');
  for (const name of modes[0] === '--contact-retirement' ? [] : readdirSync(migrations).sort()) {
    const file = join(migrations, name, 'migration.sql');
    if (!existsSync(file)) continue;
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Unexpected migration identifier');
    command('psql', [...connection, '-d', database], readFileSync(file, 'utf8') + `\nINSERT INTO "_prisma_migrations" (migration_name, finished_at) VALUES ('${name}', now());`);
  }
  const url = `postgresql://postgres@127.0.0.1:${port}/${database}?connection_limit=8`;
  const suites = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const childArgs = modes[0] === '--contact-retirement' ? [resolve(import.meta.dirname, 'test-contact-retirement.mjs')]
    : process.argv.includes('--browser') ? [resolve(import.meta.dirname, 'verify-crm-rbac-browser.mjs')]
    : [resolve(import.meta.dirname, '../../node_modules/vitest/vitest.mjs'), 'run', '--no-file-parallelism', '--silent=true',
      ...(process.argv.includes('--all') ? [] : suites.length ? suites : ['src/modules/crm/access/crm-record-access.integration.test.ts'])];
  const child = spawn(process.execPath, childArgs, {
    cwd: resolve(import.meta.dirname, '..'), windowsHide: true, stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, DIRECT_URL: url,
      ...(modes[0] === '--login-lockout' ? { LOGIN_LOCKOUT_POSTGRES_URL: url } : {}),
      ...(modes[0] === '--contact-retirement' ? { CONTACT_RETIREMENT_TEST_DATABASE_URL: url, CONTACT_RETIREMENT_TEST_PSQL: join(bin,'psql.exe') } : {}),
      JWT_SECRET: 'crm-rbac-isolated-test-only', BREVO_API_KEY: '', BREVO_SMS_SENDER: '', ENCRYPTION_KEY: 'a'.repeat(64) },
  });
  process.exitCode = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
} finally {
  if (started) command('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  console.log('Disposable PostgreSQL stopped; diagnostic files retained at:', directory);
}
