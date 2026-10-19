import prisma from '../../config/database.config';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { NotificationQuerySchema, SmsCampaignNotificationTypes } from '@leadcrm/shared';
import { NotFoundError, ValidationError } from '../../shared/errors/http-error';
import { presentNotifications, notificationAccess } from './notification-access';
import { getNotificationPreferences } from './notification-preferences.service';

const cursorSchema = z.object({ createdAt: z.string().datetime(), id: z.string().uuid(), snapshot: z.string().datetime() }).strict();
export async function findNotifications(tenantId: string, userId: string, input: Record<string, unknown>) {
  const query = NotificationQuerySchema.parse(input);
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (query.cursor) {
    try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(query.cursor, 'base64url').toString())); }
    catch { throw new ValidationError('Invalid notification cursor'); }
  }
  const snapshot = cursor?.snapshot ?? query.snapshot ?? new Date().toISOString();
  const where: Prisma.NotificationWhereInput = { tenantId, userId, createdAt: { lte: new Date(snapshot) },
    ...(query.unreadOnly === 'true' || query.isRead === 'false' ? { isRead: false } : query.isRead === 'true' ? { isRead: true } : {}) };
  const after: Prisma.NotificationWhereInput = cursor ? { OR: [
    { createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), id: { gt: cursor.id } },
  ] } : {};
  const [rows, total, totals] = await prisma.$transaction(async tx => Promise.all([
    tx.notification.findMany({ where: { AND: [where, after] }, take: query.limit + 1,
      ...(cursor ? {} : { skip: (query.page - 1) * query.limit }), orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
    tx.notification.count({ where }), counts(tx, tenantId, userId),
  ]), { isolationLevel: 'RepeatableRead' });
  const hasMore = rows.length > query.limit;
  const records = rows.slice(0, query.limit), last = records[records.length - 1];
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id, snapshot })).toString('base64url') : null;
  return { data: await presentNotifications(tenantId, userId, records),
    meta: { total, page: query.page, limit: query.limit, hasMore, nextCursor, snapshot }, ...totals };
}

