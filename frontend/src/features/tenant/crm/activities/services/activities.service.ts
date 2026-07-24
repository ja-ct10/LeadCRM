'use client';

import { apiClient } from '@/lib/api/client';
import type { PaginatedResponse, ApiResponse } from '@leadcrm/shared';
import type { Activity } from '@/store/types/shared.types'; // wait, activity is in shared.types? I'll check types

export interface ActivityQueryParams {
  page?: number;
  limit?: number;
  contactId?: string;
  dealId?: string;
  organizationId?: string;
  taskId?: string;
  type?: string;
}

export const activitiesService = {
  getAll: (params?: ActivityQueryParams): Promise<PaginatedResponse<Activity>> => {
    const query = new URLSearchParams();
    if (params?.page)           query.set('page',           String(params.page));
    if (params?.limit)          query.set('limit',          String(params.limit));
    if (params?.contactId)      query.set('contactId',      params.contactId);
    if (params?.dealId)         query.set('dealId',         params.dealId);
    if (params?.organizationId) query.set('organizationId', params.organizationId);
    if (params?.taskId)         query.set('taskId',         params.taskId);
    if (params?.type)           query.set('type',           params.type);
    const qs = query.toString();
    return apiClient.get<PaginatedResponse<Activity>>(`/crm/activities${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string): Promise<ApiResponse<Activity>> =>
    apiClient.get<ApiResponse<Activity>>(`/crm/activities/${id}`),

  create: (data: Omit<Activity, 'id' | 'tenantId' | 'createdAt'>): Promise<ApiResponse<Activity>> =>
    apiClient.post<ApiResponse<Activity>>('/crm/activities', data),

  update: (id: string, data: Partial<Activity>): Promise<ApiResponse<Activity>> =>
    apiClient.put<ApiResponse<Activity>>(`/crm/activities/${id}`, data),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`/crm/activities/${id}`),
};
