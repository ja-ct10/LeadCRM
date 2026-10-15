import { z } from 'zod';

// ── Zod schemas mirroring backend CreateCompanySchema / UpdateCompanySchema ──
// Backend route POST /crm/accounts validates against CreateCompanySchema from companies.dto.ts.

import { AccountFieldsSchema } from '@leadcrm/shared';
export { COMPANY_SIZE_OPTIONS } from '@leadcrm/shared';


export const CreateAccountSchema = AccountFieldsSchema.extend({
  size: AccountFieldsSchema.shape.size.or(z.literal('')),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const UpdateAccountSchema = CreateAccountSchema.partial();

export type CreateAccountFormData = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountFormData = z.infer<typeof UpdateAccountSchema>;

// Unified form data type (used for both create and edit modes)
export type AccountFormValues = CreateAccountFormData;
