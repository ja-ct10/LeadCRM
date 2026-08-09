import { z } from 'zod';

const id = () => z.string().min(1);

// Lead model fields (schema ground truth):
// firstName, lastName, email, phone, source, status (String, default "Inquiry"),
// accountId, assignedUserId, productInterest[], address, companyName, createdAt

export const CreateContactSchema = z.object({
  firstName:      z.string().min(1, 'First name is required').max(100),
  lastName:       z.string().min(1, 'Last name is required').max(100),
  email:          z.string().email('Invalid email address').optional().or(z.literal('')),
  phone:          z.string().optional(),
  companyName:    z.string().optional(),
  status:         z.string().default('Inquiry'),
  source:         z.string().optional(),
  accountId:      id().optional(),
  assignedUserId: id().optional(),
  productInterest: z.array(z.string()).optional(),
  address:        z.string().optional(),
});

export const UpdateContactSchema = z.object({
  firstName:      z.string().min(1).max(100).optional(),
  lastName:       z.string().min(1).max(100).optional(),
  email:          z.string().email().optional().or(z.literal('')),
  phone:          z.string().optional(),
  companyName:    z.string().optional(),
  status:         z.string().optional(),
  source:         z.string().optional(),
  accountId:      id().optional(),
  assignedUserId: id().optional(),
  productInterest: z.array(z.string()).optional(),
  address:        z.string().optional(),
});

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;

// ── Convert Lead → linked to Account + optional Deal ─────────────────────────
export const ConvertContactSchema = z.object({
  accountId:    z.string().min(1).optional(), // link to existing account
  accountName:  z.string().min(1).optional(), // or create a new account
  createDeal:      z.boolean().default(false),
  dealTitle:       z.string().min(1).max(255).optional(),
  dealValue:       z.number().positive().optional(),
  dealPipelineId:  z.string().min(1).optional(),
  dealPriority:    z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
}).refine(
  (data) => data.accountId || data.accountName,
  { message: 'Either accountId or accountName is required', path: ['accountId'] },
);

export type ConvertContactDto = z.infer<typeof ConvertContactSchema>;
