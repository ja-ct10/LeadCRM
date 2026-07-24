import { z } from 'zod';

export const CreateDealSchema = z.object({
  pipelineId:        z.string().cuid(),
  stageId:           z.string().cuid(),
  title:             z.string().min(1).max(255),
  value:             z.number().positive().optional(),
  currency:          z.string().default('PHP'),
  priority:          z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  expectedCloseDate: z.string().datetime().optional(),
  description:       z.string().optional(),
  leadSource:        z.string().optional(),
  organizationId:    z.string().cuid().optional(),
  assignedUserId:    z.string().cuid().optional(),
  contactIds:        z.array(z.string().cuid()).optional(),
  industry:          z.string().optional(),
  address:           z.string().optional(),
  productInterests:  z.array(z.string()).optional(),
});

export const UpdateDealSchema = CreateDealSchema.partial();

export const DealHandoffSchema = z.object({
  assignOwnerId: z.string().cuid().optional(),
  kickoffDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  createServiceOrder: z.boolean().default(false),
});

export const MoveDealStageSchema = z.object({
  stageId:    z.string().cuid(),
  note:       z.string().optional(),
  lostReason: z.string().optional(),
  handoff:    DealHandoffSchema.optional(),
});

export type CreateDealDto   = z.infer<typeof CreateDealSchema>;
export type UpdateDealDto   = z.infer<typeof UpdateDealSchema>;
export type MoveDealStageDto = z.infer<typeof MoveDealStageSchema>;
