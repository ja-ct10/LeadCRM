'use client';

import { apiClient } from '../../../../lib/api/client';
import type { Workflow } from '../../../../store/types/workflow.types';

export const workflowApiService = {
  getAll: () =>
    apiClient.get<{ success: boolean; data: Workflow[] }>('/automation/workflows'),

  create: (data: Partial<Workflow>) =>
    apiClient.post<{ success: boolean; data: Workflow }>('/automation/workflows', data),

  update: (id: string, data: Partial<Workflow>) =>
    apiClient.put<{ success: boolean; data: Workflow }>(`/automation/workflows/${id}`, data),

  toggle: (id: string, isActive: boolean) =>
    apiClient.patch<{ success: boolean; data: Workflow }>(`/automation/workflows/${id}/toggle`, { isActive }),

  delete: (id: string) =>
    apiClient.delete<void>(`/automation/workflows/${id}`),
};
