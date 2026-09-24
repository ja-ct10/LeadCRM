import { ForbiddenError, NotFoundError } from '../../../shared/errors/http-error';
import { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';
import { requireEmployeeAccount } from '../../../core/auth/account-access';

// ── Read ──────────────────────────────────────────────────────────────────

export async function findAllRoles(tenantId: string) {
  return prisma.roleDefinition.findMany({
    where: { tenantId, isArchived: false, NOT: { name: { equals: 'Guest', mode: 'insensitive' } } },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { userRoles: true } },
      permissions: {
        select: { id: true, roleId: true, module: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
      },
    },
  });
}

/** Full detail: includes RolePermission rows and assigned users. */
export async function findRoleById(id: string, tenantId: string) {
  return prisma.roleDefinition.findFirst({
    where: { id, tenantId, isArchived: false, NOT: { name: { equals: 'Guest', mode: 'insensitive' } } },
    include: {
      _count: { select: { userRoles: true } },
      permissions: {
        select: { id: true, roleId: true, module: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
      },
      userRoles: {
        where: { tenantId },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true },
          },
        },
        take: 50,
      },
    },
  });
}

export async function findRoleByName(name: string, tenantId: string) {
  return prisma.roleDefinition.findFirst({
    where: { tenantId, name: { equals: name, mode: 'insensitive' } },
  });
}

// ── Write ─────────────────────────────────────────────────────────────────

export async function createRole(
  tenantId: string,
  data: { name: string; description?: string },
  permissions: Array<{ module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>,
) {
  return prisma.$transaction(async (tx) => {
    const role = await tx.roleDefinition.create({
      data: { tenantId, name: data.name, description: data.description, isSystemRole: false },
    });
    if (permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({
          tenantId,
          roleId: role.id,
          module:    p.module,
          canView:   p.canView,
          canCreate: p.canCreate,
          canEdit:   p.canEdit,
          canDelete: p.canDelete,
        })),
      });
    }
    return tx.roleDefinition.findUniqueOrThrow({
      where: { id: role.id },
      include: { permissions: { select: { id: true, roleId: true, module: true, canView: true, canCreate: true, canEdit: true, canDelete: true } }, _count: { select: { userRoles: true } } },
    });
  });
}

export async function updateRoleMeta(
  id: string,
  tenantId: string,
  data: { name?: string; description?: string },
) {
  const existing = await prisma.roleDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  if (existing.isSystemRole) return null;
  return prisma.$transaction(async tx => {
    const role = await tx.roleDefinition.update({ where: { id }, data });
    if (data.name && data.name !== existing.name) {
      await tx.user.updateMany({ where: { tenantId, role: existing.name }, data: { role: data.name } });
    }
    return role;
  });
}

/**
 * Upsert a role's full permission set.
 * Omitted modules have their rows deleted (full replacement semantics).
 */
export async function upsertPermissions(
  roleId: string,
  tenantId: string,
  permissions: Array<{ module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const incomingModules = permissions.map((p) => p.module);

    // Delete rows for modules not in the new set
    await tx.rolePermission.deleteMany({
      where: { roleId, module: { notIn: incomingModules } },
    });

    // Upsert each provided module row
    for (const p of permissions) {
      await tx.rolePermission.upsert({
        where: { roleId_module: { roleId, module: p.module } },
        create: { tenantId, roleId, module: p.module, canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete },
        update: {                                        canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete },
      });
    }
  });
}

export async function archiveRole(id: string, tenantId: string) {
  const existing = await prisma.roleDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  if (existing.isSystemRole) return null;
  return prisma.roleDefinition.update({ where: { id }, data: { isArchived: true } });
}

// ── User–Role junction ────────────────────────────────────────────────────

export async function assignRoleToUser(userId: string, roleId: string, tenantId: string) {
  return prisma.$transaction(async tx => {
    const role = await tx.roleDefinition.findFirst({ where: { id: roleId, tenantId, isArchived: false } });
    if (!role) throw new NotFoundError('Role');
    await replaceUserRole(tx, userId, tenantId, role.name);
    return tx.userRole.findUniqueOrThrow({ where: { userId_roleId_tenantId: { userId, roleId, tenantId } } });
  });
}

export async function removeRoleFromUser(userId: string, roleId: string, tenantId: string) {
  return prisma.$transaction(async tx => {
    const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
    const role = await tx.roleDefinition.findFirst({ where: { id: roleId, tenantId } });
    if (!user || !role) throw new NotFoundError('User or role');
    if (user.role === 'System Admin' || user.role === 'Client Admin' || user.role === role.name) {
      throw new ForbiddenError('Assign a replacement custom role before removing the primary role');
    }
    return tx.userRole.deleteMany({ where: { userId, roleId, tenantId } });
  });
}

export async function countActiveUserRoles(roleId: string, tenantId: string): Promise<number> {
  return prisma.userRole.count({ where: { roleId, tenantId } });
}

// ── Permissions ───────────────────────────────────────────────────────────

/**
 * Resolve a user's effective permissions by joining UserRole → RolePermission,
 * ORing all boolean flags across all of the user's assigned roles.
 */
export async function findUserEffectivePermissions(
  userId: string,
  tenantId: string,
): Promise<Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId, tenantId, user: { tenantId }, role: { tenantId, isArchived: false, NOT: { name: { equals: 'Guest', mode: 'insensitive' } } } },
    include: { role: { include: { permissions: { where: { tenantId } } } } },
  });

  const resolved: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }> = {};

  for (const ur of userRoles) {
    for (const perm of ur.role.permissions) {
      if (!resolved[perm.module]) {
        resolved[perm.module] = { canView: false, canCreate: false, canEdit: false, canDelete: false };
      }
      resolved[perm.module].canView   = resolved[perm.module].canView   || perm.canView;
      resolved[perm.module].canCreate = resolved[perm.module].canCreate || perm.canCreate;
      resolved[perm.module].canEdit   = resolved[perm.module].canEdit   || perm.canEdit;
      resolved[perm.module].canDelete = resolved[perm.module].canDelete || perm.canDelete;
    }
  }

  return resolved;
}

// Prisma type alias kept for import compatibility
export type { Prisma };

/** User management selects a primary role; update both RBAC representations in its transaction. */
export async function replaceUserRole(
  tx: Prisma.TransactionClient, userId: string, tenantId: string, roleName: string,
): Promise<void> {
  const [user, role] = await Promise.all([
    tx.user.findFirst({ where: { id: userId, tenantId } }),
    tx.roleDefinition.findFirst({ where: { tenantId, name: roleName, isArchived: false } }),
  ]);
  if (!user || !role) throw new NotFoundError('User or role');
  if (['System Admin', 'Client Admin'].includes(user.role) || role.isSystemRole ||
      ['guest', 'systemadmin', 'clientadmin'].includes(role.name.toLowerCase().replace(/[\s_-]/g, ''))) {
    throw new ForbiddenError('Select an active custom role for a non-administrator user');
  }
  requireEmployeeAccount({ role: role.name, email: user.email });
  await tx.user.update({ where: { id: user.id }, data: { role: role.name } });
  await tx.userRole.deleteMany({ where: { userId, tenantId } });
  await tx.userRole.create({ data: { userId, tenantId, roleId: role.id } });
}
