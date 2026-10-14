import type { NotificationEvent, Prisma } from '@prisma/client';
import { assignmentName, assignmentUserName, formatAssignmentChange, type AssignmentChangeFacts } from '@leadcrm/shared';
import prisma from '../../config/database.config';

type Client = Pick<Prisma.TransactionClient, 'user'>;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const identity = (value: unknown) => typeof value === 'string' && value ? value : value === null ? null : undefined;

/** Resolve recorded identities only; a record's current owner cannot prove its history. */
export async function resolveAssignmentNames(tenantId: string, facts: AssignmentChangeFacts[], client: Client = prisma) {
  const ids = [...new Set(facts.flatMap(row => [
    ...(!assignmentName(row.previousAssignedName) && row.previousAssignedUserId ? [row.previousAssignedUserId] : []),
    ...(!assignmentName(row.assignedName) && row.newAssignedUserId ? [row.newAssignedUserId] : []),
  ]))];
  const users = ids.length ? await client.user.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const names = new Map(users.map(user => [user.id, assignmentUserName(user)]));
  return facts.map(row => ({ ...row,
    previousAssignedName: assignmentName(row.previousAssignedName) ?? names.get(row.previousAssignedUserId ?? ''),
    assignedName: assignmentName(row.assignedName) ?? names.get(row.newAssignedUserId ?? ''),
  }));
}

export async function assignmentSnapshot(client: Client, tenantId: string, previousAssignedUserId: string | null,
  newAssignedUserId: string, actorId: string): Promise<AssignmentChangeFacts> {
  const [facts] = await resolveAssignmentNames(tenantId, [{ assignmentChanged: true, previousAssignedUserId, newAssignedUserId }], client);
  const actor = await client.user.findFirst({ where: { tenantId, id: actorId }, select: { firstName: true, lastName: true } });
  return { ...facts, actorName: assignmentUserName(actor) ?? null };
}

export function assignmentEventFacts(event: Pick<NotificationEvent, 'eventKey' | 'ownerId' | 'payload'>): AssignmentChangeFacts | undefined {
  const facts = object(event.payload);
  if (facts.assignmentChanged === false) return undefined;
  if (facts.assignmentChanged !== true && !event.eventKey.startsWith('assignment:')) return undefined;
  return { assignmentChanged: true, newAssignedUserId: event.ownerId,
    previousAssignedUserId: identity(facts.previousAssignedUserId),
    previousAssignedName: assignmentName(facts.previousAssignedName), assignedName: assignmentName(facts.assignedName),
    actorName: assignmentName(facts.actorName), reason: typeof facts.reason === 'string' ? facts.reason : undefined };
}

export async function presentAssignmentActivities<T extends { type: string; metadata?: unknown }>(tenantId: string, rows: T[]): Promise<T[]> {
  const changes = rows.map(row => {
    const metadata = object(row.metadata), task = object(metadata.taskEvent);
    if (row.type === 'task' && task.event === 'reassigned') return {
      previousAssignedUserId: identity(object(task.before).assignedUserId), newAssignedUserId: identity(task.assignedUserId),
      previousAssignedName: assignmentName(task.previousAssignedName), assignedName: task.assignedAgentName === 'Unknown actor' ? undefined : assignmentName(task.assignedAgentName),
      reason: typeof metadata.reason === 'string' ? metadata.reason : undefined,
    };
    if (row.type !== 'assignment') return undefined;
    const newId = identity(metadata.newAssignedUserId ?? metadata.assignedUserId);
    // Creation and unassignment activities retain their existing presentation.
    if (!newId) return undefined;
    return { previousAssignedUserId: identity(metadata.previousAssignedUserId !== undefined ? metadata.previousAssignedUserId : metadata.previousUserId), newAssignedUserId: newId,
      previousAssignedName: assignmentName(metadata.previousAssignedName), assignedName: assignmentName(metadata.assignedName),
      reason: typeof metadata.reason === 'string' ? metadata.reason : undefined };
  });
  const facts = await resolveAssignmentNames(tenantId, changes.filter((row): row is NonNullable<typeof row> => !!row));
  let index = 0;
  return rows.map((row, i) => changes[i] ? { ...row, ...formatAssignmentChange(facts[index++]) } : row);
}
