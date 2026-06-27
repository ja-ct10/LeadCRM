'use client';

import { apiClient } from '@/lib/api/client';
import type { Task } from '@/store/types';

export interface TasksResponse { success: boolean; data: Task[]; meta: { total: number; page: number; limit: number; hasMore: boolean }; }
export interface TaskResponse  { success: boolean; data: Task; }

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const tasksApi = {
  list: (query: Record<string, unknown> = {}) =>
    apiClient.get<TasksResponse>(`/operations/tasks${buildQuery(query)}`),

  get: (id: string) =>
    apiClient.get<TaskResponse>(`/operations/tasks/${id}`),

  create: (data: Partial<Task>) =>
    apiClient.post<TaskResponse>('/operations/tasks', data),

  update: (id: string, data: Partial<Task>) =>
    apiClient.put<TaskResponse>(`/operations/tasks/${id}`, data),

  complete: (id: string) =>
    apiClient.patch<TaskResponse>(`/operations/tasks/${id}/complete`),

  archive: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/operations/tasks/${id}/archive`),
};
