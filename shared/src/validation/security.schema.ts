import { z } from 'zod';

export const EMPLOYEE_EMAIL_DOMAIN = 'camxian.com';
export const EmployeeEmailSchema = z.string().refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value), 'Control characters are not allowed.')
  .transform(value => value.trim().toLowerCase()).pipe(z.string().max(254)
  .email('Enter a valid employee email.')
  .refine(value => value.split('@').length === 2 && value.split('@')[1] === EMPLOYEE_EMAIL_DOMAIN,
    'Use your @camxian.com employee email.'));
export const TotpCodeSchema = z.string().regex(/^\d{6}$/, 'Enter a 6-digit authenticator code.');
export const MfaProofSchema = z.string().regex(/^(?:\d{6}|[a-f0-9]{8}-[a-f0-9]{8})$/, 'Enter a 6-digit authenticator code or a recovery code.');
export const CurrentPasswordSchema = z.string().min(1, 'Current password is required.').max(72);
export const MfaSetupSchema = z.object({ currentPassword: CurrentPasswordSchema }).strict();
export const MfaEnableSchema = z.object({ code: TotpCodeSchema }).strict();
export const MfaVerifySchema = z.object({ code: MfaProofSchema }).strict();
export const MfaManageSchema = z.object({ currentPassword: CurrentPasswordSchema, code: MfaProofSchema }).strict();
