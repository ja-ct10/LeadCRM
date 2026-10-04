'use client';

import { apiClient } from '@/lib/api/client';
import type { TenantGroup } from '@leadcrm/shared';
export type { TenantGroup, TenantGroupMember } from '@leadcrm/shared';

interface ApiResult<T> { success: boolean; data: T }
export const groupsApi = {
  getAll: (): Promise<ApiResult<TenantGroup[]>> => apiClient.get('/administration/groups'),
  create: (name: string): Promise<ApiResult<TenantGroup>> => apiClient.post('/administration/groups', { name }),
  update: (id: string, name: string): Promise<ApiResult<TenantGroup>> => apiClient.put(`/administration/groups/${id}`, { name }),
  remove: (id: string): Promise<void> => apiClient.delete(`/administration/groups/${id}`),
  addMember: (id: string, userId: string): Promise<void> => apiClient.post(`/administration/groups/${id}/members`, { userId }),
  removeMember: (id: string, userId: string): Promise<void> => apiClient.delete(`/administration/groups/${id}/members/${userId}`),
};
