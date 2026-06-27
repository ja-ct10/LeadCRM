'use client';

import { apiClient } from '@/lib/api/client';
import type { Contact } from '@/store/types';

export interface ContactsResponse {
  success: boolean;
  data: Contact[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface ContactResponse {
  success: boolean;
  data: Contact;
}

export interface ContactListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  archived?: boolean;
  assignedUserId?: string;
}

function buildQuery(params: ContactListQuery): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const contactsApi = {
  list: (query: ContactListQuery = {}) =>
    apiClient.get<ContactsResponse>(`/crm/contacts${buildQuery(query)}`),

  get: (id: string) =>
    apiClient.get<ContactResponse>(`/crm/contacts/${id}`),

  create: (data: Partial<Contact>) =>
    apiClient.post<ContactResponse>('/crm/contacts', data),

  update: (id: string, data: Partial<Contact>) =>
    apiClient.put<ContactResponse>(`/crm/contacts/${id}`, data),

  archive: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/crm/contacts/${id}/archive`),
};
