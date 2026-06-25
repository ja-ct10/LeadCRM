'use client';

import { apiClient } from '@/lib/api/client';

// ── Response shapes ───────────────────────────────────

export interface PipelineStageSummary {
  stageId: string; name: string; order: number;
  probability?: number; isWon: boolean; isLost: boolean; dealCount: number;
}
export interface PipelineSummaryItem {
  pipelineId: string; name: string; stages: PipelineStageSummary[];
}

export interface DealVelocity {
  totalClosed: number; totalWon: number; totalLost: number;
  avgDaysToCloseWon: number | null; avgDaysToCloseLost: number | null;
}

export interface ContactStatusCount {
  status: 'HOT' | 'WARM' | 'COLD' | 'CANCELLED' | 'CLOSED';
  count: number;
}

export interface TaskCompletion {
  total: number; completed: number; overdue: number; pending: number;
}

export interface CampaignSummaryItem {
  id: string; name: string; type: string; status: string;
  sentCount: number; openedCount: number; clickedCount: number;
  engagement: number; sentAt?: string;
}

// ── API methods ───────────────────────────────────────

export const reportingApi = {
  pipelineSummary: (pipelineId?: string) =>
    apiClient.get<{ success: boolean; data: PipelineSummaryItem[] }>(
      `/reporting/pipeline-summary${pipelineId ? `?pipelineId=${pipelineId}` : ''}`,
    ),

  dealVelocity: () =>
    apiClient.get<{ success: boolean; data: DealVelocity }>('/reporting/deal-velocity'),

  contactStatus: () =>
    apiClient.get<{ success: boolean; data: ContactStatusCount[] }>('/reporting/contact-status'),

  taskCompletion: () =>
    apiClient.get<{ success: boolean; data: TaskCompletion }>('/reporting/task-completion'),

  campaignSummary: () =>
    apiClient.get<{ success: boolean; data: CampaignSummaryItem[] }>('/reporting/campaign-summary'),
};
