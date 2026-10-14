import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { assignmentUserName, formatAssignmentChange } from '@leadcrm/shared';
import { findTaskRecordContext, type TaskClient, type TaskRow } from './tasks.repository';

export function taskState(task: TaskRow) {
  return {
    title: task.title, description: task.description, status: task.status, priority: task.priority,
    dueDate: task.dueDate.toISOString(), reminderAt: task.reminderAt?.toISOString() ?? null,
    createdById: task.createdById, assignedUserId: task.assignedUserId, assignedById: task.assignedById,
    completedAt: task.completedAt?.toISOString() ?? null, completedById: task.completedById,
    isArchived: task.isArchived,
    leadIds: task.leadLinks.map(row => row.leadId), contactIds: task.contactLinks.map(row => row.contactId),
    accountIds: task.accountLinks.map(row => row.accountId), dealIds: task.dealLinks.map(row => row.dealId),
  };
}

/** Activity and AuditLog share an event identity and commit with the mutation.
 * Context is frozen here; timeline reads never derive old events from current Deals. */
export async function recordTaskHistory(client: TaskClient, actorId: string, task: TaskRow, before?: TaskRow,
  metadata: Record<string, unknown> = {}) {
  const after = taskState(task), previous = before ? taskState(before) : null;
  if (previous && JSON.stringify(previous) === JSON.stringify(after)) return;
  const events: Array<[string, string]> = [];
  if (!previous) {
    events.push(['created', 'Created'], ['assigned', 'Assigned']);
    if (after.status === 'completed') events.push(['completed', 'Completed']);
  }
  else {
    if (previous.assignedUserId !== after.assignedUserId) events.push(['reassigned', 'Reassigned']);
    if (previous.dueDate !== after.dueDate) events.push(['rescheduled', 'Rescheduled']);
    if (previous.status !== after.status) events.push(after.status === 'completed'
      ? ['completed', 'Completed'] : previous.status === 'completed' ? ['reopened', 'Reopened'] : ['status_changed', 'Status Changed']);
    if (previous.isArchived !== after.isArchived) events.push(after.isArchived ? ['archived', 'Archived'] : ['restored', 'Restored']);
    if (JSON.stringify([...previous.dealIds].sort()) !== JSON.stringify([...after.dealIds].sort())) events.push(['deals_changed', 'Deal Associations Changed']);
  }
  if (!events.length) events.push(['updated', 'Updated']);
  const dealIds = [...new Set([...after.dealIds, ...(previous?.dealIds ?? [])])];
  const context = await findTaskRecordContext(task.tenantId, { dealIds, leadIds: after.leadIds, contactIds: after.contactIds, accountIds: after.accountIds }, client);
  const leads = new Set(after.leadIds), contacts = new Set(after.contactIds), accounts = new Set(after.accountIds);
  for (const deal of context.deals) {
    if (deal.tenantId !== task.tenantId) continue;
    if (deal.organization?.tenantId === task.tenantId) accounts.add(deal.organization.id);
    for (const { lead } of deal.leadDeals) if (lead.tenantId === task.tenantId) {
      leads.add(lead.id);
      if (lead.convertedAt && lead.contactId) contacts.add(lead.contactId);
    }
    for (const { contact } of deal.contactDeals) if (contact.tenantId === task.tenantId) contacts.add(contact.id);
  }
  for (const lead of context.leads) if (lead.convertedContact?.tenantId === task.tenantId) contacts.add(lead.convertedContact.id);
  const actor = await client.user.findFirst({ where: { id: actorId, tenantId: task.tenantId }, select: { firstName: true, lastName: true } });
  const person = (row: { firstName: string; lastName: string } | null) => row ? `${row.firstName} ${row.lastName}`.trim() : 'Unknown actor';
  const createdAt = new Date();
  const assignment = { previousAssignedUserId: before?.assignedUserId, newAssignedUserId: task.assignedUserId,
    previousAssignedName: before?.assignedUser?.tenantId === task.tenantId ? assignmentUserName(before.assignedUser) ?? null : null,
    assignedName: task.assignedUser?.tenantId === task.tenantId ? assignmentUserName(task.assignedUser) ?? null : null,
    reason: typeof metadata.reason === 'string' ? metadata.reason : undefined };
  for (const [event, label] of events) {
    const id = randomUUID();
    const eventMetadata = JSON.parse(JSON.stringify({ ...metadata, taskEvent: {
      version: 1, id, event, taskId: task.id, actorId, actorName: person(actor), taskTitle: task.title,
      assignedUserId: task.assignedUserId, assignedAgentName: event === 'reassigned' ? assignment.assignedName : person(task.assignedUser),
      ...(event === 'reassigned' ? { previousAssignedName: assignment.previousAssignedName } : {}),
      before: previous, after,
      context: { leadIds: [...leads], contactIds: [...contacts], accountIds: [...accounts], dealIds },
    } })) as Prisma.InputJsonObject;
    await client.auditLog.create({ data: { id, tenantId: task.tenantId, userId: actorId, action: `task.${event}`,
      entityType: 'Task', entityId: task.id, createdAt, changeset: { before: previous, after } as Prisma.InputJsonObject, metadata: eventMetadata } });
    await client.activity.create({ data: { id, tenantId: task.tenantId, taskId: task.id, createdById: actorId,
      type: 'task', createdAt,
      ...(event === 'reassigned' ? formatAssignmentChange(assignment) : { title: `Task ${label}`,
        description: `${task.title} — ${label.toLowerCase()} by ${person(actor)}.${event === 'assigned' ? ` Assigned Agent: ${person(task.assignedUser)}.` : ''}` }),
      metadata: eventMetadata } });
  }
}
