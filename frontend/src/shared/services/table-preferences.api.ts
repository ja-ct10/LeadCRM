'use client';

import { apiClient } from '@/lib/api/client';

export interface SortPreference {
  field: string;
  direction: 'asc' | 'desc';
}

export type ViewMode = 'wrap' | 'clip';

export interface TablePreferencesData {
  module: string;
  pageSize: number;
  viewMode: ViewMode;
  sort: SortPreference | null;
}

interface TablePreferencesResponse {
  success: true;
  data: TablePreferencesData;
}

interface SavePageSizeResponse {
  success: true;
  data: { module: string; pageSize: number };
}

interface SaveViewModeResponse {
  success: true;
  data: { module: string; viewMode: ViewMode };
}

interface SaveSortResponse {
  success: true;
  data: { module: string; sort: SortPreference };
}

export const tablePreferencesApi = {
  getTablePreferences: (module: string): Promise<TablePreferencesResponse> =>
    apiClient.get<TablePreferencesResponse>(`/preferences/table/${module}`),

  savePageSize: (module: string, pageSize: number): Promise<SavePageSizeResponse> =>
    apiClient.put<SavePageSizeResponse>(`/preferences/table/${module}/page-size`, { pageSize }),

  saveViewMode: (module: string, viewMode: ViewMode): Promise<SaveViewModeResponse> =>
    apiClient.put<SaveViewModeResponse>(`/preferences/table/${module}/view-mode`, { viewMode }),

  saveSort: (module: string, sort: SortPreference): Promise<SaveSortResponse> =>
    apiClient.put<SaveSortResponse>(`/preferences/table/${module}/sort`, { field: sort.field, direction: sort.direction }),
};
