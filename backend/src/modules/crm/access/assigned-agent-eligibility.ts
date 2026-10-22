import type { Prisma } from '@prisma/client';
import { isWorkspaceAccessible } from '@leadcrm/shared';
import { ValidationError } from '../../../shared/errors/http-error';

type Client = Pick<Prisma.TransactionClient, 'user'>;
type AssignmentFlag = 'canView' | 'canEdit' | 'canComplete';
export type AssignmentRequirements = ReadonlyArray<{ module: string; permissions: readonly AssignmentFlag[] }>;
export const crmAssignmentRequirements = (module: 'leads' | 'contacts' | 'accounts' | 'deals'): AssignmentRequirements => [{ module, permissions: ['canView', 'canEdit'] }];
export const TASK_ASSIGNEE_REQUIREMENTS: AssignmentRequirements = [{ module: 'tasks', permissions: ['canView'] }];

const assignmentInclude = (tenantId: string) => ({
  tenant: { select: { status: true } },
  groupMemberships: { where: { tenantId }, include: { crmRole: { include: { permissions: { where: { tenantId } } } } } },
  userRoles: { where: { tenantId, role: { tenantId } }, include: { role: { include: { permissions: { where: { tenantId } } } } } },
} satisfies Prisma.UserInclude);
export type AssignedAgent = Prisma.UserGetPayload<{ include: ReturnType<typeof assignmentInclude> }>;

/** Role grants combine, but an ordinary role name never changes protected user identity. */
export function hasAssignedAgentAccess(user: AssignedAgent, tenantId: string, requirements: AssignmentRequirements, ownerGroupId?: string | null): boolean {
  if (user.tenantId !== tenantId || user.status !== 'ACTIVE' ||
      ['client admin', 'guest'].includes(user.role.trim().toLowerCase()) || !isWorkspaceAccessible(user.tenant.status)) return false;
  // Tasks also exclude reserved role memberships, including historical archived roles.
  if (requirements.some(requirement => requirement.module === 'tasks') && user.userRoles.some(link =>
    link.tenantId === tenantId && link.role.tenantId === tenantId && ['client admin', 'guest'].includes(link.role.name?.trim().toLowerCase() ?? ''))) return false;
  const permissions = user.userRoles.filter(link => link.tenantId === tenantId && link.role.tenantId === tenantId && !link.role.isArchived)
    .flatMap(link => link.role.permissions.filter(permission => permission.tenantId === tenantId));
  // A Group role applies only to that authoritative Group. Never pool different memberships.
  const group = ownerGroupId ? user.groupMemberships?.find(member => member.groupId === ownerGroupId)?.crmRole : undefined;
  const groupPermissions = group && !group.isArchived && !group.isSystemRole && !['guest', 'clientadmin', 'systemadmin'].includes(group.name.toLowerCase().replace(/[\s_-]/g, '')) && group.tenantId === tenantId
    ? group.permissions.filter(permission => permission.tenantId === tenantId) : [];
  return requirements.every(requirement => [permissions, ...(requirement.module === 'tasks' ? [] : [groupPermissions])].some(grant =>
    requirement.permissions.every(flag => grant.some(permission => permission.module === requirement.module && permission[flag]))));
}

export async function eligibleAssignedAgents(db: Client, tenantId: string, requirements: AssignmentRequirements, ownerGroupId?: string | null) {
  const users = await db.user.findMany({ where: { tenantId, status: 'ACTIVE' }, include: assignmentInclude(tenantId), orderBy: { id: 'asc' } });
  return users.filter(user => hasAssignedAgentAccess(user, tenantId, requirements, ownerGroupId));
}

export async function assertEligibleAssignedAgent(db: Client, tenantId: string, userId: string, requirements: AssignmentRequirements, ownerGroupId?: string | null) {
  const user = await db.user.findFirst({ where: { id: userId, tenantId, status: 'ACTIVE' }, include: assignmentInclude(tenantId) });
  if (!user || !hasAssignedAgentAccess(user, tenantId, requirements, ownerGroupId)) throw new ValidationError('Choose an active eligible agent with the required module access in this workspace.');
  return user;
}
