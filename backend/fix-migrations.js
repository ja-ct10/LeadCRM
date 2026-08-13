const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Step 1: Delete the ghost migration from DB that has a different timestamp
  const deleted = await p.$executeRawUnsafe(
    "DELETE FROM _prisma_migrations WHERE migration_name = '20260808163700_split_crm_models'"
  );
  console.log('[fix-migrations] Deleted ghost migration rows:', deleted);

  // Step 2: Check current status
  const rows = await p.$queryRawUnsafe(
    "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at"
  );
  console.log('[fix-migrations] Applied migrations after fix:');
  rows.forEach(r => console.log(' -', r.migration_name, r.finished_at ? '✅' : '❌ (failed)'));

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
