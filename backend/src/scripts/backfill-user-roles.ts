/**
 * One-time backfill: create UserRole junction rows for existing users who have a User.role
 * string but no UserRole row yet. Idempotent — uses upsert. Safe to re-run.
 *
 * Run: npx ts-node src/scripts/backfill-user-roles.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error'] });

async function main(): Promise<void> {
  const users = await prisma.user.findMany({
    select: { id: true, tenantId: true, role: true, email: true },
  });

  console.log(`Backfilling UserRole rows for ${users.length} user(s)...`);
  let linked = 0; let skipped = 0;

  for (const user of users) {
    // Find the RoleDefinition matching the user's role string in their tenant
    const roleDef = await prisma.roleDefinition.findFirst({
      where: { tenantId: user.tenantId, name: user.role },
    });

    if (!roleDef) {
      console.log(`  SKIP (no RoleDefinition for role "${user.role}") — ${user.email}`);
      skipped++;
      continue;
    }

    await prisma.userRole.upsert({
      where: { userId_roleId_tenantId: { userId: user.id, roleId: roleDef.id, tenantId: user.tenantId } },
      create: { userId: user.id, roleId: roleDef.id, tenantId: user.tenantId },
      update: {},
    });
    linked++;
  }

  console.log(`Done. Linked: ${linked}, Skipped: ${skipped}.`);
}

main()
  .catch((err) => { console.error('Backfill failed:', err instanceof Error ? err.message : err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
