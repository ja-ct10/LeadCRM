import { WorkflowDraftSchema } from '@leadcrm/shared';
import { z } from 'zod';
export const CreateWorkflowSchema = WorkflowDraftSchema;
export const UpdateWorkflowSchema = WorkflowDraftSchema.partial();
export const TestWorkflowSchema = z.object({ entityId: z.string().min(1) }).strict();
export type CreateWorkflowDto = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowDto = z.infer<typeof UpdateWorkflowSchema>;
