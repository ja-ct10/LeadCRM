'use client';

import { apiClient } from '@/lib/api/client';
import { useCachedPage } from './use-cached-page';
import type { FilterCondition, ModulePaginatedResponse } from '@leadcrm/shared';

interface UseModuleDataParams {
  moduleId: string;
  page: number;
  pageSize: number;
  sort?: { field: string; direction: 'asc' | 'desc' } | null;
  filter?: FilterCondition[];
  search?: string;
}

const EMPTY_DATA: Record<string, unknown>[] = [];

/** Cache the response and its pagination metadata under the exact API query. */
export function useModuleData({ moduleId, page, pageSize, sort, filter, search }: UseModuleDataParams) {
  const params: Record<string, unknown> = { page: String(page), pageSize: String(pageSize) };
  if (sort) params.sort = `${sort.field}:${sort.direction}`;
  if (search?.trim()) params.search = search.trim();
  for (const condition of filter ?? []) {
    params[`filter[${condition.field}]`] = Array.isArray(condition.value)
      ? `${condition.operator}:${condition.value.join(',')}`
      : condition.value == null
        ? condition.operator
        : `${condition.operator}:${String(condition.value)}`;
  }
  const result = useCachedPage({
    module: moduleId,
    params,
    intervalMs: 60_000,
    fetchFn: (signal) => apiClient.get<ModulePaginatedResponse<Record<string, unknown>>>(
      `/crm/${moduleId}`, { params, signal },
    ),
  });
  return {
    data: result.data?.data ?? EMPTY_DATA,
    meta: result.data?.meta ? {
      ...result.data.meta,
      pageSize: result.data.meta.pageSize ?? (result.data.meta as unknown as { limit: number }).limit,
      totalPages: Math.ceil(result.data.meta.total / (result.data.meta.pageSize ?? (result.data.meta as unknown as { limit: number }).limit)),
    } : null,
    isLoading: result.isInitialLoad || result.isRefreshing,
    isInitialLoad: result.isInitialLoad,
    isRefreshing: result.isRefreshing,
    error: result.error,
    refetch: result.refetch,
  };
}
