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
});

export const UpdateDealSchema = CreateDealSchema.partial();

export const MoveDealStageSchema = z.object({
  stageId:    z.string().cuid(),
  note:       z.string().optional(),
  lostReason: z.string().optional(),
});

export type CreateDealDto   = z.infer<typeof CreateDealSchema>;
export type UpdateDealDto   = z.infer<typeof UpdateDealSchema>;
export type MoveDealStageDto = z.infer<typeof MoveDealStageSchema>;
