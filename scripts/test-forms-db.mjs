// Disposable PostgreSQL-compatible database. Never reads the developer's database URL.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
const db = await PGlite.create();
const temporary = mkdtempSync(join(tmpdir(), 'leadcrm-forms-schema-'));
const baseline = join(temporary, 'schema.prisma');
// Reconstruct only the columns introduced by this migration, so the runner is
// independent of Git history and tests upgrading a populated MarketingForm table.
const before = readFileSync('backend/prisma/schema.prisma', 'utf8')
  .replace(/model FormSubmission \{[\s\S]*?\n\}/, '')
  .replace(/^  formSubmissions FormSubmission\[\]\r?\n/gm, '')
  .replace(/^  (?:publicId String @unique @default\(uuid\(\)\)|revision Int @default\(0\)|publishedRevision Int\?|publishedVersion Int @default\(0\)|publishedConfig Json\?|submissions FormSubmission\[\])\r?\n/gm, '');
writeFileSync(baseline, before);
const diff = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', baseline, '--script'], { encoding: 'utf8' });
unlinkSync(baseline); rmdirSync(temporary);
if (diff.status !== 0) throw new Error(diff.stderr);
await db.exec(diff.stdout);
await db.exec(`INSERT INTO "Tenant" (id, name, slug, "updatedAt") VALUES ('migration-tenant', 'Migration fixture', 'migration-fixture', now());
INSERT INTO "User" (id, "tenantId", email, "firstName", "lastName", role, "updatedAt") VALUES ('migration-user', 'migration-tenant', 'fixture@camxian.com', 'Migration', 'Test', 'Client Admin', now());
INSERT INTO "MarketingForm" (id, "tenantId", "createdById", name, "updatedAt") VALUES ('migration-form', 'migration-tenant', 'migration-user', 'Existing draft', now());`);
// Apply the actual new migration over the pre-change schema.
await db.exec(readFileSync('backend/prisma/migrations/20261010000000_public_forms/migration.sql', 'utf8'));
const upgraded = (await db.query('SELECT "publicId", name, "publishedVersion" FROM "MarketingForm" WHERE id = $1', ['migration-form'])).rows[0];
if (!upgraded.publicId || upgraded.name !== 'Existing draft' || upgraded.publishedVersion !== 0) throw new Error('Existing form migration failed');
console.log('PASS: actual migration retains existing forms and backfills public IDs.');
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55439 });
await server.start();
const url = 'postgresql://postgres:postgres@127.0.0.1:55439/leadcrm_forms_test_1?connection_limit=1';
const preview = process.argv.includes('--preview');
const args = preview ? ['-r', 'ts-node/register/transpile-only', 'src/modules/marketing/forms/forms.preview.ts'] : ['../node_modules/vitest/vitest.mjs', 'run', 'src/modules/marketing/forms'];
const child = spawn(process.execPath, args, {
  cwd: 'backend', stdio: 'inherit', env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, JWT_SECRET: 'forms-test-secret-for-disposable-database-only' },
});
const code = await new Promise(resolve => child.once('exit', resolve));
await server.stop(); await db.close(); process.exitCode = code ?? 1;