async function counts(tx: Prisma.TransactionClient, tenantId: string, userId: string) {
  // Both values come from one SQL snapshot, including inside mutation transactions.
  const groups = await tx.notification.groupBy({ by: ['isRead'], where: { tenantId, userId }, _count: { _all: true } });
  const unread = await tx.notification.groupBy({ by: ['entityType', 'entityId'], where: { tenantId, userId, isRead: false }, _count: { _all: true } });
  const access = await notificationAccess(tenantId, userId, tx);
  const unreadByModule: Record<string, number> = {};
  for (const group of unread) {
    const target = await access.resolve(group.entityType, group.entityId);
    if (!target) continue;
    const path = target.destination.split('?')[0];
    const module = path.startsWith('/crm/') ? path.split('/')[2]
      : path.startsWith('/marketing/') ? path.split('/')[2]
      : path.startsWith('/automation/') ? 'workflows'
      : path.startsWith('/operations/') ? 'tasks' : path.split('/')[1];
    if (module) unreadByModule[module] = (unreadByModule[module] ?? 0) + group._count._all;
  }
  return { totalCount: groups.reduce((sum, row) => sum + row._count._all, 0), unreadCount: groups.find(row => !row.isRead)?._count._all ?? 0, unreadByModule };
}
export async function notificationCounts(tenantId: string, userId: string, input: Record<string, unknown> = {}) {
  const query = z.object({ after: z.string().max(2048).optional(), since: z.string().datetime().optional() }).strict().parse(input);
  const now = new Date();
  const shape = z.object({ tenantId: z.string(), userId: z.string(), since: z.string().datetime(), at: z.string().datetime(), id: z.string(), page: z.boolean() }).strict();
  let cursor: z.infer<typeof shape>;
  if (query.after) {
    try { cursor = shape.parse(JSON.parse(Buffer.from(query.after, 'base64url').toString())); }
    catch { throw new ValidationError('Invalid notification update cursor'); }
    if (cursor.tenantId !== tenantId || cursor.userId !== userId) throw new ValidationError('Invalid notification update cursor');
  } else {
    const since = new Date(Math.min(+now, Math.max(+now - 300000, query.since ? Date.parse(query.since) : +now))).toISOString();
    cursor = { tenantId, userId, since, at: since, id: '', page: false };
  }
  const since = new Date(cursor.since);
  const result = await prisma.$transaction(async tx => {
    const totals = await counts(tx, tenantId, userId);
    const preferences = await getNotificationPreferences(tenantId, userId, tx);
    const after: Prisma.NotificationWhereInput = cursor.page ? { OR: [
      { createdAt: { gt: new Date(cursor.at) } }, { createdAt: new Date(cursor.at), id: { gt: cursor.id } },
    ] } : { createdAt: { gte: new Date(Math.max(+since, Date.parse(cursor.at) - 30000)) } };
    // A small overlap catches transactions committed out of timestamp order.
    // The shared watcher deduplicates immutable notification IDs.
    const rows = preferences.data.inAppGeneral ? await tx.notification.findMany({ where: {
      tenantId, userId, type: { in: [...SmsCampaignNotificationTypes] }, occurredAt: { gte: since }, AND: [after],
    }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 101 }) : [];
    const active = preferences.data.inAppGeneral ? await tx.campaign.findFirst({ where: {
      tenantId, type: 'SMS', isArchived: false, submissionStartedAt: { gt: new Date(+now - 300000) },
      status: { in: ['SENDING', 'SENT', 'INTERRUPTED'] }, OR: [{ createdById: userId }, { submittedById: userId }],
    }, orderBy: { submissionStartedAt: 'desc' }, select: { id: true, submissionStartedAt: true } }) : null;
    return { ...totals, rows, active };
  }, { isolationLevel: 'RepeatableRead' });
  const hasMore = result.rows.length > 100;
  const records = result.rows.slice(0, 100);
  const last = records[records.length - 1];
  const next = { ...cursor, at: hasMore && last ? last.createdAt.toISOString() : now.toISOString(), id: hasMore && last ? last.id : '', page: hasMore };
  const updates = (await presentNotifications(tenantId, userId, records)).filter(row => row.available);
  const access = result.active ? await notificationAccess(tenantId, userId) : null;
  return { totalCount: result.totalCount, unreadCount: result.unreadCount, unreadByModule: result.unreadByModule, updates, hasMore,
    cursor: Buffer.from(JSON.stringify(next)).toString('base64url'),
    activeSmsUntil: result.active?.submissionStartedAt && await access?.resolve('Campaign', result.active.id)
      ? new Date(+result.active.submissionStartedAt + 300000).toISOString() : null };
}
export async function markNotificationRead(id: string, tenantId: string, userId: string) {
  return prisma.$transaction(async tx => {
    if (!await tx.notification.findFirst({ where: { id, tenantId, userId }, select: { id: true } })) throw new NotFoundError('Notification');
    await tx.notification.updateMany({ where: { id, tenantId, userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return counts(tx, tenantId, userId);
  });
}
export async function markAllNotificationsRead(tenantId: string, userId: string, before = new Date()) {
  return prisma.$transaction(async tx => {
    await tx.notification.updateMany({ where: { tenantId, userId, isRead: false, createdAt: { lte: before } }, data: { isRead: true, readAt: new Date() } });
    return { ...await counts(tx, tenantId, userId), readBefore: before.toISOString() };
  });
}
export async function deleteNotifications(ids: string[], tenantId: string, userId: string) {
  return prisma.$transaction(async tx => {
    const unique = [...new Set(ids)];
    const result = await tx.notification.deleteMany({ where: { id: { in: unique }, tenantId, userId } });
    if (result.count !== unique.length) throw new NotFoundError('Notification');
    return counts(tx, tenantId, userId);
  });
}
