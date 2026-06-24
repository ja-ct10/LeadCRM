'use client';

import { apiClient } from '../../../../lib/api/client';
import type { User } from '../../../../store/types/user.types';

export const userApiService = {
  getAll: () =>
    apiClient.get<{ success: boolean; data: User[] }>('/administration/users'),

  create: (data: { firstName: string; lastName: string; email: string; role: string }) =>
    apiClient.post<{ success: boolean; data: User }>('/administration/users', data),

  update: (id: string, data: Partial<User>) =>
    apiClient.put<{ success: boolean; data: User }>(`/administration/users/${id}`, data),

  setStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    apiClient.patch<{ success: boolean }>(`/administration/users/${id}/status`, { status }),

  sendPasswordReset: (id: string) =>
    apiClient.post<{ success: boolean }>(`/administration/users/${id}/password-reset`, {}),
};
