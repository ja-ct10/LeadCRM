'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi, type Notification, type NotificationsResponse } from '@/shared/services/notifications.api';
import { buildCacheKey, createPageCacheGuard, getPageCache, setPageCache, invalidatePageCache } from '@/shared/cache/page-cache';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { toast } from 'sonner';

export function useNotifications() {
  const { tenant, user } = useAuth();
  const tenantId = tenant?.id ?? user?.tenantId ?? '';
  const params = { page: 1, limit: 20, userId: user?.id, role: user?.role, environment: user?.activeEnvironment };
  const scope = buildCacheKey('notifications', tenantId, params);
  const enabled = !USE_MOCK_DATA && !!user?.id;
  const cached = enabled ? getPageCache<NotificationsResponse>('notifications', tenantId, params)?.data : undefined;
  const [state, setState] = useState(() => ({
    scope, notifications: cached?.data ?? [], page: 1,
    hasMore: cached?.meta.hasMore ?? false, isLoading: enabled, hasError: false,
  }));
  const active = useRef({ scope, version: 0, mounted: false });
  active.current.scope = scope;
  const currentState = state.scope === scope ? state : {
    scope, notifications: cached?.data ?? [], page: 1,
    hasMore: cached?.meta.hasMore ?? false, isLoading: enabled, hasError: false,
  };

  const loadNotifications = useCallback(async (page: number, append = false) => {
    if (!enabled || !active.current.mounted || active.current.scope !== scope) return;
    const version = ++active.current.version;
    const cacheValid = createPageCacheGuard('notifications');
    const current = () => active.current.mounted && active.current.scope === scope && active.current.version === version;
    setState((prev) => ({
      ...(prev.scope === scope ? prev : { scope, notifications: cached?.data ?? [], page: 1, hasMore: cached?.meta.hasMore ?? false }),
      isLoading: true, hasError: false,
    }));
    try {
      const response = await notificationsApi.list({ page, limit: 20 });
      if (!current() || !cacheValid()) return;
      setState((prev) => ({
        scope, page, isLoading: false, hasError: false, hasMore: response.meta?.hasMore ?? false,
        notifications: append
          ? Array.from(new Map([...prev.notifications, ...response.data].map((n) => [n.id, n])).values())
          : response.data,
      }));
      if (page === 1) setPageCache('notifications', tenantId, params, response);
    } catch (error) {
      if (!current() || !cacheValid()) return;
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) invalidatePageCache('notifications', tenantId);
      setState((prev) => ({ ...prev, hasError: true, notifications: status === 401 || status === 403 ? [] : prev.notifications }));
      toast.error('Failed to load notifications');
    } finally {
      if (current()) setState((prev) => ({ ...prev, isLoading: false }));
    }
  // The scope includes every field in params. Cache initialization runs once per scope.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, enabled, tenantId]);

  useEffect(() => {
    active.current.mounted = true;
    void loadNotifications(1);
    return () => { active.current.mounted = false; active.current.version++; };
  }, [loadNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      if (!active.current.mounted || active.current.scope !== scope) return;
      active.current.version++;
      invalidatePageCache('notifications', tenantId);
      setState((prev) => ({ ...prev, isLoading: false, notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
      ) }));
    } catch { toast.error('Failed to update notification'); }
  }, [scope, tenantId]);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      if (!active.current.mounted || active.current.scope !== scope) return;
      active.current.version++;
      invalidatePageCache('notifications', tenantId);
      setState((prev) => ({ ...prev, isLoading: false, notifications: prev.notifications.map((n) =>
        ({ ...n, isRead: true, readAt: new Date().toISOString() }),
      ) }));
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed to update notifications'); }
  }, [scope, tenantId]);

  const loadMore = useCallback(() => {
    if (!currentState.isLoading && currentState.hasMore) void loadNotifications(currentState.page + 1, true);
  }, [currentState.isLoading, currentState.hasMore, currentState.page, loadNotifications]);
  const refresh = useCallback(() => loadNotifications(1), [loadNotifications]);
  const notifications = enabled ? currentState.notifications : [];
  return {
    notifications,
    unreadCount: notifications.filter((n: Notification) => !n.isRead).length,
    isLoading: enabled && currentState.isLoading,
    hasError: currentState.hasError,
    page: currentState.page,
    hasMore: currentState.hasMore,
    markAsRead, markAllAsRead, loadMore, refresh,
  };
}
