'use client';

import { apiClient } from '../../../../lib/api/client';
import type { PaginatedResponse } from '@leadcrm/shared';
import type { Campaign } from '../../../../store/types/campaign.types';

export const campaignApiService = {
  getAll: () =>
    apiClient.get<PaginatedResponse<Campaign>>('/marketing/campaigns'),

  getById: (id: string) =>
    apiClient.get<{ success: boolean; data: Campaign }>(`/marketing/campaigns/${id}`),

  create: (data: Partial<Campaign>) =>
    apiClient.post<{ success: boolean; data: Campaign }>('/marketing/campaigns', data),

  update: (id: string, data: Partial<Campaign>) =>
    apiClient.put<{ success: boolean; data: Campaign }>(`/marketing/campaigns/${id}`, data),

  send: (id: string) =>
    apiClient.post<{ success: boolean }>(`/marketing/campaigns/${id}/send`, {}),

  delete: (id: string) =>
    apiClient.delete<void>(`/marketing/campaigns/${id}`),
};
