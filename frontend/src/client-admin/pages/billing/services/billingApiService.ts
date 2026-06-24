'use client';

import { apiClient } from '../../../../lib/api/client';

export const billingApiService = {
  getAccountDetails: () =>
    apiClient.get<{ success: boolean; data: unknown }>('/billing/account'),

  getInvoices: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return apiClient.get<{ success: boolean; data: unknown[] }>(`/billing/invoices?${query.toString()}`);
  },

  upgradePlan: (plan: string, billingCycle: string) =>
    apiClient.post<{ success: boolean }>('/billing/upgrade', { plan, billingCycle }),

  updateBillingInfo: (data: unknown) =>
    apiClient.put<{ success: boolean }>('/billing/info', data),
};
