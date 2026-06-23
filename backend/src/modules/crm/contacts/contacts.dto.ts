import { z } from 'zod';

export const CreateContactSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(['HOT', 'WARM', 'COLD', 'CANCELLED', 'CLOSED']).default('WARM'),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateContactSchema = CreateContactSchema.partial();

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;
