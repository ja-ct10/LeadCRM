import { z } from 'zod';

// WorkflowCondition — stored as JSON in Workflow.conditions
// NEVER eval()'d — evaluated as pure data by workflow.engine.ts
const ConditionRuleSchema = z.object({
  field:    z.string(),
  operator: z.enum([
    'equals', 'not_equals', 'greater_than', 'less_than',
    'greater_than_or_equal', 'less_than_or_equal',
    'contains', 'not_contains', 'starts_with', 'ends_with',
    'is_empty', 'is_not_empty',
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

const WorkflowConditionSchema = z.object({
  operator:   z.enum(['AND', 'OR']),
  conditions: z.array(ConditionRuleSchema),
});

// WorkflowAction — one step in the actions array
const WorkflowActionSchema = z.object({
  type:   z.enum([
    'create_task', 'send_email', 'send_sms', 'assign_owner',
    'update_field', 'create_notification', 'move_deal_stage',
    'add_tag', 'remove_tag', 'create_activity',
  ]),
  config: z.record(z.unknown()),
});

export const CreateWorkflowSchema = z.object({
  name:        z.string().min(1).max(255),
  description: z.string().optional(),
  trigger:     z.string().min(1),    // e.g. 'contact.status_changed'
  conditions:  WorkflowConditionSchema.optional(),
  actions:     z.array(WorkflowActionSchema).min(1),
  isActive:    z.boolean().default(false),
});

export const UpdateWorkflowSchema = CreateWorkflowSchema.partial();

export type CreateWorkflowDto = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowDto = z.infer<typeof UpdateWorkflowSchema>;
