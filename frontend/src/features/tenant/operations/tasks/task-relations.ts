import type { TaskLinkKind, TaskOption, TaskRecord } from '@leadcrm/shared';
import { isTaskAssignmentRestrictedRole, isTaskManagerRole } from '@leadcrm/shared';

type TeamMember = { id: string; tenantId: string; role: string; groupIds?: string[]; groups?: { id: string }[] };
export function taskTeamUserIds(user: TeamMember, users: readonly TeamMember[]): string[] {
  const groups = user.groupIds ?? user.groups?.map(group => group.id) ?? [];
  return [user.id, ...users.filter(member => member.tenantId === user.tenantId && isTaskAssignmentRestrictedRole(member.role) &&
    (member.groupIds ?? member.groups?.map(group => group.id) ?? []).some(id => groups.includes(id))).map(member => member.id)];
}

/** Managers receive only authorized team rows from the server; grants remain separate. */
export function canManageTask(task: Pick<TaskRecord, 'createdById' | 'assignedUserId'> | undefined, user?: { id: string; role: string } | null): boolean {
  if (!task || !user) return false;
  return isTaskAssignmentRestrictedRole(user.role ?? '') ? task.assignedUserId === user.id
    : isTaskManagerRole(user.role ?? '') || isTaskOwner(task, user.id);
}

/** Creator ownership is separate from assignment, including for administrators. */
export function isTaskOwner(task: Pick<TaskRecord, 'createdById'> | undefined, userId: string | undefined): boolean {
  return !!userId && !!task?.createdById && task.createdById === userId;
}

export function taskRecordHref(kind: TaskLinkKind, id: string): string {
  return `/crm/${kind}s/${encodeURIComponent(id)}`;
}

/** Response hydration can be partial; merge legacy and plural display records by ID. */
export function taskRecordOptions(task: TaskRecord | undefined, kind: TaskLinkKind): TaskOption[] {
  if (!task) return [];
  const records = kind === 'lead' ? [...(task.leads ?? []), task.lead]
    : kind === 'contact' ? [...(task.contacts ?? []), task.contact]
      : kind === 'deal' ? [...(task.deals ?? []), task.deal]
        : [...(task.accounts ?? []), task.account];
  const options = new Map<string, TaskOption>();
  for (const record of records) {
    if (!record || options.has(record.id)) continue;
    const label = 'firstName' in record ? `${record.firstName} ${record.lastName}`.trim()
      : 'title' in record ? record.title : record.name;
    options.set(record.id, { id: record.id, label: label || 'Unnamed record' });
  }
  return [...options.values()];
}
