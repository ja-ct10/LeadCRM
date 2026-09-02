import prisma from '../../../config/database.config';

export async function findAllRoles(tenantId: string) {
  return prisma.roleDefinition.findMany({
    where: { tenantId, isArchived: false },
    orderBy: { name: 'asc' },
    include: { _count: { select: { userRoles: true } } },
  });
}

export async function findRoleById(id: string, tenantId: string) {
  return prisma.roleDefinition.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { userRoles: true } } },
  });
}

export async function createRole(tenantId: string, data: {
  name: string; description?: string; permissions: string[];
}) {
  const { permissions, ...restData } = data;
  return prisma.roleDefinition.create({
    data: { ...restData, tenantId, isSystemRole: false },
  });
}

export async function updateRole(id: string, tenantId: string, data: {
  name?: string; description?: string; permissions?: string[];
}) {
  const existing = await prisma.roleDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  // System roles cannot be modified by tenant admins
  if (existing.isSystemRole) return null;
  
  const { permissions, ...restData } = data;
  return prisma.roleDefinition.update({ where: { id }, data: restData });
}

export async function archiveRole(id: string, tenantId: string) {
  const existing = await prisma.roleDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  if (existing.isSystemRole) return null;
  return prisma.roleDefinition.update({ where: { id }, data: { isArchived: true } });
}

export async function assignRoleToUser(userId: string, roleId: string, tenantId: string) {
  return prisma.userRole.upsert({
    where: { userId_roleId_tenantId: { userId, roleId, tenantId } },
    create: { userId, roleId, tenantId },
    update: {},
  });
}

export async function removeRoleFromUser(userId: string, roleId: string, tenantId: string) {
  return prisma.userRole.deleteMany({ where: { userId, roleId, tenantId } });
}

/**
 * Resolve a user's effective permissions by joining UserRole → RolePermission,
 * ORing all boolean flags across all of the user's assigned roles.
 * Returns a map of module → { canView, canCreate, canEdit, canDelete }.
 */
export async function findUserEffectivePermissions(
  userId: string,
  tenantId: string,
): Promise<Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId, tenantId },
    include: {
      role: {
        include: { permissions: true },
      },
    },
  });

  const resolved: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }> = {};

  for (const ur of userRoles) {
    for (const perm of ur.role.permissions) {
      if (!resolved[perm.module]) {
        resolved[perm.module] = { canView: false, canCreate: false, canEdit: false, canDelete: false };
      }
      // OR semantics: grant if any role grants it
      resolved[perm.module].canView   = resolved[perm.module].canView   || perm.canView;
      resolved[perm.module].canCreate = resolved[perm.module].canCreate || perm.canCreate;
      resolved[perm.module].canEdit   = resolved[perm.module].canEdit   || perm.canEdit;
      resolved[perm.module].canDelete = resolved[perm.module].canDelete || perm.canDelete;
    }
  }

  return resolved;
}
