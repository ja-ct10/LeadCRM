'use client';

import { apiClient } from '@/lib/api/client';
import type { ApiResponse, PaginatedResponse } from '@leadcrm/shared';
import type { Workflow } from '@/store/types';

export const workflowsService = {
  getAll: (): Promise<PaginatedResponse<Workflow>> =>
    apiClient.get<PaginatedResponse<Workflow>>('/automation/workflows'),

  getById: (id: string): Promise<ApiResponse<Workflow>> =>
    apiClient.get<ApiResponse<Workflow>>(`/automation/workflows/${id}`),

  create: (data: Partial<Workflow>): Promise<ApiResponse<Workflow>> =>
    apiClient.post<ApiResponse<Workflow>>('/automation/workflows', data),

  update: (id: string, data: Partial<Workflow>): Promise<ApiResponse<Workflow>> =>
    apiClient.put<ApiResponse<Workflow>>(`/automation/workflows/${id}`, data),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`/automation/workflows/${id}`),

  execute: (id: string): Promise<ApiResponse<{ executionId: string }>> =>
    apiClient.post<ApiResponse<{ executionId: string }>>(`/automation/workflows/${id}/execute`, {}),
};
