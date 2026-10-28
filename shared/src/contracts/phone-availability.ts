import { z } from 'zod';
import { LeadPhoneSchema } from './lead.contract';

export const STAFF_PHONE_CONFLICT = 'This phone number belongs to a staff account and cannot be used.';
export const CrmPhoneAvailabilityQuerySchema = z.object({
  module: z.enum(['leads', 'contacts']),
  phone: LeadPhoneSchema,
}).strict();
export const PhoneAvailabilitySchema = z.discriminatedUnion('available', [
  z.object({ available: z.literal(true) }),
  z.object({ available: z.literal(false), reason: z.literal('STAFF_PHONE_NOT_ALLOWED') }),
]);
export type PhoneAvailability = z.infer<typeof PhoneAvailabilitySchema>;
