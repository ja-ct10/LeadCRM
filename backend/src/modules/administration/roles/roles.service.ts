import * as repo from './roles.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError, ForbiddenError, ConflictError } from '../../../shared/errors/http-error';

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
