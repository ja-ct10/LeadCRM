import { z } from 'zod';

const id = () => z.string().min(1);

export const CreateCustomerSchema = z.object({
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
  doNotCustomer:   z.boolean().default(false),
  organizationId: id().optional(),
  assignedUserId: id().optional(),
  productInterests: z.array(z.string()).optional(),
  address:        z.string().optional(),
  customerType:   z.enum(['Prospect', 'Active Customer', 'Inactive Customer', 'Former Customer']).optional(),
  customerSince:  z.string().datetime().optional(),
  activeProducts: z.array(z.string()).optional(),
}).refine(
  () => true,
  { message: 'Valid record', path: [] },
);

export const UpdateCustomerSchema = z.object({
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
  doNotCustomer:   z.boolean().optional(),
  organizationId: id().optional(),
  assignedUserId: id().optional(),
  productInterests: z.array(z.string()).optional(),
  address:        z.string().optional(),
  customerType:   z.enum(['Prospect', 'Active Customer', 'Inactive Customer', 'Former Customer']).optional(),
  customerSince:  z.string().datetime().optional(),
  activeProducts: z.array(z.string()).optional(),
});

export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerSchema>;

// ── Convert Customer (Customer → Customer + Account + optional Deal) ────────
export const ConvertCustomerSchema = z.object({
  organizationId:  z.string().min(1).optional(), // link to existing org
  organizationName: z.string().min(1).optional(), // or create a new one
  createDeal:      z.boolean().default(false),
  dealTitle:       z.string().min(1).max(255).optional(),
  dealValue:       z.number().positive().optional(),
  dealPipelineId:  z.string().min(1).optional(),
  dealPriority:    z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
}).refine(
  (data) => data.organizationId || data.organizationName,
  { message: 'Either organizationId or organizationName is required', path: ['organizationId'] },
);

export type ConvertCustomerDto = z.infer<typeof ConvertCustomerSchema>;
