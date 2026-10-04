// Two-phase Prisma rollout. All schema/data mutations are versioned migrations.
// --expand copies history and retains frozen old tables. --verify is read-only.
// --retire verifies deployed APIs before enabling the guarded retirement migration.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, copyFileSync, mkdirSync, readdirSync, cpSync, rmSync, realpathSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join, sep } = require('node:path');
const { verifyImportRollout } = require('./verify-crm-import-rollout.cjs');
const root = resolve(__dirname, '../prisma');
const expansion = '20261027000000_crm_import_integrity';
const retirement = '20261028000000_retire_legacy_crm_imports';

function migrate(through) {
  // Prisma has no deploy-to-version option. A temporary copy of the exact checked-in
  // history lets phase 1 stop before retirement without altering migration checksums.
  const parent = realpathSync(tmpdir()), stage = mkdtempSync(join(parent, 'leadcrm-import-migrations-'));
  try {
    copyFileSync(join(root, 'schema.prisma'), join(stage, 'schema.prisma'));
    mkdirSync(join(stage, 'migrations'));
    copyFileSync(join(root, 'migrations/migration_lock.toml'), join(stage, 'migrations/migration_lock.toml'));
    for (const name of readdirSync(join(root, 'migrations'))) {
      if (/^\d+_/.test(name) && name <= through) cpSync(join(root, 'migrations', name), join(stage, 'migrations', name), { recursive: true });
    }
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', join(stage, 'schema.prisma')], { cwd: resolve(__dirname, '..'), env: process.env, stdio: 'inherit', windowsHide: true });
    if (result.status !== 0) throw new Error('Prisma rollout failed. Inspect migration status before retrying.');
  } finally {
    const target = realpathSync(stage);
    if (!target.startsWith(parent + sep) || !target.slice(parent.length + 1).startsWith('leadcrm-import-migrations-')) throw new Error('Unsafe temporary cleanup path');
    rmSync(target, { recursive: true });
  }
}

(async () => {
  const mode = process.argv[2];
  if (!['--expand', '--verify', '--retire'].includes(mode)) throw new Error('Use --expand, --verify or --retire. See docs/csv-import-normalization.md.');
  if (mode === '--expand') { migrate(expansion); return; }
  const db = new PrismaClient({ log: [], datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
  try {
    const report = await verifyImportRollout(db, process.env.CRM_IMPORT_VERIFY_API, JSON.parse(process.env.CRM_IMPORT_VERIFY_TOKENS || '[]'));
    console.log(JSON.stringify(report, null, 2));
    if (mode === '--retire') {
      await db.$executeRawUnsafe(`COMMENT ON TABLE "CrmImportJob" IS 'crm-import-normalization-api-verified-v1'`);
      try { migrate(retirement); }
      finally {
        // The marker is single-use. Failed retirement always requires verification again.
        await db.$executeRawUnsafe('COMMENT ON TABLE "CrmImportJob" IS NULL');
      }
    }
  } finally { await db.$disconnect(); }
})().catch(error => {
  // Assertion/Prisma payloads can contain historical PII. Report codes only.
  console.error('[crm-import-rollout]', error.code || error.errorCode || error.name, 'Rollout stopped; legacy data has not been discarded by the verifier.');
  process.exitCode = 1;
});
