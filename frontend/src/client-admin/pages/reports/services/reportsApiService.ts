'use client';

import { apiClient } from '../../../../lib/api/client';

export const reportsApiService = {
  getDashboardMetrics: (period?: string) => {
    const query = period ? `?period=${period}` : '';
    return apiClient.get<{ success: boolean; data: unknown }>(`/reporting/dashboard${query}`);
  },

  getContactsReport: () =>
    apiClient.get<{ success: boolean; data: unknown }>('/reporting/contacts'),

  getPipelineReport: () =>
    apiClient.get<{ success: boolean; data: unknown }>('/reporting/pipeline'),

  getCampaignReport: (campaignId: string) =>
    apiClient.get<{ success: boolean; data: unknown }>(`/reporting/campaigns/${campaignId}`),
};
