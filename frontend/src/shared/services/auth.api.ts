'use client';

import { apiClient } from '@/lib/api/client';
import type { AuthResponse, RegisterInput } from '@leadcrm/shared';
export type { AuthResponse } from '@leadcrm/shared';
export class MfaRequiredError extends Error { constructor() { super('Two-factor authentication required.'); } }

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
  updateProfile: (profile: import('@leadcrm/shared').UpdateSelfProfile) =>
    apiClient.patch<AuthResponse>('/auth/profile', profile),
  uploadAvatar: (file: Blob) => apiClient.upload<AuthResponse>('/auth/profile/avatar', file),
  changeEnvironment: (environment: import('@leadcrm/shared').CrmEnvironment) =>
    apiClient.patch<import('@leadcrm/shared').EnvironmentResponse>('/auth/environment', { environment }),
  login: (payload: LoginPayload) =>
    apiClient.post<import('@leadcrm/shared').LoginResponse>('/auth/login', payload),

  changePassword: (currentPassword: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/change-password', { currentPassword, password }),

  mfaStatus: () => apiClient.get<{ data: import('@leadcrm/shared').MfaStatus }>('/auth/mfa/status'),
  setupMfa: (currentPassword: string) => apiClient.post<{ data: import('@leadcrm/shared').MfaSetup }>('/auth/mfa/setup', { currentPassword }),
  enableMfa: (code: string) => apiClient.post<{ data: { recoveryCodes: string[] } }>('/auth/mfa/enable', { code }),
  verifyMfa: (code: string) => apiClient.post<AuthResponse>('/auth/mfa/verify', { code }),
  disableMfa: (currentPassword: string, code: string) => apiClient.post<{ success: boolean }>('/auth/mfa/disable', { currentPassword, code }),
  regenerateMfaRecoveryCodes: (currentPassword: string, code: string) => apiClient.post<{ data: { recoveryCodes: string[] } }>('/auth/mfa/recovery-codes/regenerate', { currentPassword, code }),

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
