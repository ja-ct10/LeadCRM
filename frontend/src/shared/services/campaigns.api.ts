'use client';

import { apiClient } from '@/lib/api/client';
import type { Campaign } from '@/store/types';

export interface CampaignsResponse { success: boolean; data: Campaign[]; meta: { total: number; page: number; limit: number; hasMore: boolean }; }
export interface CampaignResponse  { success: boolean; data: Campaign; }

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return q.toString() ? `?${q.toString()}` : '';
}

export const campaignsApi = {
  list: (query: Record<string, unknown> = {}) =>
    apiClient.get<CampaignsResponse>(`/marketing/campaigns${buildQuery(query)}`),

  get: (id: string) =>
    apiClient.get<CampaignResponse>(`/marketing/campaigns/${id}`),

  create: (data: Partial<Campaign>) =>
    apiClient.post<CampaignResponse>('/marketing/campaigns', data),

  update: (id: string, data: Partial<Campaign>) =>
    apiClient.put<CampaignResponse>(`/marketing/campaigns/${id}`, data),

  send: (id: string) =>
    apiClient.patch<CampaignResponse>(`/marketing/campaigns/${id}/send`),

  archive: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/marketing/campaigns/${id}/archive`),
};
