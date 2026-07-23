'use client';

import { apiClient } from '@/lib/api/client';
import type { User } from '@/store/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: Pick<User, 'id' | 'email' | 'role' | 'firstName' | 'lastName' | 'tenantId'>;
  };
}

/**
 * authApi — calls the real Express backend.
 * Used by AuthContext when NEXT_PUBLIC_USE_MOCK_AUTH !== 'true'.
 */
export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login', payload),

  logout: () =>
    apiClient.post<{ success: boolean }>('/auth/logout', {}),

  me: () =>
    apiClient.get<AuthResponse>('/auth/me'),

  registerClientAdmin: (payload: any) =>
    apiClient.post<AuthResponse>('/auth/register/client-admin', payload),

  registerGuest: (payload: any) =>
    apiClient.post<AuthResponse>('/auth/register/guest', payload),
};
