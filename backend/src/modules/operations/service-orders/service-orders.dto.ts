import { z } from 'zod';

const id = () => z.string().min(1);

export const CreateServiceOrderSchema = z.object({
  title:                z.string().min(1).max(255),
  description:          z.string().optional(),
  status:               z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  scheduledDate:        z.string().datetime(),
  assignedTechnicianId: id().optional(),
  contactId:            id().optional(),
  organizationId:       id().optional(),
  dealId:               id().optional(),
  invoiceId:            id().optional(),
  notes:                z.string().optional(),
  // photos/signature are URLs to object storage -- not base64
  photos: z.object({
    before: z.array(z.string().url()).default([]),
    after:  z.array(z.string().url()).default([]),
  }).optional(),
  signature: z.string().url().optional(),
});

export const UpdateServiceOrderSchema = CreateServiceOrderSchema.partial();

export const CompleteServiceOrderSchema = z.object({
  actualDurationMins: z.number().int().positive().optional(),
  notes:              z.string().optional(),
  photos: z.object({
    before: z.array(z.string().url()).default([]),
    after:  z.array(z.string().url()).default([]),
  }).optional(),
  signature: z.string().url().optional(),
});

export type CreateServiceOrderDto   = z.infer<typeof CreateServiceOrderSchema>;
export type UpdateServiceOrderDto   = z.infer<typeof UpdateServiceOrderSchema>;
export type CompleteServiceOrderDto = z.infer<typeof CompleteServiceOrderSchema>;
