import { ForgotPasswordSchema } from '@leadcrm/shared';

export const REMEMBERED_EMAIL_KEY = 'leadcrm:remembered-email';

export function readRememberedEmail(): string {
  try {
    const parsed = ForgotPasswordSchema.safeParse({ email: localStorage.getItem(REMEMBERED_EMAIL_KEY) });
    return parsed.success ? parsed.data.email : '';
  } catch { return ''; }
}

/** Login preference only: never store passwords, credentials, or authenticated state. */
export function rememberLoginEmail(email: string, remember: boolean): void {
  try {
    const parsed = ForgotPasswordSchema.safeParse({ email });
    if (remember && parsed.success) localStorage.setItem(REMEMBERED_EMAIL_KEY, parsed.data.email);
    else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch { /* Optional browser preferences must not prevent authentication. */ }
}
