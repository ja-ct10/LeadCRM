/**
 * One-time script: seed RoleDefinition + RolePermission rows for all existing tenants.
 * Idempotent — safe to re-run. Run: npx ts-node src/scripts/seed-system-roles-all-tenants.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedSystemRoles } from '../database/seeders/roles.seed';

const prisma = new PrismaClient({ log: ['error'] });

async function main(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  console.log(`Seeding system roles for ${tenants.length} tenant(s)...`);
  for (const tenant of tenants) {
    console.log(`  → ${tenant.name} (${tenant.id})`);
    await seedSystemRoles(tenant.id);
  }
  console.log('Done. No data deleted.');
}

main()
  .catch((err) => { console.error('Failed:', err instanceof Error ? err.message : err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
