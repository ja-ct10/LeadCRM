// Isolated PostgreSQL-compatible database: never connects to the developer database.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
const db = await PGlite.create();
const temporary = mkdtempSync(join(tmpdir(), 'leadcrm-sales-schema-'));
const baseline = join(temporary, 'schema.prisma');
const before = readFileSync('backend/prisma/schema.prisma', 'utf8')
  .replace(/^  (?:creationKey|automationKey|requestKey) String\?\r?\n/gm, '')
  .replace(/^  @@unique\(\[(?:tenantId, environment, (?:creationKey|automationKey)|formId, requestKey)\]\)\r?\n/gm, '');
writeFileSync(baseline, before);
const diff = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', baseline, '--script'], { encoding: 'utf8' });
unlinkSync(baseline); rmdirSync(temporary);
if (diff.status !== 0) throw new Error(diff.stderr);
await db.exec(diff.stdout);
await db.exec(readFileSync('backend/prisma/migrations/20261012000000_sales_automation/migration.sql', 'utf8'));
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55441 });
await server.start();
const url = 'postgresql://postgres:postgres@127.0.0.1:55441/leadcrm_forms_test_2?connection_limit=1&statement_cache_size=0';
const suites = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const args = process.argv.includes('--preview') ? ['-r', 'ts-node/register/transpile-only', 'src/modules/crm/leads/sales-automation.preview.ts'] : ['../node_modules/vitest/vitest.mjs', 'run', '--no-file-parallelism', ...(suites.length ? suites : ['src/modules/crm/leads/sales-automation.integration.test.ts', 'src/modules/marketing/forms/forms.validation.test.ts', 'src/modules/marketing/forms/forms.integration.test.ts'])];
const child = spawn(process.execPath, args, {
  cwd: 'backend', stdio: 'inherit', env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, JWT_SECRET: 'sales-test-secret-disposable-database-only' },
});
const code = await new Promise(resolve => child.once('exit', resolve));
await server.stop(); await db.close(); process.exitCode = code ?? 1;
