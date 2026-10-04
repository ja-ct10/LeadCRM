import { z } from 'zod';

export interface NotificationRecord {
  id: string; tenantId: string; userId: string;
  type: string; title: string; body?: string | null;
  entityType?: string | null; entityId?: string | null;
  isRead: boolean; readAt?: string | null; createdAt: string;
}
export interface NotificationsResponse {
  success: boolean; data: NotificationRecord[]; unreadCount: number; totalCount: number;
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}
export const DeleteNotificationsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(10000).transform(ids => [...new Set(ids)]),
}).strict();

export interface NotificationMutationResponse {
  success: boolean;
  totalCount: number;
  unreadCount: number;
}
