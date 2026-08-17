/**
 * Contact form validation schemas — mirrors backend CreateContactSchema/UpdateContactSchema
 * from backend/src/modules/crm/contacts/contacts.dto.ts
 */
import { z } from 'zod';

export const CreateContactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name must be 100 characters or less'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name must be 100 characters or less'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  status: z.string().default('Inquiry'),
  source: z.string().optional(),
  accountId: z.string().min(1).optional().or(z.literal('')),
  assignedUserId: z.string().min(1).optional().or(z.literal('')),
  productInterest: z.array(z.string()).optional(),
  address: z.string().optional(),
});

export const UpdateContactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name must be 100 characters or less').optional(),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name must be 100 characters or less').optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  accountId: z.string().min(1).optional().or(z.literal('')),
  assignedUserId: z.string().min(1).optional().or(z.literal('')),
  productInterest: z.array(z.string()).optional(),
  address: z.string().optional(),
});

export type CreateContactFormValues = z.infer<typeof CreateContactFormSchema>;
export type UpdateContactFormValues = z.infer<typeof UpdateContactFormSchema>;
