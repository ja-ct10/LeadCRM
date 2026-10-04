import prisma from '../../config/database.config';
import { getPaginationParams } from '../../shared/helpers/pagination';
import type { Prisma } from '@prisma/client';
import { NotFoundError } from '../../shared/errors/http-error';

// All queries are scoped to tenantId + userId — cross-tenant access is impossible by design

export async function findNotifications(tenantId: string, userId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    userId,
    ...(query.unreadOnly === 'true' || query.isRead === 'false' ? { isRead: false } : query.isRead === 'true' ? { isRead: true } : {}),
  };

  const [data, total, unreadCount, totalCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { tenantId, userId, isRead: false } }),
    prisma.notification.count({ where: { tenantId, userId } }),
  ]);

  return { data, meta: { total, page, limit, hasMore: page * limit < total }, unreadCount, totalCount };
}

async function counts(tx: Prisma.TransactionClient, tenantId: string, userId: string) {
  const [totalCount, unreadCount] = await Promise.all([
    tx.notification.count({ where: { tenantId, userId } }),
    tx.notification.count({ where: { tenantId, userId, isRead: false } }),
  ]);
  return { totalCount, unreadCount };
}

export async function markNotificationRead(id: string, tenantId: string, userId: string) {
  return prisma.$transaction(async tx => {
    await tx.notification.updateMany({
      where: { id, tenantId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return counts(tx, tenantId, userId);
  });
}

export async function markAllNotificationsRead(tenantId: string, userId: string) {
  return prisma.$transaction(async tx => {
    await tx.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return counts(tx, tenantId, userId);
  });
}

export async function deleteNotifications(ids: string[], tenantId: string, userId: string) {
  return prisma.$transaction(async tx => {
    const result = await tx.notification.deleteMany({ where: { id: { in: ids }, tenantId, userId } });
    // Roll back the whole selection if any record is missing or belongs to someone else.
    if (result.count !== ids.length) throw new NotFoundError('Notification');
    return counts(tx, tenantId, userId);
  });
}
