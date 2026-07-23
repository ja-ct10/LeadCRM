import { PrismaClient } from '@prisma/client';
import { seedSystemAdmin, generateTenants } from '../src/database/seeders/tenant-generator';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting complete database seed...');

  // 1. System Admin
  await seedSystemAdmin();

  // 2. Realistic Multi-Tenant Data
  await generateTenants(10);

  console.log('[Seed] Complete.');
}

main()
  .catch((e) => {
    console.error('[Seed] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
