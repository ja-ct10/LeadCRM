'use client';

import { apiClient } from '@/lib/api/client';
import type { AuthResponse, RegisterInput } from '@leadcrm/shared';
export type { AuthResponse } from '@leadcrm/shared';

export interface LoginPayload {
  email: string;
  password: string;
}

export type RegisterPayload = RegisterInput;

export interface RegisterResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      role: string;
      tenantId: string;
      emailSent: boolean;
    };
  };
}



/**
 * authApi — calls the real Express backend.
 * Used by AuthContext when NEXT_PUBLIC_USE_MOCK_AUTH !== 'true'.
 */
export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login', payload),

  changePassword: (currentPassword: string, password: string) =>
    apiClient.post<{ success: boolean }>('/auth/change-password', { currentPassword, password }),

  logout: () =>
    apiClient.post<{ success: boolean }>('/auth/logout', {}),

  me: () =>
    apiClient.get<AuthResponse>('/auth/me'),

  acceptInvitation: (payload: RegisterPayload) =>
    apiClient.post<RegisterResponse>('/auth/invitations/accept', payload),

  forgotPassword: (email: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/reset-password', { token, password }),

  completeOnboarding: () =>
    apiClient.post<AuthResponse>('/auth/onboarding/complete', {}),

  // ── Invitations ─────────────────────────────────────────────────────────────
  sendInvitations: (emails: string[], roleId: string) =>
    apiClient.post<{ success: boolean; data: { sent: string[]; skipped: Array<{ email: string; reason: string }> } }>('/invitations', { emails, roleId }),

  listInvitations: () =>
    apiClient.get<{ success: boolean; data: Array<{ id: string; email: string; roleName: string; invitedBy: string; expiresAt: string; createdAt: string }> }>('/invitations'),

  revokeInvitation: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/invitations/${id}`),


};
