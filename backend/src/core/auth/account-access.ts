import { AppError } from '../../shared/errors/app-error';

/** Applied at sign-in and on every session read, including existing sessions. */
export function requireEmployeeAccount(user: { role: string; email: string }) {
  // Historical accounts remain in storage, but can never establish or reuse a session.
  if (user.role.trim().toLowerCase() === 'guest') {
    throw new AppError('This account role has been retired. Contact your administrator.', 403, 'ROLE_RETIRED');
  }
  if (user.role === 'System Admin') return;
  if (!/^[^@\s]+@camxian\.com$/i.test(user.email.trim())) {
    throw new AppError('Use your Camxian employee account to access LeadCRM.', 403, 'EMPLOYEE_ACCOUNT_REQUIRED');
  }
}
