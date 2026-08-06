import { z } from 'zod';

const id = () => z.string().min(1);

export const CreatePipelineSchema = z.object({
  name:     z.string().min(1).max(100),
  currency: z.string().default('PHP'),
});

export const UpdatePipelineSchema = CreatePipelineSchema.partial();

export const CreateStageSchema = z.object({
  pipelineId:  id(),
  name:        z.string().min(1).max(100),
  order:       z.number().int().positive(),
  probability: z.number().int().min(0).max(100).optional(),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().optional(),
  isWon:       z.boolean().default(false),
  isLost:      z.boolean().default(false),
});

export const UpdateStageSchema   = CreateStageSchema.omit({ pipelineId: true }).partial();
export const ReorderStagesSchema = z.object({ stageIds: z.array(id()) });

export type CreatePipelineDto  = z.infer<typeof CreatePipelineSchema>;
export type UpdatePipelineDto  = z.infer<typeof UpdatePipelineSchema>;
export type CreateStageDto     = z.infer<typeof CreateStageSchema>;
export type UpdateStageDto     = z.infer<typeof UpdateStageSchema>;
export type ReorderStagesDto   = z.infer<typeof ReorderStagesSchema>;
