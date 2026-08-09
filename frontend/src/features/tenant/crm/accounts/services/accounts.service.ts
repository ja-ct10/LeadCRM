'use client';

import { apiClient } from '@/lib/api/client';
import type { PaginatedResponse, ApiResponse } from '@leadcrm/shared';

export interface AccountQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  archived?: boolean;
}

/**
 * accountsService — all API calls for the accounts domain.
 *
 * Used by DataContext when NEXT_PUBLIC_USE_MOCK_DATA=false.
 * In mock mode, DataContext uses localStorage directly.
 *
 * To migrate: set NEXT_PUBLIC_USE_MOCK_DATA=false in .env.local
 * and ensure the backend is running with `npm run dev` in /backend.
 */
export const accountsService = {
  getAll: (params?: AccountQueryParams): Promise<PaginatedResponse<any>> => {
    const query = new URLSearchParams();
    if (params?.page)     query.set('page',     String(params.page));
    if (params?.limit)    query.set('limit',    String(params.limit));
    if (params?.search)   query.set('search',   params.search);
    if (params?.archived) query.set('archived', 'true');
    const qs = query.toString();
    return apiClient.get<PaginatedResponse<any>>(`/crm/accounts${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string): Promise<ApiResponse<any>> =>
    apiClient.get<ApiResponse<any>>(`/crm/accounts/${id}`),

  create: (data: Record<string, unknown>): Promise<ApiResponse<any>> =>
    apiClient.post<ApiResponse<any>>('/crm/accounts', data),

  update: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> =>
    apiClient.put<ApiResponse<any>>(`/crm/accounts/${id}`, data),

  archive: (id: string): Promise<void> =>
    apiClient.patch<void>(`/crm/accounts/${id}/archive`),
};
