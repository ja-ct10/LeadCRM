'use client';

import { apiClient } from '@/lib/api/client';

export const adminBillingApiService = {
  getAll: (params?: { page?: number; search?: string; status?: string; plan?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.plan) query.set('plan', params.plan);
    return apiClient.get<{ success: boolean; data: unknown[] }>(`/admin/billing?${query.toString()}`);
  },

  getInvoiceById: (id: string) =>
    apiClient.get<{ success: boolean; data: unknown }>(`/admin/billing/${id}`),

  getMetrics: () =>
    apiClient.get<{ success: boolean; data: unknown }>('/admin/billing/metrics'),
};
