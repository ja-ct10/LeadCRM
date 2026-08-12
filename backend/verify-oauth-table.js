const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check table exists
  const tables = await p.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'OAuthAccount'`
  );
  console.log('OAuthAccount table exists:', tables.length > 0 ? '✅ YES' : '❌ NO');

  // Check all constraints on OAuthAccount
  const constraints = await p.$queryRawUnsafe(
    `SELECT conname, contype FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'OAuthAccount'`
  );
  console.log('OAuthAccount constraints:');
  constraints.forEach(c => console.log(' -', c.conname, c.contype === 'u' ? '(unique)' : c.contype === 'p' ? '(pkey)' : c.contype === 'f' ? '(fkey)' : c.contype));

  // Test the actual Prisma client model
  const count = await p.oAuthAccount.count();
  console.log('\nprisma.oAuthAccount.count():', count, '✅ query works');

  await p.$disconnect();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
