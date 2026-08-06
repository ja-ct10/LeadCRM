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

export type SendOtpDto = z.infer<typeof SendOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
