import { AppError } from '../../shared/errors/app-error';

/** Applied at sign-in and on every session read, including existing sessions. */
export function requireEmployeeAccount(user: { role: string; email: string }) {
  if (user.role === 'System Admin') return;
  if (!/^[^@\s]+@camxian\.com$/i.test(user.email.trim())) {
    throw new AppError('Use your Camxian employee account to access LeadCRM.', 403, 'EMPLOYEE_ACCOUNT_REQUIRED');
  }
}
