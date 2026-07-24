import { z } from 'zod';

export const CreateContactSchema = z.object({
  firstName:      z.string().min(1, 'First name is required').max(100),
  lastName:       z.string().min(1, 'Last name is required').max(100),
  email:          z.string().email('Invalid email address').optional().or(z.literal('')),
  phone:          z.string().optional(),
  company:        z.string().optional(),
  jobTitle:       z.string().optional(),
  linkedinUrl:    z.string().url().optional().or(z.literal('')),
  status:         z.enum(['HOT', 'WARM', 'COLD', 'CANCELLED', 'CLOSED']).default('WARM'),
  score:          z.number().int().min(0).max(100).optional(),
  source:         z.string().optional(),
  notes:          z.string().optional(),
  doNotContact:   z.boolean().default(false),
  organizationId: z.string().cuid().optional(),
  assignedUserId: z.string().cuid().optional(),
  productInterests: z.array(z.string()).optional(),
  address:        z.string().optional(),
  customerType:   z.enum(['Prospect', 'Active Customer', 'Inactive Customer', 'Former Customer']).optional(),
  customerSince:  z.string().datetime().optional(),
  activeProducts: z.array(z.string()).optional(),
}).refine(
  (data) => true, // Remove strict email/phone requirement to allow UI flexibility
  { message: 'Valid record', path: [] },
);

export const UpdateContactSchema = z.object({
  firstName:      z.string().min(1).max(100).optional(),
  lastName:       z.string().min(1).max(100).optional(),
  email:          z.string().email().optional().or(z.literal('')),
  phone:          z.string().optional(),
  company:        z.string().optional(),
  jobTitle:       z.string().optional(),
  linkedinUrl:    z.string().url().optional().or(z.literal('')),
  status:         z.enum(['HOT', 'WARM', 'COLD', 'CANCELLED', 'CLOSED']).optional(),
  score:          z.number().int().min(0).max(100).optional(),
  source:         z.string().optional(),
  notes:          z.string().optional(),
  doNotContact:   z.boolean().optional(),
  organizationId: z.string().cuid().optional(),
  assignedUserId: z.string().cuid().optional(),
  productInterests: z.array(z.string()).optional(),
  address:        z.string().optional(),
  customerType:   z.enum(['Prospect', 'Active Customer', 'Inactive Customer', 'Former Customer']).optional(),
  customerSince:  z.string().datetime().optional(),
  activeProducts: z.array(z.string()).optional(),
});

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;
