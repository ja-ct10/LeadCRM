'use client';

import { apiClient } from '@/lib/api/client';
import type { ServiceOrder } from '@/store/types';

export interface ServiceOrdersResponse { success: boolean; data: ServiceOrder[]; meta: { total: number; page: number; limit: number; hasMore: boolean }; }
export interface ServiceOrderResponse  { success: boolean; data: ServiceOrder; }

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return q.toString() ? `?${q.toString()}` : '';
}

export const serviceOrdersApi = {
  list: (query: Record<string, unknown> = {}) =>
    apiClient.get<ServiceOrdersResponse>(`/operations/service-orders${buildQuery(query)}`),

  get: (id: string) =>
    apiClient.get<ServiceOrderResponse>(`/operations/service-orders/${id}`),

  create: (data: Partial<ServiceOrder>) =>
    apiClient.post<ServiceOrderResponse>('/operations/service-orders', data),

  update: (id: string, data: Partial<ServiceOrder>) =>
    apiClient.put<ServiceOrderResponse>(`/operations/service-orders/${id}`, data),

  complete: (id: string, data: { actualDurationMins?: number; notes?: string; photos?: { before: string[]; after: string[] }; signature?: string }) =>
    apiClient.patch<ServiceOrderResponse>(`/operations/service-orders/${id}/complete`, data),
};
