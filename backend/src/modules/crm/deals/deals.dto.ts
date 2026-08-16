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

// DI-2 fix: stageId is explicitly excluded from updates.
// Stage changes MUST go through PATCH /deals/:id/stage (moveDealStage) to ensure
// history, audit, activity, and workflow triggers fire on every transition.
export const UpdateDealSchema = CreateDealSchema.omit({ stageId: true, pipelineId: true }).partial();

export const DealHandoffSchema = z.object({
  assignOwnerId:      id().optional(),
  kickoffDate:        z.string().datetime().optional(),
  notes:              z.string().optional(),
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
