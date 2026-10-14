import { z } from 'zod';

export const EMPLOYEE_EMAIL_DOMAIN = 'camxian.com';
export const StaffEmailSchema = z.string().refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value), 'Control characters are not allowed.')
  .transform(value => value.trim().toLowerCase()).pipe(z.string().max(254)
  .email('Enter a valid staff email.').refine(value => !value.includes('*'), 'Enter a valid staff email.'));
export const EmployeeEmailSchema = StaffEmailSchema.refine(value => value.split('@')[1] === EMPLOYEE_EMAIL_DOMAIN,
  'Use your @camxian.com employee email.');
