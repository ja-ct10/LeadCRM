'use client';

import { apiClient } from '@/lib/api/client';

export const settingsApiService = {
  getRoles: () =>
    apiClient.get<{ success: boolean; data: unknown[] }>('/administration/roles'),

  createRole: (data: { name: string; description: string; permissions: string[] }) =>
    apiClient.post<{ success: boolean; data: unknown }>('/administration/roles', data),

  updateRole: (id: string, data: unknown) =>
    apiClient.put<{ success: boolean; data: unknown }>(`/administration/roles/${id}`, data),

  deleteRole: (id: string) =>
    apiClient.delete<void>(`/administration/roles/${id}`),

  getPermissions: () =>
    apiClient.get<{ success: boolean; data: unknown[] }>('/administration/permissions'),
};
