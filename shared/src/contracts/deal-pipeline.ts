import { z } from 'zod';

/** Pipeline and stage must be committed together by the transfer endpoint. */
export const MoveDealPipelineSchema = z.object({
  pipelineId: z.string().trim().min(1),
  stageId: z.string().trim().min(1),
}).strict();
export type MoveDealPipelineInput = z.infer<typeof MoveDealPipelineSchema>;
