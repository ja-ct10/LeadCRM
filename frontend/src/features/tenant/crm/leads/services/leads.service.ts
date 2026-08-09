'use client';

import { apiClient } from '@/lib/api/client';
import type { PaginatedResponse, ApiResponse } from '@leadcrm/shared';
import type { Lead, CreateLeadRequest, UpdateLeadRequest } from '@/store/types/lead.types';

export interface LeadQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  archived?: boolean;
}

/**
 * leadsService — all API calls for the leads domain.
 *
 * Used by DataContext when NEXT_PUBLIC_USE_MOCK_DATA=false.
 * In mock mode, DataContext uses localStorage directly.
 *
 * To migrate: set NEXT_PUBLIC_USE_MOCK_DATA=false in .env.local
 * and ensure the backend is running with `npm run dev` in /backend.
 */
export const leadsService = {
  getAll: (params?: LeadQueryParams): Promise<PaginatedResponse<Lead>> => {
    const query = new URLSearchParams();
    if (params?.page)     query.set('page',     String(params.page));
    if (params?.limit)    query.set('limit',    String(params.limit));
    if (params?.status)   query.set('status',   params.status);
    if (params?.search)   query.set('search',   params.search);
    if (params?.archived) query.set('archived', 'true');
    const qs = query.toString();
    // canonical path: /crm/leads
    return apiClient.get<PaginatedResponse<Lead>>(`/crm/leads${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string): Promise<ApiResponse<Lead>> =>
    apiClient.get<ApiResponse<Lead>>(`/crm/leads/${id}`),

  create: (data: CreateLeadRequest): Promise<ApiResponse<Lead>> =>
    apiClient.post<ApiResponse<Lead>>('/crm/leads', data),

  update: (id: string, data: UpdateLeadRequest): Promise<ApiResponse<Lead>> =>
    apiClient.put<ApiResponse<Lead>>(`/crm/leads/${id}`, data),

  archive: (id: string): Promise<void> =>
    apiClient.patch<void>(`/crm/leads/${id}/archive`),
};
