'use client';

import { apiClient } from '@/lib/api/client';
import type { OrganizationSettings, UpdateOrganizationSettings } from '@leadcrm/shared';

export const settingsApiService = {
  getOrganization: () => apiClient.get<{ success: boolean; data: OrganizationSettings }>('/administration/organization-settings'),
  updateOrganization: (data: UpdateOrganizationSettings) =>
    apiClient.patch<{ success: boolean; data: OrganizationSettings }>('/administration/organization-settings', data),
};
