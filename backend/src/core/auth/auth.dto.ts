import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const ClientAdminRegisterSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  companyName: z.string().min(2, 'Company name is required'),
  companySize: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
});

export const GuestRegisterSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type ClientAdminRegisterDto = z.infer<typeof ClientAdminRegisterSchema>;
export type GuestRegisterDto = z.infer<typeof GuestRegisterSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Valid email required'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

export const SendOtpSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email('Valid email required'),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const SendRegistrationOtpSchema = z.object({
  email: z.string().email('Valid email required'),
});

export const VerifyRegistrationOtpSchema = z.object({
  email: z.string().email('Valid email required'),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export type SendOtpDto = z.infer<typeof SendOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
export type SendRegistrationOtpDto = z.infer<typeof SendRegistrationOtpSchema>;
export type VerifyRegistrationOtpDto = z.infer<typeof VerifyRegistrationOtpSchema>;


// ─── OAuth (Google Sign-In) ───────────────────────────────────────────────────
// Posted by the NextAuth signIn callback to the backend bridge endpoint.
// The backend validates the id_token with Google before trusting any fields.
export const OAuthGoogleSchema = z.object({
  providerAccountId: z.string().min(1, 'providerAccountId is required'),
  idToken:           z.string().min(1, 'idToken is required'),
  accessToken:       z.string().optional(),
  refreshToken:      z.string().optional(),
  expiresAtEpoch:    z.number().int().positive().optional(),
  scope:             z.string().optional(),
  // Profile fields pre-populated from the OIDC id_token claims
  email:             z.string().email('Valid email required'),
  firstName:         z.string().min(1, 'firstName is required'),
  lastName:          z.string().default(''),
  avatarUrl:         z.string().url().optional(),
  emailVerified:     z.boolean(),
});

export type OAuthGoogleDto = z.infer<typeof OAuthGoogleSchema>;

// ─── Complete OAuth Profile ───────────────────────────────────────────────────
// PATCH /api/v1/auth/oauth/complete-profile
// Called after new Google OAuth user fills in their company details.
// Note: country is accepted but not persisted — Tenant model has no country field.
export const CompleteOAuthProfileSchema = z.object({
  companyName:  z.string().min(2, 'Company name is required'),
  industry:     z.string().min(1, 'Industry is required'),
  companySize:  z.string().min(1, 'Company size is required'),
  country:      z.string().optional(),
});

export type CompleteOAuthProfileDto = z.infer<typeof CompleteOAuthProfileSchema>;
