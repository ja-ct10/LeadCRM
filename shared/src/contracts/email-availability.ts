import { z } from 'zod';
import { CrmEmailSchema } from '../validation/crm-email';
import { StaffEmailSchema } from '../validation/security.schema';

export const EMAIL_AVAILABILITY_MESSAGES = {
  STAFF_EMAIL_NOT_ALLOWED: 'This email belongs to a staff account and cannot be used.',
  EMAIL_IN_USE: 'A user with this email already exists in this tenant',
  EXTERNAL_STAFF_EMAIL_NOT_ALLOWED: 'Only Client Admin users can approve an external staff email.',
} as const;

export const CrmEmailAvailabilityQuerySchema = z.object({
  module: z.enum(['leads', 'contacts']),
  email: CrmEmailSchema,
}).strict();
export const UserEmailAvailabilityQuerySchema = z.object({ email: StaffEmailSchema }).strict();
export const PublicFormEmailAvailabilityQuerySchema = CrmEmailAvailabilityQuerySchema.omit({ module: true });
export const EmailAvailabilitySchema = z.discriminatedUnion('available', [
  z.object({ available: z.literal(true) }),
  z.object({ available: z.literal(false), reason: z.enum(['STAFF_EMAIL_NOT_ALLOWED', 'EMAIL_IN_USE', 'EXTERNAL_STAFF_EMAIL_NOT_ALLOWED']) }),
]);
export type EmailAvailability = z.infer<typeof EmailAvailabilitySchema>;
export type EmailAvailabilityReason = Extract<EmailAvailability, { available: false }>['reason'];
