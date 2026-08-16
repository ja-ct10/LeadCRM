'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import type { FilterCondition, ModulePaginatedResponse } from '@leadcrm/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SortParam {
  field: string;
  direction: 'asc' | 'desc';
}

interface UseModuleDataParams {
  /** CRM module ID (e.g. 'leads', 'contacts', 'accounts', 'deals') */
  moduleId: string;
  /** Current page number (1-based) */
  page: number;
  /** Records per page */
  pageSize: number;
  /** Sort configuration (field:direction) */
  sort?: SortParam | null;
  /** Active filter conditions */
  filter?: FilterCondition[];
  /** Full-text search term */
  search?: string;
}

interface UseModuleDataMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface UseModuleDataReturn {
  /** Fetched records for the current page */
  data: Record<string, unknown>[];
  /** Pagination metadata from the server */
  meta: UseModuleDataMeta | null;
  /** Whether a fetch is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually re-fetch the current page */
  refetch: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Shared hook for fetching paginated module data from the CRM API.
 *
 * Calls: GET /api/v1/crm/:moduleId?page=1&pageSize=25&sort=name:asc&filter[status]=in:active
 *
 * Key behaviors:
 * - Fetches data whenever page, pageSize, sort, filter, or search change.
 * - View switching does NOT trigger a new API call (view type is not a param).
 * - The parent component must reset page to 1 when sort/filter/search/pageSize change.
 *
 * Requirements: 6.6, 10.6, 15.5
 */
export function useModuleData({
  moduleId,
  page,
  pageSize,
  sort,
  filter,
  search,
}: UseModuleDataParams): UseModuleDataReturn {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<UseModuleDataMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Build query parameters for the module data API.
   * Filter conditions are serialized as: filter[field]=operator:value
   * For 'in'/'not_in' operators with arrays: filter[field]=in:val1,val2
   */
  const buildQueryParams = useCallback((): Record<string, unknown> => {
    const params: Record<string, unknown> = {
      page: String(page),
      pageSize: String(pageSize),
    };

    if (sort) {
      params.sort = `${sort.field}:${sort.direction}`;
    }

    if (search && search.trim()) {
      params.search = search.trim();
    }

    if (filter && filter.length > 0) {
      for (const condition of filter) {
        const key = `filter[${condition.field}]`;
        if (Array.isArray(condition.value)) {
          params[key] = `${condition.operator}:${(condition.value as string[]).join(',')}`;
        } else if (condition.value === null || condition.value === undefined) {
          params[key] = condition.operator;
        } else {
          params[key] = `${condition.operator}:${String(condition.value)}`;
        }
      }
    }

    return params;
  }, [page, pageSize, sort, search, filter]);

  const fetchData = useCallback(async (): Promise<void> => {
    // Abort any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = buildQueryParams();
      const response = await apiClient.get<ModulePaginatedResponse<Record<string, unknown>>>(
        `/crm/${moduleId}`,
        { params },
      );

      if (!mountedRef.current) return;

      setData(response.data);
      setMeta(response.meta);
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;

      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      setData([]);
      setMeta(null);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [moduleId, buildQueryParams]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  const refetch = useCallback((): void => {
    fetchData();
  }, [fetchData]);

  return { data, meta, isLoading, error, refetch };
}
