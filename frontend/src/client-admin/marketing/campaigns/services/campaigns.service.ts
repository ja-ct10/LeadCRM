'use client';

import { apiClient } from '@/lib/api/client';
import type { ApiResponse, PaginatedResponse } from '@leadcrm/shared';
import type { Campaign } from '@/store/types';

export const campaignsService = {
  getAll: (): Promise<PaginatedResponse<Campaign>> =>
    apiClient.get<PaginatedResponse<Campaign>>('/marketing/campaigns'),

  getById: (id: string): Promise<ApiResponse<Campaign>> =>
    apiClient.get<ApiResponse<Campaign>>(`/marketing/campaigns/${id}`),

  create: (data: Partial<Campaign>): Promise<ApiResponse<Campaign>> =>
    apiClient.post<ApiResponse<Campaign>>('/marketing/campaigns', data),

  update: (id: string, data: Partial<Campaign>): Promise<ApiResponse<Campaign>> =>
    apiClient.put<ApiResponse<Campaign>>(`/marketing/campaigns/${id}`, data),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`/marketing/campaigns/${id}`),

  send: (id: string): Promise<ApiResponse<{ sentCount: number }>> =>
    apiClient.post<ApiResponse<{ sentCount: number }>>(`/marketing/campaigns/${id}/send`, {}),
};
