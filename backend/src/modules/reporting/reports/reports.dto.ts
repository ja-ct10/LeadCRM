import { z } from 'zod';

const id = () => z.string().min(1);

// Query param schema for report endpoints
export const ReportQuerySchema = z.object({
  pipelineId: id().optional(),
  from:       z.string().datetime().optional(),
  to:         z.string().datetime().optional(),
  userId:     id().optional(),
});

export type ReportQueryDto = z.infer<typeof ReportQuerySchema>;
