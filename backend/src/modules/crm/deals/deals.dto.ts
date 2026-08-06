import { z } from 'zod';

// ID field helper — accepts any non-empty string (UUID, CUID, or custom).
// Format validation is not a business rule; referential integrity is enforced by the DB.
const id = () => z.string().min(1);

export const CreateDealSchema = z.object({
  pipelineId:        id(),
  stageId:           id(),
  title:             z.string().min(1).max(255),
  value:             z.number().positive().optional(),
  currency:          z.string().default('PHP'),
  priority:          z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  expectedCloseDate: z.string().datetime().optional(),
  description:       z.string().optional(),
  leadSource:        z.string().optional(),
  organizationId:    id().optional(),
  assignedUserId:    id().optional(),
  contactIds:        z.array(id()).optional(),
  industry:          z.string().optional(),
  address:           z.string().optional(),
  productInterests:  z.array(z.string()).optional(),
});

export const UpdateDealSchema = CreateDealSchema.partial();

export const DealHandoffSchema = z.object({
  assignOwnerId:      id().optional(),
  kickoffDate:        z.string().datetime().optional(),
  notes:              z.string().optional(),
  createServiceOrder: z.boolean().default(false),
});

export const MoveDealStageSchema = z.object({
  stageId:    id(),
  note:       z.string().optional(),
  lostReason: z.string().optional(),
  handoff:    DealHandoffSchema.optional(),
});

export type CreateDealDto    = z.infer<typeof CreateDealSchema>;
export type UpdateDealDto    = z.infer<typeof UpdateDealSchema>;
export type MoveDealStageDto = z.infer<typeof MoveDealStageSchema>;
