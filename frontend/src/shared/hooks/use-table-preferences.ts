'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  tablePreferencesApi,
  type SortPreference,
  type ViewMode,
} from '@/shared/services/table-preferences.api';

export type { SortPreference, ViewMode };

interface UseTablePreferencesReturn {
  pageSize: number;
  viewMode: ViewMode;
  sort: SortPreference | null;
  isLoading: boolean;
  setPageSize: (size: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setSort: (sort: SortPreference | null) => void;
}

/**
 * Hook to manage table preferences (pageSize, viewMode, sort) for a module.
 * Fetches from the server on mount, persists changes optimistically.
 *
 * Usage:
 *   const { pageSize, viewMode, sort, setPageSize, setViewMode, setSort } = useTablePreferences('leads');
 */
export function useTablePreferences(module: string): UseTablePreferencesReturn {
  const [pageSize, setPageSizeState] = useState<number>(10);
  const [viewMode, setViewModeState] = useState<ViewMode>('wrap');
  const [sort, setSortState] = useState<SortPreference | null>(null);
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

    async function fetchPreferences(): Promise<void> {
      setIsLoading(true);
      try {
        const response = await tablePreferencesApi.getTablePreferences(module);
        if (!cancelled && mountedRef.current) {
          setPageSizeState(response.data.pageSize);
          setViewModeState(response.data.viewMode);
          setSortState(response.data.sort);
        }
      } catch {
        // On failure, keep defaults (pageSize: 10, viewMode: 'wrap', sort: null)
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
  }, [module]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    // Fire-and-forget save — optimistic
    tablePreferencesApi.savePageSize(module, size).catch(() => {
      // Silently fail — next refresh will re-fetch correct value
    });
  }, [module]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    tablePreferencesApi.saveViewMode(module, mode).catch(() => {
      // Silent fail
    });
  }, [module]);

  const setSort = useCallback((newSort: SortPreference | null) => {
    setSortState(newSort);
    if (newSort) {
      tablePreferencesApi.saveSort(module, newSort).catch(() => {
        // Silent fail
      });
    }
  }, [module]);

  return {
    pageSize,
    viewMode,
    sort,
    isLoading,
    setPageSize,
    setViewMode,
    setSort,
  };
}
