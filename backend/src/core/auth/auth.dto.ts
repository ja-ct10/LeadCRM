import { StrongPasswordSchema } from '@leadcrm/shared';
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export { RegisterSchema as ClientAdminRegisterSchema, RegisterSchema as GuestRegisterSchema } from '@leadcrm/shared';
export type { RegisterInput as ClientAdminRegisterDto, RegisterInput as GuestRegisterDto } from '@leadcrm/shared';

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Valid email required'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: StrongPasswordSchema,
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

export const SendRegistrationOtpSchema = z.object({
  email: z.string().email('Valid email required'),
});

export const VerifyRegistrationOtpSchema = z.object({
  email: z.string().email('Valid email required'),
  code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

export type SendRegistrationOtpDto = z.infer<typeof SendRegistrationOtpSchema>;
export type VerifyRegistrationOtpDto = z.infer<typeof VerifyRegistrationOtpSchema>;

// ─── OAuth (Google Sign-In) ───────────────────────────────────────────────────
// Posted by the NextAuth signIn callback to the backend bridge endpoint.
// The backend validates the id_token with Google before trusting any fields.
export const OAuthGoogleSchema = z.object({
  idToken: z.string().min(1, 'idToken is required').max(16384),
});
export type OAuthGoogleDto = z.infer<typeof OAuthGoogleSchema>;
export {
  CompanySetupSchema as CompleteOAuthProfileSchema,
  CompanySetupSchema as OnboardingWorkspaceSchema,
  OnboardingProgressSchema as OnboardingStepSchema,
} from '@leadcrm/shared';
export type {
  CompanySetupInput as CompleteOAuthProfileDto,
  CompanySetupInput as OnboardingWorkspaceDto,
  OnboardingProgressInput as OnboardingStepDto,
} from '@leadcrm/shared';

// ─── Resend Verification ──────────────────────────────────────────────────────
export const ResendVerificationSchema = z.object({
  email: z.string().email('Valid email required'),
});

export type ResendVerificationDto = z.infer<typeof ResendVerificationSchema>;
