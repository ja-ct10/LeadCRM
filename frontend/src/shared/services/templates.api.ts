'use client';

import { apiClient } from '@/lib/api/client';
import type { Template } from '@/store/types';

export interface TemplatesResponse { success: boolean; data: Template[]; meta: { total: number; page: number; limit: number; hasMore: boolean }; }
export interface TemplateResponse  { success: boolean; data: Template; }

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return q.toString() ? `?${q.toString()}` : '';
}

export const templatesApi = {
  list: (query: Record<string, unknown> = {}) =>
    apiClient.get<TemplatesResponse>(`/marketing/templates${buildQuery(query)}`),

  get: (id: string) =>
    apiClient.get<TemplateResponse>(`/marketing/templates/${id}`),

  create: (data: Partial<Template>) =>
    apiClient.post<TemplateResponse>('/marketing/templates', data),

  update: (id: string, data: Partial<Template>) =>
    apiClient.put<TemplateResponse>(`/marketing/templates/${id}`, data),

  archive: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/marketing/templates/${id}/archive`),
};
