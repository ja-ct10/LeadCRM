'use client';

import { apiClient } from '@/lib/api/client';

export interface Notification {
  id: string; tenantId: string; userId: string;
  type: string; title: string; body?: string;
  entityType?: string; entityId?: string;
  isRead: boolean; readAt?: string; createdAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

// NOTE: Notifications are served from the backend Notification table.
// Currently requires a dedicated notification route — add to administration
// routes when the notification bell UI is wired up.
export const notificationsApi = {
  list: (query: { page?: number; limit?: number; isRead?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (query.page)   q.set('page',   String(query.page));
    if (query.limit)  q.set('limit',  String(query.limit));
    if (query.isRead !== undefined) q.set('isRead', String(query.isRead));
    const s = q.toString();
    return apiClient.get<NotificationsResponse>(`/notifications${s ? `?${s}` : ''}`);
  },

  markRead: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.patch<{ success: boolean }>('/notifications/read-all'),
};
