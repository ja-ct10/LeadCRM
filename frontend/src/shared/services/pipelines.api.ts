'use client';

import { apiClient } from '@/lib/api/client';
import type { Pipeline, Stage } from '@/store/types';

export interface PipelinesResponse  { success: boolean; data: Pipeline[]; }
export interface PipelineResponse   { success: boolean; data: Pipeline; }
export interface StageResponse      { success: boolean; data: Stage; }

export const pipelinesApi = {
  list: () =>
    apiClient.get<PipelinesResponse>('/crm/pipelines'),

  get: (id: string) =>
    apiClient.get<PipelineResponse>(`/crm/pipelines/${id}`),

  create: (data: { name: string; currency?: string }) =>
    apiClient.post<PipelineResponse>('/crm/pipelines', data),

  update: (id: string, data: { name?: string; currency?: string }) =>
    apiClient.put<PipelineResponse>(`/crm/pipelines/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/crm/pipelines/${id}`),

  reorderStages: (pipelineId: string, stageIds: string[]) =>
    apiClient.patch<PipelineResponse>(`/crm/pipelines/${pipelineId}/stages/reorder`, { stageIds }),

  createStage: (data: Partial<Stage> & { pipelineId: string }) =>
    apiClient.post<StageResponse>('/crm/stages', data),

  updateStage: (id: string, data: Partial<Stage>) =>
    apiClient.put<StageResponse>(`/crm/stages/${id}`, data),

  deleteStage: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/crm/stages/${id}`),
};
