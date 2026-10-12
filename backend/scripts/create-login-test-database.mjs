// Local disposable PostgreSQL only. Does not read .env or connect to production.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function createLoginTestDatabase() {
  const psql = process.env.LOGIN_QA_PSQL || 'C:/Program Files/PostgreSQL/17/bin/psql.exe';
  const admin = process.env.LOGIN_QA_POSTGRES_ADMIN_URL || 'postgresql://login_qa@127.0.0.1:55439/postgres';
  const target = new URL(admin);
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/postgres') throw new Error('Local disposable cluster required');
  const name = `leadcrm_login_lockout_${randomUUID().replaceAll('-', '')}`;
  const run = (url, sql) => execFileSync(psql, [url, '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  run(admin, `CREATE DATABASE "${name}"`);
  target.pathname = `/${name}`;
  const url = target.href;
  run(url, 'CREATE TABLE "_prisma_migrations" (migration_name text, finished_at timestamptz, rolled_back_at timestamptz)');
  const directory = resolve(fileURLToPath(new URL('../prisma/migrations/', import.meta.url)));
  for (const migration of readdirSync(directory).sort()) {
    const file = resolve(directory, migration, 'migration.sql');
    if (!/^\d+_/.test(migration) || !existsSync(file)) continue;
    // Only the disposable fixture attests its migration replay; production
    // authenticated retirement guards remain unchanged.
    if (migration === '20261102000000_retire_relationship_compatibility') run(url, `COMMENT ON TABLE "MailboxThreadAssociation" IS 'canonical-crm-relations-api-verified-v1'`);
    if (migration === '20261112000000_retire_lead_nonform_columns') run(url, `COMMENT ON TABLE "Lead" IS 'lead-form-contract-api-verified-v1'`);
    execFileSync(psql, [url, '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    run(url, `INSERT INTO "_prisma_migrations" VALUES ('${migration}', NOW(), NULL)`);
  }
  return `${url}?connection_limit=10&statement_cache_size=0`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(createLoginTestDatabase()); }
  catch (error) { console.error('Disposable login database setup failed:', error.code || error.name, error.stderr?.toString().slice(-1200) || ''); process.exitCode = 1; }
}
