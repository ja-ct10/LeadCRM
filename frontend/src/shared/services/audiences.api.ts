'use client';
import { apiClient } from '@/lib/api/client';
import type { CrmFieldCatalogEntry, AudienceInput, AudiencePreviewRequest, AudiencePreviewResult, SavedAudience } from '@leadcrm/shared';
export const audiencesApi = {
  fields: (source: AudienceInput['source']) => apiClient.get<{ success: boolean; data: CrmFieldCatalogEntry[] }>(`/marketing/audiences/fields?source=${source}`),
  companies: (source: AudienceInput['source']) => apiClient.get<{ success: boolean; data: string[] }>(`/marketing/audiences/companies?source=${source}`),
  list: () => apiClient.get<{ success: boolean; data: SavedAudience[] }>('/marketing/audiences'),
  create: (data: AudienceInput & { name: string }) => apiClient.post<{ success: boolean; data: SavedAudience }>('/marketing/audiences', data),
  update: (id: string, data: AudienceInput & { name: string }) => apiClient.put<{ success: boolean; data: SavedAudience }>(`/marketing/audiences/${id}`, data),
  preview: (data: AudiencePreviewRequest) => apiClient.post<{ success: boolean; data: AudiencePreviewResult }>('/marketing/audiences/preview', data),
};
