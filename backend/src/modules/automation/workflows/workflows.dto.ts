import { WorkflowDraftSchema, WorkflowValidationSchema, WorkflowTestInputSchema } from '@leadcrm/shared';
import { z } from 'zod';
export const CreateWorkflowSchema = WorkflowDraftSchema;
export const ValidateWorkflowSchema = WorkflowValidationSchema;
export const UpdateWorkflowSchema = WorkflowDraftSchema.partial();
export const TestWorkflowSchema = WorkflowTestInputSchema;
export type CreateWorkflowDto = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowDto = z.infer<typeof UpdateWorkflowSchema>;

export const WorkflowStateSchema = z.object({ isActive: z.boolean() }).strict();
