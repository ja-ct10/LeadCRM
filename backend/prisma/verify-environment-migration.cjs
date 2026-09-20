// Creates a NEW disposable local database. Never touches the configured application DB.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const name = `leadcrm_environment_test_${Date.now()}`;
const url = `postgresql://postgres@localhost:5432/${name}`;
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, JWT_SECRET: 'disposable-environment-test-secret', NODE_ENV: 'test' };
const psql = (database, sql) => execFileSync('psql', ['-h', 'localhost', '-U', 'postgres', '-d', database, '-w', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', windowsHide: true });
const cli = require.resolve('prisma/build/index.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leadcrm-environment-'));
const before = path.join(tmp, 'before.prisma');
const current = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf8').replace(/\r\n/g, '\n');
fs.writeFileSync(before, current.replace(/enum CrmEnvironment \{[^}]+\}\s*/g, '')
  .replace(/^\s*activeEnvironment CrmEnvironment.*\n/gm, '\n')
  .replace(/^\s*environment CrmEnvironment.*\n/gm, '\n')
  .replace(/^\s*@@index\(\[tenantId, environment\]\).*\n/gm, '\n'));
try {
  psql('postgres', `CREATE DATABASE "${name}";`);
  const baseline = execFileSync(process.execPath, [cli, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', before, '--script'], { env, encoding: 'utf8', windowsHide: true });
  psql(name, baseline);
  psql(name, `INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('legacy-tenant','Legacy','legacy',NOW());
    INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('legacy-user','legacy-tenant','legacy@camxian.com','Legacy','User','User',NOW());
    INSERT INTO "Account" (id,"tenantId",name,tags,"productInterests","activeProducts","updatedAt") VALUES ('legacy-account','legacy-tenant','Existing account','{}','{}','{}',NOW());`);
  psql(name, fs.readFileSync(path.join(__dirname, 'migrations/20261002000000_crm_environments/migration.sql'), 'utf8'));
  assert.match(psql(name, `SELECT environment FROM "Account" WHERE id='legacy-account'`), /PRODUCTION/);
  assert.match(psql(name, `SELECT "activeEnvironment" FROM "User" WHERE id='legacy-user'`), /SANDBOX/);
  execFileSync(process.execPath, [cli, 'migrate', 'diff', '--from-schema-datasource', path.join(__dirname, 'schema.prisma'), '--to-schema-datamodel', path.join(__dirname, 'schema.prisma'), '--exit-code'], { env, stdio: 'inherit', windowsHide: true });
  execFileSync(process.execPath, [path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run', 'src/core/environment/__tests__/environment.integration.test.ts'], { cwd: path.join(__dirname, '..'), env, stdio: 'inherit', windowsHide: true });
  console.log(`PASS: migration preserves legacy records; schema matches; integration tests pass. Disposable database retained: ${name}`);
} finally {
  fs.unlinkSync(before);
  fs.rmdirSync(tmp);
}
