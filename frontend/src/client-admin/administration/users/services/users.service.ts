'use client';

import { apiClient } from '@/lib/api/client';
import type { ApiResponse, PaginatedResponse } from '@leadcrm/shared';
import type { User, RoleDefinition } from '@/store/types';

export const usersService = {
  getAll: (): Promise<PaginatedResponse<User>> =>
    apiClient.get<PaginatedResponse<User>>('/administration/users'),

  getById: (id: string): Promise<ApiResponse<User>> =>
    apiClient.get<ApiResponse<User>>(`/administration/users/${id}`),

  create: (data: Partial<User>): Promise<ApiResponse<User>> =>
    apiClient.post<ApiResponse<User>>('/administration/users', data),

  update: (id: string, data: Partial<User>): Promise<ApiResponse<User>> =>
    apiClient.put<ApiResponse<User>>(`/administration/users/${id}`, data),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`/administration/users/${id}`),

  getRoles: (): Promise<PaginatedResponse<RoleDefinition>> =>
    apiClient.get<PaginatedResponse<RoleDefinition>>('/administration/roles'),

  createRole: (data: Partial<RoleDefinition>): Promise<ApiResponse<RoleDefinition>> =>
    apiClient.post<ApiResponse<RoleDefinition>>('/administration/roles', data),

  updateRole: (id: string, data: Partial<RoleDefinition>): Promise<ApiResponse<RoleDefinition>> =>
    apiClient.put<ApiResponse<RoleDefinition>>(`/administration/roles/${id}`, data),

  deleteRole: (id: string): Promise<void> =>
    apiClient.delete<void>(`/administration/roles/${id}`),
};
