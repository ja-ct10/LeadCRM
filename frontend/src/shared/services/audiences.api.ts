'use client';
import { apiClient } from '@/lib/api/client';
import type { AudienceInput, AudiencePreviewRequest, AudiencePreviewResult, SavedAudience } from '@leadcrm/shared';
export const audiencesApi = {
  list: () => apiClient.get<{ success: boolean; data: SavedAudience[] }>('/marketing/audiences'),
  create: (data: AudienceInput & { name: string }) => apiClient.post<{ success: boolean; data: SavedAudience }>('/marketing/audiences', data),
  preview: (data: AudiencePreviewRequest) => apiClient.post<{ success: boolean; data: AudiencePreviewResult }>('/marketing/audiences/preview', data),
};
