import { z } from 'zod';
import { recordText, recordName } from '../record-validation';
export const CreateClientContactSchema = z.object({
  firstName: recordName(), lastName: recordName(),
  email: z.string().trim().email().or(z.literal('')).optional(),
  phone: recordText(100).optional(), company: recordText().optional(),
  address: recordText().optional(), jobTitle: recordText().optional(),
  source: recordText().optional(), notes: recordText(10000).optional(),
  status: z.enum(['HOT', 'WARM', 'COLD', 'CLOSED', 'CANCELLED']).default('WARM'),
  accountId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  productInterests: z.array(recordName(200)).max(100).optional(),
});
export const UpdateClientContactSchema = CreateClientContactSchema.partial();
