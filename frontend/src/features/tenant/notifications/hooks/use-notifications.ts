'use client';

import { useState, useEffect, useCallback } from 'react';
import { notificationsApi, type Notification } from '@/shared/services/notifications.api';
import { toast } from 'sonner';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  hasError: boolean;
  page: number;
  hasMore: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadMore: () => void;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadNotifications = useCallback(async (currentPage: number, append = false) => {
    try {
      setIsLoading(true);
      setHasError(false);
      const response = await notificationsApi.list({ page: currentPage, limit: 20 });
      
      if (response?.data) {
        setNotifications(prev => append ? [...prev, ...response.data] : response.data);
        setUnreadCount(response.meta?.total || 0);
        setHasMore(response.meta?.hasMore || false);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setHasError(true);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications(1);
  }, [loadNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Failed to update notification');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to update notifications');
    }
  }, []);

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
