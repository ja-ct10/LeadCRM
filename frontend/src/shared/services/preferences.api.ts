'use client';

import { apiClient } from '@/lib/api/client';
import type { ColumnPreferenceSuccessResponse, ColumnConfigItem } from '@leadcrm/shared';

export const preferencesApi = {
  getEffectiveColumns: (module: string): Promise<ColumnPreferenceSuccessResponse> =>
    apiClient.get<ColumnPreferenceSuccessResponse>(`/preferences/columns/${module}`),

  saveUserPreference: (module: string, columns: ColumnConfigItem[]): Promise<ColumnPreferenceSuccessResponse> =>
    apiClient.put<ColumnPreferenceSuccessResponse>(`/preferences/columns/${module}`, { columns }),

  deleteUserPreference: (module: string): Promise<ColumnPreferenceSuccessResponse> =>
    apiClient.delete<ColumnPreferenceSuccessResponse>(`/preferences/columns/${module}`),

  saveTenantDefault: (module: string, columns: ColumnConfigItem[]): Promise<ColumnPreferenceSuccessResponse> =>
    apiClient.put<ColumnPreferenceSuccessResponse>(`/preferences/columns/${module}/tenant-default`, { columns }),

  deleteTenantDefault: (module: string): Promise<ColumnPreferenceSuccessResponse> =>
    apiClient.delete<ColumnPreferenceSuccessResponse>(`/preferences/columns/${module}/tenant-default`),
};
