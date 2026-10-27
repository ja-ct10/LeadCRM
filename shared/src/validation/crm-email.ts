import { z } from 'zod';

export const INTERNAL_EMPLOYEE_CUSTOMER_EMAIL_ERROR = 'This email belongs to an internal employee account and cannot be used as a customer record.';

/** Shared manual Lead/Contact create and field-edit validation. */
export const CrmEmailSchema = z.string().trim().min(1, 'Email is required').max(254, 'Email must be 254 characters or less').email('Invalid email address');
