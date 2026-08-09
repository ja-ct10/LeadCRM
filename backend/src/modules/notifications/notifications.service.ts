import * as repo from './notifications.repository';

export async function getNotifications(tenantId: string, userId: string, query: Record<string, unknown>) {
  return repo.findNotifications(tenantId, userId, query);
}

export async function markRead(id: string, tenantId: string, userId: string): Promise<void> {
  await repo.markNotificationRead(id, tenantId, userId);
}

export async function markAllRead(tenantId: string, userId: string): Promise<void> {
  await repo.markAllNotificationsRead(tenantId, userId);
}
