import { PrismaClient } from '@prisma/client';
import { seedSystemAdmin } from '../src/database/seeders/admin.seed';
import { seedDefaultPipelines } from '../src/database/seeders/pipelines.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  // 1. System Admin tenant + user
  const systemTenant = await seedSystemAdmin();

  // 2. Default pipelines for system tenant (useful for demos)
  if (systemTenant) {
    await seedDefaultPipelines(systemTenant.id);
  }

  console.log('[Seed] Complete.');
}

main()
  .catch((e) => {
    console.error('[Seed] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
