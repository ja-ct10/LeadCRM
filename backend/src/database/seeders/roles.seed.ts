import type { Prisma } from '@prisma/client';
import prisma from '../../config/database.config';
import { Role } from '../../shared/constants/roles';


// ── Permission row definitions ─────────────────────────────────────────────
// Only non-super roles get RolePermission rows.
// Client Admin / System Admin bypass all checks at the middleware level (isSuperRole()).

const USER_PERMISSIONS = [
  { module: 'dashboard',     canView: true,  canCreate: false, canEdit: false, canDelete: false },
  { module: 'contacts',      canView: true,  canCreate: true,  canEdit: true,  canDelete: false },
  { module: 'accounts',      canView: true,  canCreate: true,  canEdit: true,  canDelete: false },
  { module: 'deals',         canView: true,  canCreate: true,  canEdit: true,  canDelete: false },
  { module: 'tasks',         canView: true,  canCreate: true,  canEdit: true,  canDelete: false },
  { module: 'campaigns',     canView: true,  canCreate: false, canEdit: false, canDelete: false },
  { module: 'workflows',     canView: true,  canCreate: false, canEdit: false, canDelete: false },
  { module: 'settings',      canView: true,  canCreate: false, canEdit: false, canDelete: false },
  { module: 'reports',       canView: true,  canCreate: false, canEdit: false, canDelete: false },
  { module: 'users',         canView: false, canCreate: false, canEdit: false, canDelete: false },
  { module: 'roles',         canView: false, canCreate: false, canEdit: false, canDelete: false },
  { module: 'billing',       canView: true,  canCreate: false, canEdit: false, canDelete: false },
  { module: 'audit',         canView: false, canCreate: false, canEdit: false, canDelete: false },
];


export async function seedSystemRoles(tenantId: string, db: Prisma.TransactionClient = prisma): Promise<void> {
  console.log(`[Seed] Seeding system roles for tenant ${tenantId}...`);

  const systemRoles = [
    {
      name: Role.CLIENT_ADMIN,
      description: 'Manages Camxian users, custom roles, and CRM data.',
      isSystemRole: true,
      permissions: null, // Client Admin bypasses all RolePermission checks via isSuperRole()
    },
    {
      name: Role.USER,
      description: 'Standard access for everyday operations, sales, and reporting.',
      isSystemRole: true,
      permissions: USER_PERMISSIONS,
    },

  ];

  for (const roleDef of systemRoles) {
    // Upsert the RoleDefinition
    const role = await db.roleDefinition.upsert({
      where: { tenantId_name: { tenantId, name: roleDef.name } },
      update: { description: roleDef.description, isSystemRole: roleDef.isSystemRole },
      create: { tenantId, name: roleDef.name, description: roleDef.description, isSystemRole: roleDef.isSystemRole },
    });

    // Upsert RolePermission rows for roles that have them
    if (roleDef.permissions) {
      for (const perm of roleDef.permissions) {
        await db.rolePermission.upsert({
          where: { roleId_module: { roleId: role.id, module: perm.module } },
          update: { canView: perm.canView, canCreate: perm.canCreate, canEdit: perm.canEdit, canDelete: perm.canDelete },
          create: {
            tenantId,
            roleId: role.id,
            module: perm.module,
            canView: perm.canView,
            canCreate: perm.canCreate,
            canEdit: perm.canEdit,
            canDelete: perm.canDelete,
          },
        });
      }
    }
  }

  console.log(`[Seed] System roles seeded for tenant ${tenantId}.`);
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
