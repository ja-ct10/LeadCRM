'use client';

import { apiClient } from '../../../../lib/api/client';

export const pipelineApiService = {
  getPipelines: () =>
    apiClient.get<{ success: boolean; data: unknown[] }>('/crm/pipelines'),

  createDeal: (data: unknown) =>
    apiClient.post<{ success: boolean; data: unknown }>('/crm/deals', data),

  updateDealStage: (id: string, stageId: string) =>
    apiClient.patch<{ success: boolean; data: unknown }>(`/crm/deals/${id}/stage`, { stageId }),

  updateDeal: (id: string, data: unknown) =>
    apiClient.put<{ success: boolean; data: unknown }>(`/crm/deals/${id}`, data),
};
