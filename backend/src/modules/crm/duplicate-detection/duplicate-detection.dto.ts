import { z } from 'zod';

/**
 * Duplicate Check DTO — validates the request body for POST /crm/duplicate-check.
 * At least one search field (email, phone, firstName+lastName, companyName) is required.
 */
export const DuplicateCheckSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  excludeId: z.string().min(1).optional(),
  entityTypes: z
    .array(z.enum(['lead', 'contact', 'account']))
    .optional()
    .default(['lead', 'contact', 'account']),
}).refine(
  (data) => data.email || data.phone || (data.firstName && data.lastName) || data.companyName,
  { message: 'At least one search field is required (email, phone, firstName+lastName, or companyName)', path: [] },
);

export type DuplicateCheckDto = z.infer<typeof DuplicateCheckSchema>;
