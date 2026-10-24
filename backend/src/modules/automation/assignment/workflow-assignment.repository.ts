import type { Prisma } from '@prisma/client';
import type { WorkflowAssignmentPurpose, WorkflowAssignmentTarget, WorkflowAssignmentPoolOption, WorkflowEntity } from '@leadcrm/shared';
import { eligibleAssignedAgents, hasAssignedAgentAccess, crmAssignmentRequirements, TASK_ASSIGNEE_REQUIREMENTS } from '../../crm/access/assigned-agent-eligibility';

type Client = Prisma.TransactionClient;
export async function assignmentCandidates(client: Client, tenantId: string, purpose: WorkflowAssignmentPurpose, entity?: WorkflowEntity) {
  if (purpose === 'crm_owner' && entity === 'account') return [];
  if (purpose === 'crm_owner') return eligibleAssignedAgents(client, tenantId, entity
    ? crmAssignmentRequirements(entity === 'lead' ? 'leads' : entity === 'contact' ? 'contacts' : 'deals')
    : [...crmAssignmentRequirements('leads'), ...crmAssignmentRequirements('deals')]);
  return eligibleAssignedAgents(client, tenantId, TASK_ASSIGNEE_REQUIREMENTS);
}

export async function assignmentPool(client: Client, tenantId: string, target: Extract<WorkflowAssignmentTarget, { type: 'role' | 'group' }>) {
  if (target.type === 'role') {
    const role = await client.roleDefinition.findFirst({ where: { id: target.id, tenantId, isArchived: false },
      select: { name: true, userRoles: { where: { tenantId, user: { tenantId } }, select: { userId: true } } } });
    return role ? { name: role.name, memberIds: role.userRoles.map(member => member.userId) } : null;
  }
  const group = await client.tenantGroup.findFirst({ where: { id: target.id, tenantId },
    select: { name: true, members: { where: { tenantId, user: { tenantId } }, select: { userId: true } } } });
  return group ? { name: group.name, memberIds: group.members.map(member => member.userId) } : null;
}

export async function assignmentOptions(client: Client, tenantId: string, access = { users: false, roles: false, groups: false }) {
  const [owners, assignees, roles, groups] = await Promise.all([
    eligibleAssignedAgents(client, tenantId, []).then(users => users.filter(user =>
      (['leads', 'contacts', 'deals'] as const).some(module => hasAssignedAgentAccess(user, tenantId, crmAssignmentRequirements(module))))),
    assignmentCandidates(client, tenantId, 'task_assignee'),
    access.roles ? client.roleDefinition.findMany({ where: { tenantId, isArchived: false }, orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, userRoles: { where: { tenantId, user: { tenantId } }, select: { userId: true } } } }) : [],
    access.groups ? client.tenantGroup.findMany({ where: { tenantId }, orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, members: { where: { tenantId, user: { tenantId } }, select: { userId: true } } } }) : [],
  ]);
  const ownerIds = new Set(owners.filter(user => user.role !== 'Client Admin').map(user => user.id));
  const taskIds = new Set(assignees.filter(user => user.role !== 'Client Admin').map(user => user.id));
  const peopleById = new Map([...owners, ...assignees].map(user => [user.id, user]));
  const option = (pool: { id: string; name: string }, members: Array<{ userId: string }>): WorkflowAssignmentPoolOption => ({
    ...pool, memberCount: members.length, eligibleMemberCounts: {
      crm_owner: members.filter(member => ownerIds.has(member.userId)).length,
      task_assignee: members.filter(member => taskIds.has(member.userId)).length,
    },
    members: members.flatMap(({ userId }) => {
      const user = peopleById.get(userId);
      const purposes: WorkflowAssignmentPurpose[] = [...(ownerIds.has(userId) ? ['crm_owner' as const] : []), ...(taskIds.has(userId) ? ['task_assignee' as const] : [])];
      return user && purposes.length ? [{ id: userId, name: `${user.firstName} ${user.lastName}`, purposes }] : [];
    }),
  });
  const people = (users: typeof owners) => users.map(user => ({ id: user.id, name: `${user.firstName} ${user.lastName}` }));
  return { users: access.users ? people(owners) : [], taskAssignees: access.users ? people(assignees) : [],
    roles: roles.map(({ userRoles, ...role }) => option(role, userRoles)), groups: groups.map(({ members, ...group }) => option(group, members)) };
}

/** Match the record this action adds to an assignee's workload; completed/archived work is excluded. */
export async function assignmentWorkloads(client: Client, tenantId: string, ids: string[], purpose: WorkflowAssignmentPurpose, entity?: 'lead' | 'contact' | 'account' | 'deal', entityId?: string) {
  const where = { tenantId, assignedUserId: { in: ids }, isArchived: false, ...(purpose === 'crm_owner' && entityId ? { id: { not: entityId } } : {}) };
  const common = { by: ['assignedUserId'] as ['assignedUserId'], _count: { _all: true as const } };
  const rows = purpose === 'task_assignee' ? await client.task.groupBy({ ...common, where: { ...where, status: { in: ['pending', 'in_progress', 'in-progress', 'blocked'] } } })
    : entity === 'lead' ? await client.lead.groupBy({ ...common, where: { ...where, convertedAt: null, deletedAt: null, status: { notIn: ['Closed Deal', 'Cancelled', 'CLOSED_DEAL', 'CANCELLED'] } } })
    : entity === 'contact' ? await client.contact.groupBy({ ...common, where })
    : entity === 'deal' ? await client.deal.groupBy({ ...common, where: { ...where, stage: { tenantId, isWon: false, isLost: false } } }) : [];
  return new Map(rows.flatMap(row => row.assignedUserId ? [[row.assignedUserId, row._count._all] as const] : []));
}
