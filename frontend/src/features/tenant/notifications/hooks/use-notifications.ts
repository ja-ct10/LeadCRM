'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { notificationsApi, type Notification } from '@/shared/services/notifications.api';
import { getPageCache, setPageCache, invalidatePageCache } from '@/shared/cache/page-cache';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { toast } from 'sonner';

interface UseNotificationsResult {
  notifications:  Notification[];
  unreadCount:    number;
  isLoading:      boolean;
  hasError:       boolean;
  page:           number;
  hasMore:        boolean;
  markAsRead:     (id: string) => Promise<void>;
  markAllAsRead:  () => Promise<void>;
  loadMore:       () => void;
  refresh:        () => Promise<void>;
}

// Cache only page 1 — first-visit experience.
// Deeper pages (load-more) are not cached because users rarely paginate notifications.
const PAGE1_CACHE_PARAMS: Record<string, unknown> = { page: 1, limit: 20 };

export function useNotifications(): UseNotificationsResult {
  const { tenant } = useAuth();
  const tenantId   = tenant?.id ?? '';

  // ── Initialize from cache (synchronous — no spinner on return nav) ────────
  const initialCache = useMemo<Notification[] | null>(() => {
    if (USE_MOCK_DATA || !tenantId) return null;
    const cached = getPageCache<Notification[]>('notifications', tenantId, PAGE1_CACHE_PARAMS);
    return cached?.data ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only read on first mount

  const [notifications, setNotifications] = useState<Notification[]>(initialCache ?? []);
  const [unreadCount,   setUnreadCount]   = useState(
    initialCache ? initialCache.filter((n) => !n.isRead).length : 0,
  );
  const [isLoading, setIsLoading] = useState(!initialCache && !USE_MOCK_DATA);
  const [hasError,  setHasError]  = useState(false);
  const [page,      setPage]      = useState(1);
  const [hasMore,   setHasMore]   = useState(false);

  const loadNotifications = useCallback(async (currentPage: number, append = false) => {
    try {
      setIsLoading(true);
      setHasError(false);
      const response = await notificationsApi.list({ page: currentPage, limit: 20 });

      if (response?.data) {
        const newNotifs = append
          ? [...notifications, ...response.data]
          : response.data;

        setNotifications(newNotifs);
        // unreadCount: derive from the full list so it always reflects current state
        setUnreadCount(newNotifs.filter((n) => !n.isRead).length);
        setHasMore(response.meta?.hasMore ?? false);

        // Cache only page 1 results
        if (currentPage === 1 && tenantId && !USE_MOCK_DATA) {
          setPageCache<Notification[]>('notifications', tenantId, PAGE1_CACHE_PARAMS, response.data);
        }
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setHasError(true);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    loadNotifications(1);
  }, [loadNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      // Invalidate cache so next page-1 fetch returns updated read state
      if (tenantId) invalidatePageCache('notifications', tenantId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Failed to update notification');
    }
  }, [tenantId]);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
      if (tenantId) invalidatePageCache('notifications', tenantId);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to update notifications');
    }
  }, [tenantId]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadNotifications(nextPage, true);
    }
  }, [page, isLoading, hasMore, loadNotifications]);

  const refresh = useCallback(async () => {
    setPage(1);
    await loadNotifications(1);
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    hasError,
    page,
    hasMore,
    markAsRead,
    markAllAsRead,
    loadMore,
    refresh,
  };
}
