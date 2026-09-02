import * as repo from './roles.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError, ForbiddenError, ConflictError } from '../../../shared/errors/http-error';

// Reserved names that cannot be used for custom roles (case-insensitive).
const RESERVED_ROLE_NAMES = ['admin', 'super user', 'user', 'restricted user', 'client admin', 'system admin'];

function isReservedName(name: string): boolean {
  return RESERVED_ROLE_NAMES.includes(name.toLowerCase().trim());
}

export async function getRoles(tenantId: string) {
  return repo.findAllRoles(tenantId);
}

export async function getRoleById(id: string, tenantId: string) {
  const role = await repo.findRoleById(id, tenantId);
  if (!role) throw new NotFoundError('Role');
  return role;
}

export async function createRole(tenantId: string, userId: string, dto: {
  name: string; description?: string; permissions: string[];
}) {
  if (isReservedName(dto.name)) {
    throw new ConflictError('A role with this name already exists');
  }
  const role = await repo.createRole(tenantId, dto);
  await writeAuditLog({
    tenantId, userId,
    action: 'role.created', entityType: 'RoleDefinition', entityId: role.id,
    after: { name: dto.name, permissions: dto.permissions },
  });
  return role;
}

export async function updateRole(id: string, tenantId: string, userId: string, dto: {
  name?: string; description?: string; permissions?: string[];
}) {
  const role = await repo.updateRole(id, tenantId, dto);
  if (!role) throw new NotFoundError('Role');
  await writeAuditLog({
    tenantId, userId,
    action: 'role.updated', entityType: 'RoleDefinition', entityId: id,
    after: dto as Record<string, unknown>,
  });
  return role;
}

export async function archiveRole(id: string, tenantId: string, userId: string) {
  const role = await repo.archiveRole(id, tenantId);
  if (!role) throw new NotFoundError('Role');
  await writeAuditLog({
    tenantId, userId,
    action: 'role.archived', entityType: 'RoleDefinition', entityId: id,
  });
}

export async function assignRoleToUser(
  targetUserId: string, roleId: string, tenantId: string, actorId: string,
) {
  const assignment = await repo.assignRoleToUser(targetUserId, roleId, tenantId);
  await writeAuditLog({
    tenantId, userId: actorId,
    action: 'role.assigned', entityType: 'User', entityId: targetUserId,
    after: { roleId },
    severity: 'WARNING',
  });
  return assignment;
}

export async function removeRoleFromUser(
  targetUserId: string, roleId: string, tenantId: string, actorId: string,
) {
  await repo.removeRoleFromUser(targetUserId, roleId, tenantId);
  await writeAuditLog({
    tenantId, userId: actorId,
    action: 'role.removed', entityType: 'User', entityId: targetUserId,
    after: { roleId },
    severity: 'WARNING',
  });
}

/**
 * Returns the effective resolved permissions for a user across all their assigned roles.
 * Super roles get full access on all modules.
 */
export async function getUserPermissions(
  userId: string,
  tenantId: string,
  userRole?: string,
): Promise<Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>> {
  // Super roles get full access — return a sentinel map that grants everything
  const FULL_ACCESS = { canView: true, canCreate: true, canEdit: true, canDelete: true };
  const superRoles = ['Admin', 'Super User', 'Client Admin', 'System Admin', 'client_admin', 'clientadmin', 'superuser', 'systemadmin', 'admin'];
  const normalizedRole = (userRole ?? '').toLowerCase().replace(/[\s_\-]/g, '');
  const isSuperRole = superRoles.some(r => r.toLowerCase().replace(/[\s_\-]/g, '') === normalizedRole);

  if (isSuperRole) {
    const modules = [
      'dashboard','contacts','organizations','deals','tasks',
      'campaigns','workflows','settings','users','roles',
      'reports','billing','audit',
    ];
    return Object.fromEntries(modules.map(m => [m, FULL_ACCESS]));
  }

  return repo.findUserEffectivePermissions(userId, tenantId);
}
