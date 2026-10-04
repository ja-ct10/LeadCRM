'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NotificationMutationResponse } from '@leadcrm/shared';
import { notificationsApi, type NotificationsResponse } from '@/shared/services/notifications.api';
import { buildCacheKey, createPageCacheGuard, getPageCache, setPageCache, invalidatePageCache } from '@/shared/cache/page-cache';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { toast } from 'sonner';

export type NotificationFilter = 'all' | 'unread' | 'read';
type NotificationChange = NotificationMutationResponse & {
  tenantId: string; userId: string; action: 'read' | 'read-all' | 'delete'; ids: string[];
};

export function useNotifications(filter: NotificationFilter = 'all') {
  const { tenant, user } = useAuth();
  const tenantId = tenant?.id ?? user?.tenantId ?? '';
  const userId = user?.id ?? '';
  const isRead = filter === 'all' ? undefined : filter === 'read';
  const params = { page: 1, limit: 20, userId, role: user?.role, isRead };
  const scope = buildCacheKey('notifications', tenantId, params);
  const enabled = !USE_MOCK_DATA && !!userId;
  const cached = enabled ? getPageCache<NotificationsResponse>('notifications', tenantId, params)?.data : undefined;
  const identity = buildCacheKey('notifications', tenantId, { userId, role: user?.role });
  const latestCounts = useRef({ identity, unreadCount: 0, totalCount: 0 });
  if (latestCounts.current.identity !== identity) latestCounts.current = { identity, unreadCount: 0, totalCount: 0 };
  const initial = () => ({
    scope, notifications: cached?.data ?? [], unreadCount: cached?.unreadCount ?? latestCounts.current.unreadCount,
    totalCount: cached?.totalCount ?? latestCounts.current.totalCount, page: 1, hasMore: cached?.meta.hasMore ?? false,
    isLoading: enabled, isMutating: false, hasError: false,
  });
  const [state, setState] = useState(initial);
  const active = useRef({ scope, version: 0, mounted: false });
  active.current.scope = scope;
  const currentState = state.scope === scope ? state : initial();
  latestCounts.current = { identity, unreadCount: currentState.unreadCount, totalCount: currentState.totalCount };
  const stateRef = useRef(currentState);
  stateRef.current = currentState;
  const mutationPending = useRef(false);

  const loadNotifications = useCallback(async (page = 1) => {
    if (!enabled || !active.current.mounted || active.current.scope !== scope) return;
    const version = ++active.current.version;
    const cacheValid = createPageCacheGuard('notifications');
    const current = () => active.current.mounted && active.current.scope === scope && active.current.version === version;
    setState(prev => ({ ...(prev.scope === scope ? prev : stateRef.current), isLoading: true, hasError: false }));
    try {
      // Replace every loaded page so deleted/moved rows cannot survive a refresh.
      const responses: NotificationsResponse[] = [];
      for (let next = 1; next <= page; next++) {
        const response = await notificationsApi.list({ page: next, limit: 20, isRead });
        if (!current() || !cacheValid()) return;
        responses.push(response);
        if (!response.meta.hasMore) break;
      }
      const first = responses[0], last = responses[responses.length - 1];
      setState(prev => ({
        ...prev, scope, page: responses.length, unreadCount: last.unreadCount, totalCount: last.totalCount,
        isLoading: false, hasError: false, hasMore: last.meta.hasMore,
        notifications: Array.from(new Map(responses.flatMap(response => response.data).map(n => [n.id, n])).values()),
      }));
      setPageCache('notifications', tenantId, params, first);
    } catch (error) {
      if (!current() || !cacheValid()) return;
      const status = (error as { status?: number })?.status;
      const denied = status === 401 || status === 403;
      if (denied) invalidatePageCache('notifications', tenantId);
      setState(prev => ({ ...prev, hasError: true, ...(denied ? { unreadCount: 0, totalCount: 0, notifications: [] } : {}) }));
      toast.error('Failed to load notifications');
    } finally {
      if (current()) setState(prev => ({ ...prev, isLoading: false }));
    }
  // scope contains the complete cache parameters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, enabled, tenantId, isRead]);

  useEffect(() => {
    active.current.mounted = true;
    void loadNotifications();
    const refresh = () => { if (document.visibilityState !== 'hidden') void loadNotifications(stateRef.current.page); };
    const changed = (event: Event) => {
      const change = (event as CustomEvent<NotificationChange>).detail;
      if (change && (change.tenantId !== tenantId || change.userId !== userId)) return;
      if (change) {
        active.current.version++;
        setState(prev => {
          if (prev.scope !== scope) return prev;
          const notifications = prev.notifications
            .filter(n => change.action !== 'delete' || !change.ids.includes(n.id))
            .map(n => change.action === 'read-all' || (change.action === 'read' && change.ids.includes(n.id))
              ? { ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() } : n)
            .filter(n => isRead === undefined || n.isRead === isRead);
          return { ...prev, notifications, unreadCount: change.unreadCount, totalCount: change.totalCount, isLoading: false };
        });
      }
      refresh();
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('notifications-changed', changed);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('notifications-changed', changed);
      window.removeEventListener('focus', refresh);
      active.current.mounted = false;
      active.current.version++;
    };
  }, [loadNotifications, tenantId, userId, scope, isRead]);

  const mutate = useCallback(async (action: NotificationChange['action'], ids: string[] = []) => {
    if (!enabled || mutationPending.current) return false;
    mutationPending.current = true;
    setState(prev => ({ ...prev, isMutating: true }));
    try {
      const response = action === 'delete' ? await notificationsApi.delete(ids)
        : action === 'read-all' ? await notificationsApi.markAllRead() : await notificationsApi.markRead(ids[0]);
      invalidatePageCache('notifications', tenantId);
      // Broadcast only after backend success, including to the bell and other filtered views.
      window.dispatchEvent(new CustomEvent<NotificationChange>('notifications-changed', {
        detail: { ...response, tenantId, userId, action, ids },
      }));
      if (action === 'delete') toast.success(ids.length === 1 ? 'Notification deleted' : `${ids.length} notifications deleted`);
      if (action === 'read-all') toast.success('All notifications marked as read');
      return true;
    } catch {
      toast.error(action === 'delete' ? 'Failed to delete notifications' : 'Failed to update notifications');
      return false;
    } finally {
      mutationPending.current = false;
      if (active.current.mounted && active.current.scope === scope) setState(prev => ({ ...prev, isMutating: false }));
    }
  }, [enabled, scope, tenantId, userId]);

  return {
    notifications: enabled ? currentState.notifications : [],
    unreadCount: enabled ? currentState.unreadCount : 0,
    totalCount: enabled ? currentState.totalCount : 0,
    isLoading: enabled && currentState.isLoading,
    isMutating: currentState.isMutating,
    hasError: currentState.hasError,
    page: currentState.page,
    hasMore: currentState.hasMore,
    scope,
    markAsRead: (id: string) => mutate('read', [id]),
    markAllAsRead: () => mutate('read-all'),
    deleteNotifications: (ids: string[]) => mutate('delete', [...new Set(ids)]),
    loadMore: () => { if (!currentState.isLoading && currentState.hasMore) void loadNotifications(currentState.page + 1); },
    refresh: () => loadNotifications(currentState.page),
  };
}
