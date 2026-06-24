'use client';

import { apiClient } from '../../../../lib/api/client';

export const serviceOrderApiService = {
  getAll: (params?: { page?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.status) query.set('status', params.status);
    return apiClient.get<{ success: boolean; data: unknown[] }>(`/operations/service-orders?${query.toString()}`);
  },

  getById: (id: string) =>
    apiClient.get<{ success: boolean; data: unknown }>(`/operations/service-orders/${id}`),

  create: (data: unknown) =>
    apiClient.post<{ success: boolean; data: unknown }>('/operations/service-orders', data),

  update: (id: string, data: unknown) =>
    apiClient.put<{ success: boolean; data: unknown }>(`/operations/service-orders/${id}`, data),
};
