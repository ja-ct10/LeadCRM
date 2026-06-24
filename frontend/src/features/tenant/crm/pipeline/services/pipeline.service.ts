'use client';

import { apiClient } from '@/lib/api/client';
import type { ApiResponse, PaginatedResponse } from '@leadcrm/shared';
import type { Deal, Pipeline } from '@/store/types';

export const pipelineService = {
  getPipelines: (): Promise<PaginatedResponse<Pipeline>> =>
    apiClient.get<PaginatedResponse<Pipeline>>('/crm/pipelines'),

  getDeals: (pipelineId?: string): Promise<PaginatedResponse<Deal>> => {
    const qs = pipelineId ? `?pipelineId=${pipelineId}` : '';
    return apiClient.get<PaginatedResponse<Deal>>(`/crm/deals${qs}`);
  },

  createDeal: (data: Partial<Deal>): Promise<ApiResponse<Deal>> =>
    apiClient.post<ApiResponse<Deal>>('/crm/deals', data),

  updateDeal: (id: string, data: Partial<Deal>): Promise<ApiResponse<Deal>> =>
    apiClient.put<ApiResponse<Deal>>(`/crm/deals/${id}`, data),

  archiveDeal: (id: string): Promise<void> =>
    apiClient.patch<void>(`/crm/deals/${id}/archive`),

  reorderDeals: (deals: Array<{ id: string; order: number; stageId: string }>): Promise<void> =>
    apiClient.patch<void>('/crm/deals/reorder', { deals }),
};
