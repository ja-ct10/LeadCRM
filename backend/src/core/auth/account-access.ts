import { AppError } from '../../shared/errors/app-error';
import { EmployeeEmailSchema } from '@leadcrm/shared';
import { z } from 'zod';

export function isAllowlistedDevelopmentGmail(email: string): boolean {
  if (!['development', 'test'].includes(process.env.NODE_ENV ?? '') || process.env.LEADCRM_TEST_AUTH_ENABLED !== 'true') {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.includes('*') || !normalizedEmail.endsWith('@gmail.com') || !z.string().email().safeParse(normalizedEmail).success) return false;

  return (process.env.LEADCRM_TEST_EMAIL_ALLOWLIST ?? '')
    .split(',')
    .some(allowedEmail => allowedEmail.trim().toLowerCase() === normalizedEmail);
}

/** Applied at sign-in and on every session read, including existing sessions. */
export function requireEmployeeAccount(user: { role: string; email: string }) {
  // Historical accounts remain in storage, but can never establish or reuse a session.
  if (user.role.trim().toLowerCase() === 'guest') {
    throw new AppError('This account role has been retired. Contact your administrator.', 403, 'ROLE_RETIRED');
  }
  if (!EmployeeEmailSchema.safeParse(user.email).success && !isAllowlistedDevelopmentGmail(user.email)) {
    throw new AppError('Use your Camxian employee account to access LeadCRM.', 403, 'EMPLOYEE_ACCOUNT_REQUIRED');
  }
}
