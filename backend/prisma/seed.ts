import { PrismaClient } from '@prisma/client';
import { seedSystemAdmin, generateTenants } from '../src/database/seeders/tenant-generator';
import { seedDemoAccounts } from '../src/database/seeders/demo.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting complete database seed...');

  // 1. System Admin
  await seedSystemAdmin();

  // 2. Demo accounts — admin@democorp.com / admin123, bob@democorp.com / admin123
  await seedDemoAccounts();

  // 3. Realistic Multi-Tenant Data (optional — comment out for faster local seed)
  await generateTenants(10);

  console.log('[Seed] Complete.');
}

main()
  .catch((e) => {
    console.error('[Seed] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
