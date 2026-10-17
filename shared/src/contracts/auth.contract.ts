/** Serialized account state returned by every authentication/onboarding endpoint. */
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  status: string | null;
  emailVerified: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  groups?: { id: string; name: string }[];
  avatarUrl: string | null;
  tenantName: string | null;
  tenantStatus: string | null;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  currency: string | null;
  onboardingStep: number;
  /** The authenticated user's acknowledgment, independent of the workspace's legacy setup. */
  onboardingCompletedAt: string | null;
  isTenantOwner: boolean;
  hasPassword: boolean;
  passwordChangedAt?: string | null;
  mustChangePassword?: boolean;
}

export interface AuthResponse {
  success: boolean;
  data: { user: AuthUser; session?: SessionMetadata };
}
export interface SessionMetadata { lastActiveAt: string; idleExpiresAt: string; expiresAt: string; serverNow: string; }

export type LoginResponse = AuthResponse;

export const LOGIN_LOCKOUT_CODE = 'AUTH_LOGIN_LOCKED';
export const ACCOUNT_LOCKED_CODE = 'AUTH_ACCOUNT_LOCKED';
export const ACCOUNT_LOCKED_MESSAGE = 'Your account has been locked due to repeated failed login attempts. Please contact your administrator.';
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_IDLE_MESSAGE = 'Your session expired due to inactivity. Please log in again.';
export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;
export const INVALID_LOGIN_MESSAGE = 'Invalid email or password.';
export const LOGIN_LOCKOUT_MESSAGE = 'Too many failed login attempts. Please try again in 5 minutes.';

/** Available only with the signed, HttpOnly proof issued on a lockout response. */
export interface LoginLockoutResponse {
  success: true;
  data: { locked: boolean; retryAt?: string; serverNow: string };
}

/** Public recovery response deliberately contains no eligibility or tenant information. */
export interface PasswordRecoveryResponse {
  success: true;
  message: string;
  expiresInMinutes: number;
  resendAfterSeconds: number;
}

export const PASSWORD_RECOVERY_MESSAGE = 'If an account exists with this email address, you will receive a password reset link shortly.';
export const PASSWORD_RECOVERY_RESEND_SECONDS = 60;
export const PASSWORD_RECOVERY_SEND_ERROR = 'Unable to send the password reset email. Please try again later.';
