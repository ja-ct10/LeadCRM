import { z } from 'zod';

export const CreateCompanySchema = z.object({
  name:           z.string().min(1).max(255),
  industry:       z.string().optional(),
  size:           z.enum(['1-10', '11-50', '51-200', '200+']).optional(),
  website:        z.string().url().optional().or(z.literal('')),
  taxId:          z.string().optional(),
  tags:           z.array(z.string()).default([]),
  address:        z.string().optional(),
  city:           z.string().optional(),
  province:       z.string().optional(),
  country:        z.string().default('Philippines'),
  assignedUserId: z.string().cuid().optional(),
  notes:          z.string().optional(),
  internalNotes:  z.string().optional(),
  productInterests: z.array(z.string()).optional(),
  customerType:   z.enum(['Prospect', 'Active Customer', 'Inactive Customer', 'Former Customer']).optional(),
  customerSince:  z.string().datetime().optional(),
  activeProducts: z.array(z.string()).optional(),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();

export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyDto = z.infer<typeof UpdateCompanySchema>;
