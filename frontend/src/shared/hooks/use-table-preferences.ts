'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import {
  tablePreferencesApi,
  type SortPreference,
  type ViewMode,
} from '@/shared/services/table-preferences.api';

export type { SortPreference, ViewMode };

/** Display mode for table cell content: wrap text or clip with ellipsis */
export type DisplayMode = 'wrap' | 'clip';

interface UseTablePreferencesReturn {
  pageSize: number;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  sort: SortPreference | null;
  isLoading: boolean;
  setPageSize: (size: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setSort: (sort: SortPreference | null) => void;
  /** Fire-and-forget filter persistence — URL remains source of truth */
  persistFilters: (conditions: unknown[]) => void;
}

/**
 * Hook to manage table preferences (pageSize, viewMode, displayMode, sort) for a module.
 * Fetches from the server on mount. Sort writes are serialized with rollback;
 * page size and display changes retain the existing fire-and-forget handling.
 *
 * Fire-and-forget behavior:
 * - UI updates immediately (optimistic)
 * - Persist request is sent in the background
 * - On failure: non-blocking error toast (auto-dismiss 5s), NO rollback
 * - On next user action of same type: silently retries (normal persist call)
 *
 * Usage:
 *   const { pageSize, viewMode, displayMode, sort, setPageSize, setViewMode, setDisplayMode, setSort } = useTablePreferences('leads');
 */
export function useTablePreferences(module: string): UseTablePreferencesReturn {
  const { user, tenant } = useAuth();
  const identity = [module, tenant?.id, user?.id].join(':');
  const identityRef = useRef(identity); identityRef.current = identity;
  const defaultSort = (): SortPreference | null => ['leads', 'contacts'].includes(module) ? { field: 'lastSalesActivityAt', direction: 'desc' } : [ 'accounts', 'campaigns', 'workflows', 'users', 'tasks', 'deals'].includes(module) ? { field: 'createdAt', direction: 'desc' } : null;
  const [pageSize, setPageSizeState] = useState<number>(25);
  const [viewMode, setViewModeState] = useState<ViewMode>('wrap');
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('wrap');
  const [sort, setSortState] = useState<SortPreference | null>(defaultSort);
  const sortChanged = useRef(false);
  const sortVersion = useRef(0);
  const confirmedSort = useRef<SortPreference | null>(defaultSort());
  const sortQueue = useRef<Promise<void>>(Promise.resolve());
  const [isLoading, setIsLoading] = useState(true);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch on mount
  useEffect(() => {
    let cancelled = false;
    sortChanged.current = false;
    confirmedSort.current = defaultSort();
    setSortState(defaultSort()); setPageSizeState(25); setViewModeState('wrap'); setDisplayModeState('wrap');

    async function fetchPreferences(): Promise<void> {
      setIsLoading(true);
      try {
        const response = await tablePreferencesApi.getTablePreferences(module);
        if (!cancelled && mountedRef.current) {
          setPageSizeState(response.data.pageSize);
          setViewModeState(response.data.viewMode);
          // Display mode comes from viewMode on the server (same underlying preference)
          setDisplayModeState(response.data.viewMode);
          if (!sortChanged.current) {
            confirmedSort.current = response.data.sort ?? defaultSort();
            setSortState(confirmedSort.current);
          }
        }
      } catch {
        // On failure, keep defaults (pageSize: 25, viewMode: 'wrap', displayMode: 'wrap', sort: null)
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    fetchPreferences();

    return () => {
      cancelled = true;
    };
  }, [module, identity]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    // Fire-and-forget: no rollback, retry on next user action
    tablePreferencesApi.savePageSize(module, size).catch(() => {
      if (mountedRef.current) {
        toast.error('Unable to save page size preference', { duration: 5000 });
      }
    });
  }, [module]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    setDisplayModeState(mode);
    // Fire-and-forget: no rollback, retry on next user action
    tablePreferencesApi.saveViewMode(module, mode).catch(() => {
      if (mountedRef.current) {
        toast.error('Unable to save view mode preference', { duration: 5000 });
      }
    });
  }, [module]);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
    setDisplayModeState(mode);
    setViewModeState(mode);
    // Fire-and-forget: no rollback, retry on next user action
    tablePreferencesApi.saveViewMode(module, mode).catch(() => {
      if (mountedRef.current) {
        toast.error('Unable to save display mode preference', { duration: 5000 });
      }
    });
  }, [module]);

  const setSort = useCallback((newSort: SortPreference | null) => {
    sortChanged.current = true;
    const next = newSort ?? defaultSort();
    const version = ++sortVersion.current, owner = identity;
    setSortState(next);
    sortQueue.current = sortQueue.current.catch(() => {}).then(async () => {
      if (!mountedRef.current || owner !== identityRef.current) return;
      try {
        await tablePreferencesApi.saveSort(module, newSort);
        if (owner === identityRef.current) confirmedSort.current = next;
      } catch {
        if (mountedRef.current && owner === identityRef.current && version === sortVersion.current) {
          setSortState(confirmedSort.current);
          toast.error('Unable to save sort preference. Please try again.', { duration: 5000 });
        }
      }
    });
  }, [module, identity]);

  /**
   * Fire-and-forget filter persistence.
   * URL state remains the source of truth — this just mirrors to server
   * so filters are restored on next visit when URL has no filter params.
   */
  const persistFilters = useCallback((conditions: unknown[]) => {
    tablePreferencesApi.saveFilters(module, conditions as import('@leadcrm/shared').FilterCondition[]).catch(() => {
      // Silent fail — filters are URL-owned, server is just a backup
    });
  }, [module]);

  return {
    pageSize,
    viewMode,
    displayMode,
    sort,
    isLoading,
    setPageSize,
    setViewMode,
    setDisplayMode,
    setSort,
    persistFilters,
  };
}
