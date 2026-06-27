'use client';

import { apiClient } from '@/lib/api/client';
import type { User } from '@/store/types';

export interface UsersResponse { success: boolean; data: User[]; meta: { total: number; page: number; limit: number; hasMore: boolean }; }
export interface UserResponse  { success: boolean; data: User; }

export interface RoleDefinition {
  id: string; name: string; description?: string;
  isSystemRole: boolean; permissions: string[]; isArchived: boolean;
  _count?: { userRoles: number };
}
export interface RolesResponse       { success: boolean; data: RoleDefinition[]; }
export interface RoleResponse        { success: boolean; data: RoleDefinition; }
export interface PermissionGroup     { module: string; permissions: Array<{ key: string; label: string }>; }
export interface PermissionsResponse { success: boolean; data: PermissionGroup[]; }

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return q.toString() ? `?${q.toString()}` : '';
}

export const usersApi = {
  list: (query: Record<string, unknown> = {}) =>
    apiClient.get<UsersResponse>(`/administration/users${buildQuery(query)}`),

  get: (id: string) =>
    apiClient.get<UserResponse>(`/administration/users/${id}`),

  create: (data: { firstName: string; lastName: string; email: string; password: string; role?: string }) =>
    apiClient.post<UserResponse>('/administration/users', data),

  update: (id: string, data: { firstName?: string; lastName?: string; role?: string }) =>
    apiClient.put<UserResponse>(`/administration/users/${id}`, data),

  deactivate: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/administration/users/${id}/deactivate`),
};

export const rolesApi = {
  list: () =>
    apiClient.get<RolesResponse>('/administration/roles'),

  get: (id: string) =>
    apiClient.get<RoleResponse>(`/administration/roles/${id}`),

  create: (data: { name: string; description?: string; permissions: string[] }) =>
    apiClient.post<RoleResponse>('/administration/roles', data),

  update: (id: string, data: { name?: string; description?: string; permissions?: string[] }) =>
    apiClient.put<RoleResponse>(`/administration/roles/${id}`, data),

  archive: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/administration/roles/${id}/archive`),

  assign: (userId: string, roleId: string) =>
    apiClient.post<{ success: boolean }>('/administration/roles/assign', { userId, roleId }),

  unassign: (userId: string, roleId: string) =>
    apiClient.delete<{ success: boolean }>('/administration/roles/unassign'),
};

export const permissionsApi = {
  list: () =>
    apiClient.get<PermissionsResponse>('/administration/permissions'),
};
