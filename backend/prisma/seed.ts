import { PrismaClient } from '@prisma/client';
import { seedSystemAdmin } from '../src/database/seeders/admin.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');
  await seedSystemAdmin();
  console.log('[Seed] Complete.');
}

main()
  .catch((e) => {
    console.error('[Seed] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
