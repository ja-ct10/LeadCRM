import { z } from 'zod';

// Query param schema for report endpoints
export const ReportQuerySchema = z.object({
  pipelineId: z.string().cuid().optional(),
  from:       z.string().datetime().optional(),
  to:         z.string().datetime().optional(),
  userId:     z.string().cuid().optional(),
});

export type ReportQueryDto = z.infer<typeof ReportQuerySchema>;
