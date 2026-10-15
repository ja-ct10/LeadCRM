import { z } from 'zod';
import { cleanText } from '../validation/administration-user.schema';
import { CustomFieldValuesSchema } from './closing-requirements';
import { COMPANY_SIZE_OPTIONS } from './record-experience';

/** A retry identity belongs to this Account creation, including saves from edit forms. */
export const NewAccountSchema = z.object({
  requestId: z.string().uuid(),
  name: cleanText(255).pipe(z.string().min(1, 'Company name is required.')),
  industry: cleanText(2000).optional(),
  size: z.enum(COMPANY_SIZE_OPTIONS).optional(),
  website: z.string().trim().url('Must be a valid URL').optional().or(z.literal('')),
  customFieldValues: CustomFieldValuesSchema.optional(),
}).strict();
export type NewAccountInput = z.infer<typeof NewAccountSchema>;
export interface AccountSummary {
  id: string; name: string; industry?: string | null; size?: string | null; website?: string | null;
}
export function exclusiveAccountInput(input: { accountId?: unknown; newAccount?: unknown }) {
  return !input.newAccount || !input.accountId;
}
