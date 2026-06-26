'use client';

import { apiClient } from '@/lib/api/client';
import type { Workflow } from '@/store/types';

export interface WorkflowsResponse { success: boolean; data: Workflow[]; meta: { total: number; page: number; limit: number; hasMore: boolean }; }
export interface WorkflowResponse  { success: boolean; data: Workflow; }

export interface WorkflowExecutionsResponse {
  success: boolean;
  data: Array<{
    id: string; workflowId: string; status: string;
    startedAt: string; completedAt?: string; errorMessage?: string;
    steps: Array<{ id: string; stepIndex: number; actionType: string; status: string; output?: unknown; error?: string; executedAt: string }>;
    trigger: { triggerType: string; entityType: string; triggeredAt: string };
  }>;
}

export interface ActionDefinition {
  type: string; label: string; description: string;
  configSchema: Record<string, { type: string; label: string; required: boolean; options?: string[] }>;
}

export interface TriggerDefinition {
  type: string; label: string; entity: string;
}

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return q.toString() ? `?${q.toString()}` : '';
}

export const workflowsApi = {
  list: (query: Record<string, unknown> = {}) =>
    apiClient.get<WorkflowsResponse>(`/automation/workflows${buildQuery(query)}`),

  get: (id: string) =>
    apiClient.get<WorkflowResponse>(`/automation/workflows/${id}`),

  create: (data: Partial<Workflow>) =>
    apiClient.post<WorkflowResponse>('/automation/workflows', data),

  update: (id: string, data: Partial<Workflow>) =>
    apiClient.put<WorkflowResponse>(`/automation/workflows/${id}`, data),

  toggle: (id: string) =>
    apiClient.patch<WorkflowResponse>(`/automation/workflows/${id}/toggle`),

  archive: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/automation/workflows/${id}/archive`),

  getExecutions: (id: string) =>
    apiClient.get<WorkflowExecutionsResponse>(`/automation/workflows/${id}/executions`),

  getActions: () =>
    apiClient.get<{ success: boolean; data: ActionDefinition[] }>('/automation/actions'),

  getTriggers: () =>
    apiClient.get<{ success: boolean; data: TriggerDefinition[] }>('/automation/triggers'),
};
