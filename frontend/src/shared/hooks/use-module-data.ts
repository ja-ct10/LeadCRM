'use client';

import { apiClient } from '@/lib/api/client';
import { useCachedPage } from './use-cached-page';
import type { ApiResponse, FilterCondition, ModulePaginatedResponse } from '@leadcrm/shared';

interface UseModuleDataParams {
  moduleId: string;
  page: number;
  pageSize: number;
  sort?: { field: string; direction: 'asc' | 'desc' } | null;
  filter?: FilterCondition[];
  search?: string;
  recordId?: string;
  disabled?: boolean;
}

const EMPTY_DATA: Record<string, unknown>[] = [];

/** List queries cache their response; selected records share the drawer's raw-record cache. */
export function useModuleData({ moduleId, page, pageSize, sort, filter, search, recordId, disabled }: UseModuleDataParams) {
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
  const queryParams = recordId ? { recordId } : params;
  const result = useCachedPage<ModulePaginatedResponse<Record<string, unknown>> | Record<string, unknown>>({
    module: moduleId,
    disabled,
    params: queryParams,
    revalidateOnInvalidation: ['leads', 'contacts', 'accounts'].includes(moduleId),
    intervalMs: recordId ? undefined : 60_000,
    fetchFn: async (signal) => {
      if (recordId) {
        // Resolve the selected record independently of list filters and pagination.
        const response = await apiClient.get<ApiResponse<Record<string, unknown>>>(
          `/crm/${moduleId}/${encodeURIComponent(recordId)}`, { signal },
        );
        if (!response.data) throw new Error('Record not found');
        return response.data;
      }
      return apiClient.get<ModulePaginatedResponse<Record<string, unknown>>>(`/crm/${moduleId}`, { params, signal });
    },
  });
  const row = recordId ? result.data as Record<string, unknown> | undefined : undefined;
  const selected = row && !row.isArchived && !row.deletedAt ? [row] : EMPTY_DATA;
  // Never store this projection under {recordId}: the detail reader expects the raw record.
  const response = recordId ? result.data && { success: true, data: selected, meta: { page: 1, pageSize, total: selected.length, totalPages: selected.length } }
    : result.data as ModulePaginatedResponse<Record<string, unknown>> | undefined;
  return {
    data: response?.data ?? EMPTY_DATA,
    facets: (response as { facets?: Record<string, number> } | null)?.facets,
    meta: response?.meta ? {
      ...response.meta,
      pageSize: response.meta.pageSize ?? (response.meta as unknown as { limit: number }).limit,
      totalPages: Math.ceil(response.meta.total / (response.meta.pageSize ?? (response.meta as unknown as { limit: number }).limit)),
    } : null,
    isLoading: result.isInitialLoad || result.isRefreshing,
    isInitialLoad: result.isInitialLoad,
    isRefreshing: result.isRefreshing,
    error: result.error,
    refetch: result.refetch,
  };
}
