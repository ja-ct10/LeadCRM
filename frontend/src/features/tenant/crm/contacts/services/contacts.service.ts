'use client';

import { apiClient } from '@/lib/api/client';
import type { PaginatedResponse, ApiResponse } from '@leadcrm/shared';
import type { Contact } from '@/store/types/contact.types';
import type { CreateContactRequest, UpdateContactRequest } from '@leadcrm/shared';

export interface ContactQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  archived?: boolean;
}

/**
 * contactsService — all API calls for the contacts domain.
 *
 * Used by DataContext when NEXT_PUBLIC_USE_MOCK_DATA=false.
 * In mock mode, DataContext uses localStorage directly.
 *
 * To migrate: set NEXT_PUBLIC_USE_MOCK_DATA=false in .env.local
 * and ensure the backend is running with `npm run dev` in /backend.
 */
export const contactsService = {
  getAll: (params?: ContactQueryParams): Promise<PaginatedResponse<Contact>> => {
    const query = new URLSearchParams();
    if (params?.page)     query.set('page',     String(params.page));
    if (params?.limit)    query.set('limit',    String(params.limit));
    if (params?.status)   query.set('status',   params.status);
    if (params?.search)   query.set('search',   params.search);
    if (params?.archived) query.set('archived', 'true');
    const qs = query.toString();
    return apiClient.get<PaginatedResponse<Contact>>(`/crm/contacts${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string): Promise<ApiResponse<Contact>> =>
    apiClient.get<ApiResponse<Contact>>(`/crm/contacts/${id}`),

  create: (data: CreateContactRequest): Promise<ApiResponse<Contact>> =>
    apiClient.post<ApiResponse<Contact>>('/crm/contacts', data),

  update: (id: string, data: UpdateContactRequest): Promise<ApiResponse<Contact>> =>
    apiClient.put<ApiResponse<Contact>>(`/crm/contacts/${id}`, data),

  archive: (id: string): Promise<void> =>
    apiClient.patch<void>(`/crm/contacts/${id}/archive`),
};
