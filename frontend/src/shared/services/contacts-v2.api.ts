/**
 * contacts-v2.api.ts — HTTP client for the Contact table (/crm/contacts).
 *
 * This service targets the Contact entity (contacts-v2 backend module).
 * It is distinct from contacts.api.ts which serves the Lead table (/crm/leads).
 *
 * ADR-001: Contact.accountId is the canonical company link post-consolidation.
 */
import { apiClient } from '@/lib/api/client';
import type { Contact } from '@/store/types';

export interface ContactsV2Response {
  success: boolean;
  data: Contact[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface ContactV2Response {
  success: boolean;
  data: Contact;
}

export interface ContactV2Query {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  assignedUserId?: string;
  accountId?: string;
}

export const contactsV2Api = {
  list: (query: ContactV2Query = {}): Promise<ContactsV2Response> => {
    const params: Record<string, unknown> = {};
    if (query.page !== undefined) params['page'] = query.page;
    if (query.limit !== undefined) params['limit'] = query.limit;
    if (query.search) params['search'] = query.search;
    if (query.status) params['status'] = query.status;
    if (query.assignedUserId) params['assignedUserId'] = query.assignedUserId;
    if (query.accountId) params['accountId'] = query.accountId;
    return apiClient.get<ContactsV2Response>('/crm/contacts', { params });
  },

  get: (id: string): Promise<ContactV2Response> =>
    apiClient.get<ContactV2Response>(`/crm/contacts/${id}`),

  create: (data: Partial<Contact>): Promise<ContactV2Response> =>
    apiClient.post<ContactV2Response>('/crm/contacts', data),

  update: (id: string, data: Partial<Contact>): Promise<ContactV2Response> =>
    apiClient.put<ContactV2Response>(`/crm/contacts/${id}`, data),

  archive: (id: string): Promise<{ success: boolean }> =>
    apiClient.patch<{ success: boolean }>(`/crm/contacts/${id}/archive`, {}),
};
