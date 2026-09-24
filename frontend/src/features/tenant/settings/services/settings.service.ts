'use client';

import { apiClient } from '@/lib/api/client';
import type { OrganizationSettings, UpdateOrganizationSettings } from '@leadcrm/shared';

export const settingsApiService = {
  getOrganization: () => apiClient.get<{ success: boolean; data: OrganizationSettings }>('/administration/organization-settings'),
  updateOrganization: (data: UpdateOrganizationSettings) =>
    apiClient.patch<{ success: boolean; data: OrganizationSettings }>('/administration/organization-settings', data),
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
