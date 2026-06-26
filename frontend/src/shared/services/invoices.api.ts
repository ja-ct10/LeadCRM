'use client';

import { apiClient } from '@/lib/api/client';
import type { Invoice } from '@/store/types';

export interface InvoicesResponse { success: boolean; data: Invoice[]; meta: { total: number; page: number; limit: number; hasMore: boolean }; }
export interface InvoiceResponse  { success: boolean; data: Invoice & { transactions?: PaymentTransaction[] }; }

export interface PaymentTransaction {
  id: string; amount: number; currency: string; status: string;
  paymongoPaymentId?: string; paymentMethod?: string; paidAt?: string;
  createdAt: string;
}

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return q.toString() ? `?${q.toString()}` : '';
}

export const invoicesApi = {
  list: (query: Record<string, unknown> = {}) =>
    apiClient.get<InvoicesResponse>(`/billing/invoices${buildQuery(query)}`),

  get: (id: string) =>
    apiClient.get<InvoiceResponse>(`/billing/invoices/${id}`),

  create: (data: Partial<Invoice>) =>
    apiClient.post<InvoiceResponse>('/billing/invoices', data),

  update: (id: string, data: Partial<Invoice>) =>
    apiClient.put<InvoiceResponse>(`/billing/invoices/${id}`, data),

  markPaid: (id: string, paidAt?: string) =>
    apiClient.patch<InvoiceResponse>(`/billing/invoices/${id}/pay`, { paidAt }),

  archive: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/billing/invoices/${id}/archive`),
};
