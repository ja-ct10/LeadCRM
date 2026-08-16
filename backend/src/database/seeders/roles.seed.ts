import { PrismaClient } from '@prisma/client';
import { Role } from '../../shared/constants/roles';

const prisma = new PrismaClient();

export async function seedSystemRoles(tenantId: string) {
  console.log(`[Seed] Seeding system roles for tenant ${tenantId}...`);

  const systemRoles = [
    {
      name: Role.ADMIN,
      description: 'Full administrative access to all features and settings within the tenant.',
      isSystemRole: true,
    },
    {
      name: Role.SUPER_USER,
      description: 'Advanced user with access to most features and settings, excluding sensitive billing operations.',
      isSystemRole: true,
    },
    {
      name: Role.USER,
      description: 'Standard access for everyday operations, sales, and reporting.',
      isSystemRole: true,
    },
    {
      name: Role.RESTRICTED_USER,
      description: 'Limited access, typically view-only or restricted to specific assigned records.',
      isSystemRole: true,
    },
  ];

  for (const role of systemRoles) {
    await prisma.roleDefinition.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: role.name,
        },
      },
      update: {
        description: role.description,
        isSystemRole: role.isSystemRole,
      },
      create: {
        tenantId,
        name: role.name,
        description: role.description,
        isSystemRole: role.isSystemRole,
      },
    });
  }
}

// ── Standalone runner ─────────────────────────────────────────────────────
if (require.main === module) {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('Usage: ts-node roles.seed.ts <tenantId>');
    process.exit(1);
  }
  
  seedSystemRoles(tenantId)
    .catch((err) => { console.error('[Seed] Error:', err); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
