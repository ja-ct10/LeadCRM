'use client';

import { apiClient } from '../../../../lib/api/client';
import type { PaginatedResponse } from '@leadcrm/shared';
import type { Contact } from '../../../../store/types/contact.types';

// Contact API service — used by DataContext when backend is live
// Currently DataContext uses localStorage; swap internals here to migrate

export const contactApiService = {
  getAll: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return apiClient.get<PaginatedResponse<Contact>>(`/crm/contacts?${query.toString()}`);
  },

  getById: (id: string) =>
    apiClient.get<{ success: boolean; data: Contact }>(`/crm/contacts/${id}`),

  create: (data: Partial<Contact>) =>
    apiClient.post<{ success: boolean; data: Contact }>('/crm/contacts', data),

  update: (id: string, data: Partial<Contact>) =>
    apiClient.put<{ success: boolean; data: Contact }>(`/crm/contacts/${id}`, data),

  archive: (id: string) =>
    apiClient.patch<void>(`/crm/contacts/${id}/archive`),
};
