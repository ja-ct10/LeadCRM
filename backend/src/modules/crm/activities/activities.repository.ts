import { Prisma } from '@prisma/client';
import { crmActor, resolveCrmActor } from '../access/crm-record-access.service';
import { hasModulePermission } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import { CreateActivityDto, UpdateActivityDto } from './activities.dto';
import { AppError } from '../../../shared/errors/app-error';
import { buildSearchClauses } from '../../../shared/helpers/search';

async function taskVisibility(tenantId: string): Promise<Prisma.ActivityWhereInput> {
  const actor = crmActor.getStore();
  if (!actor) return {};
  const policy = await resolveCrmActor(prisma, actor);
  if (policy.clientAdmin || hasModulePermission(policy.permissions, 'tasks', 'canView')) return {};
  return { taskId: null, type: { not: 'task' } };
}

/** Frozen event context is independent of today's Deal participants. */
export function activityRecordContext(kind: 'lead' | 'contact' | 'account' | 'deal', id: string, tenantId: string): Prisma.ActivityWhereInput {
  return { OR: [
    { [`${kind}Id`]: id },
    { type: 'task', metadata: { path: ['taskEvent', 'context', `${kind}Ids`], array_contains: [id] } },
    ...(kind === 'contact' ? [{ lead: { tenantId, contactId: id, convertedAt: { not: null } } }] : []),
  ] };
}

// ─── Shared include ───────────────────────────────────────────────────────────

const ACTIVITY_INCLUDE = {
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * List activities for a tenant with optional filters.
 *
 * Supported query params:
 *   leadId      — filter by linked lead
 *   dealId      — filter by linked deal
 *   accountId   — filter by linked account
 *   taskId      — filter by linked task
 *   type        — filter by activity type (e.g. "call", "stage_change")
 *   createdById — filter by the user who created the activity
 *   dateFrom    — ISO date string — return activities on or after this date
 *   dateTo      — ISO date string — return activities on or before this date
 *   page        — 1-based page number (default 1)
 *   limit       — results per page (default 20, max 100)
 *
 * All queries are tenant-scoped — tenantId is always enforced.
 * Results are ordered by createdAt DESC (newest first).
 */
export async function findAllActivities(
  tenantId: string,
  query: Record<string, unknown>,
) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where: Prisma.ActivityWhereInput = { tenantId, AND: [await taskVisibility(tenantId)] };

  // ── Entity filters ──────────────────────────────────────────────────────────
  // Note: the Activity model uses leadId (not contactId) for the Lead FK.
  for (const kind of ['lead', 'contact', 'account', 'deal'] as const) {
    if (query[`${kind}Id`]) (where.AND as Prisma.ActivityWhereInput[]).push(activityRecordContext(kind, String(query[`${kind}Id`]), tenantId));
  }
  if (query.taskId)    where.taskId    = String(query.taskId);

  // ── Type filter ─────────────────────────────────────────────────────────────
  if (query.type) where.type = { in: String(query.type).split(',') };
  (where.AND as Prisma.ActivityWhereInput[]).push(...buildSearchClauses(query.search, ['title', 'description'], contains => [
    { createdBy: { firstName: contains } }, { createdBy: { lastName: contains } },
  ]));

  // ── User filter ─────────────────────────────────────────────────────────────
  if (query.createdById) where.createdById = String(query.createdById);

  // ── Date range filter ────────────────────────────────────────────────────────
  // Uses the @@index([tenantId, createdAt]) index for efficient range scans.
  const dateFrom = query.dateFrom ? new Date(String(query.dateFrom)) : null;
  const dateTo   = query.dateTo   ? new Date(String(query.dateTo))   : null;

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && !isNaN(dateFrom.getTime()) ? { gte: dateFrom } : {}),
      ...(dateTo   && !isNaN(dateTo.getTime())   ? { lte: dateTo }   : {}),
    };
  }

  const totalWhere = { ...where };
  if (query.cursor) {
    try {
      const cursor = JSON.parse(Buffer.from(String(query.cursor), 'base64url').toString('utf8')) as { createdAt?: unknown; id?: unknown };
      if (!cursor || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 128 || typeof cursor.createdAt !== 'string') throw new Error('cursor');
      const date = new Date(cursor.createdAt);
      if (!Number.isFinite(date.getTime())) throw new Error('cursor');
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: [
        { createdAt: { lt: date } }, { createdAt: date, id: { lt: cursor.id } },
      ] }];
    } catch { throw new AppError('Invalid activity cursor', 400); }
  }
  const [rows, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      skip: query.cursor ? 0 : skip,
      take:     limit + 1,
      orderBy:  [{ createdAt: 'desc' }, { id: 'desc' }],
      include:  ACTIVITY_INCLUDE,
    }),
    prisma.activity.count({ where: totalWhere }),
  ]);

  const data = rows.slice(0, limit);
  const last = data.at(-1);
  const nextCursor = rows.length > limit && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64url') : null;
  return { data: await withEmailContent(tenantId, data), total, page, limit, nextCursor };
}

/** Resolve provider content on read, including older email activities, without copying bodies into history. */
export async function withEmailContent<T extends { type: string; metadata?: Prisma.JsonValue; leadId?: string | null; contactId?: string | null }>(tenantId: string, activities: T[]) {
  const ids = activities.filter(a => a.type === 'email').map(a => (a.metadata as { mailboxMessageId?: string } | null)?.mailboxMessageId).filter((id): id is string => typeof id === 'string');
  if (!ids.length) return activities;
  const messages = await prisma.mailboxMessage.findMany({ where: { tenantId, id: { in: ids } } });
  return activities.map(activity => {
    const metadata = activity.metadata as Record<string, Prisma.JsonValue> | null;
    const message = messages.find(m => m.id === metadata?.mailboxMessageId && (activity.leadId && m.leadId === activity.leadId || activity.contactId && m.contactId === activity.contactId));
    return message ? { ...activity, metadata: { ...metadata, email: { id: message.id, providerMessageId: message.providerMessageId, threadId: message.threadId, accountId: message.accountId, direction: message.direction, from: message.from, to: message.recipients, subject: message.subject, sentAt: message.sentAt.toISOString(), body: message.body } } } : activity;
  });
}

export async function findActivityById(id: string, tenantId: string) {
  return prisma.activity.findFirst({
    where:   { id, tenantId, AND: [await taskVisibility(tenantId)] },
    include: ACTIVITY_INCLUDE,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createActivity(
  tenantId:    string,
  createdById: string,
  dto:         CreateActivityDto,
  db: Prisma.TransactionClient = prisma,
) {
  return db.activity.create({
    data:    { ...dto, tenantId, createdById },
    include: ACTIVITY_INCLUDE,
  });
}

export async function updateActivity(
  id:       string,
  tenantId: string,
  dto:      UpdateActivityDto,
  db: Prisma.TransactionClient = prisma,
) {
  try {
    return await db.activity.update({
      where:   { id, tenantId },
      data:    dto,
      include: ACTIVITY_INCLUDE,
    });
  } catch {
    return null;
  }
}

export async function deleteActivity(id: string, tenantId: string, db: Prisma.TransactionClient = prisma) {
  try {
    return await db.activity.delete({ where: { id, tenantId } });
  } catch {
    return null;
  }
}
