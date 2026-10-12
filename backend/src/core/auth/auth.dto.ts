import { StrongPasswordSchema } from '@leadcrm/shared';
export { ForgotPasswordSchema } from '@leadcrm/shared';
import { ForgotPasswordSchema } from '@leadcrm/shared';
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Valid email required'),
  password: z.string().min(1, 'Password is required').max(72),
});
// The identity gate precedes password validation so any sixth submission for a
// valid identity triggers cooldown, including a malformed/empty password body.
export const LoginIdentitySchema = LoginSchema.pick({ email: true }).passthrough();

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const LoginLockoutSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email().optional(),
});

export type LoginDto = z.infer<typeof LoginSchema>;


export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: StrongPasswordSchema,
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
