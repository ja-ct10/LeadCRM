'use client';

import { moduleListParams } from '@/shared/services/module-list-params';
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

const EMPTY_DATA: never[] = [];

/** List queries cache their response; selected records share the drawer's raw-record cache. */
export function useModuleData<T extends object = Record<string, unknown>>({ moduleId, page, pageSize, sort, filter, search, recordId, disabled }: UseModuleDataParams) {
  const params = { ...moduleListParams({ search, filter, sort }), page: String(page), pageSize: String(pageSize) };
  const queryParams = recordId ? { recordId } : params;
  const result = useCachedPage<ModulePaginatedResponse<T> | T>({
    module: moduleId,
    disabled,
    params: queryParams,
    revalidateOnInvalidation: ['leads', 'contacts', 'accounts'].includes(moduleId),
    intervalMs: recordId ? undefined : 60_000,
    fetchFn: async (signal) => {
      if (recordId) {
        // Resolve the selected record independently of list filters and pagination.
        const response = await apiClient.get<ApiResponse<T>>(
          `/crm/${moduleId}/${encodeURIComponent(recordId)}`, { signal },
        );
        const record = response.data as T & { id?: string; isArchived?: boolean; deletedAt?: string | null };
        if (!record || record.id !== recordId || record.isArchived || record.deletedAt) throw new Error('This record is no longer available.');
        return record;
      }
      return apiClient.get<ModulePaginatedResponse<T>>(`/crm/${moduleId}`, { params, signal });
    },
  });
  const row = recordId ? result.data as T & { isArchived?: boolean; deletedAt?: string | null } | undefined : undefined;
  const selected = row && !row.isArchived && !row.deletedAt ? [row] : EMPTY_DATA;
  // Never store this projection under {recordId}: the detail reader expects the raw record.
  const response = recordId ? result.data && { success: true, data: selected, meta: { page: 1, pageSize, total: selected.length, totalPages: selected.length } }
    : result.data as ModulePaginatedResponse<T> | undefined;
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
