import { z } from 'zod';

export const WorkflowConditionOperatorSchema = z.enum([
  'equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal',
  'less_than_or_equal', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty',
]);
export type WorkflowConditionOperator = z.infer<typeof WorkflowConditionOperatorSchema>;
export const WorkflowConditionRuleSchema = z.object({
  field: z.string().min(1), operator: WorkflowConditionOperatorSchema,
  value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
}).strict();
export type WorkflowConditionRule = z.infer<typeof WorkflowConditionRuleSchema>;
export const WorkflowConditionSchema = z.object({
  operator: z.enum(['AND', 'OR']), conditions: z.array(WorkflowConditionRuleSchema).max(30),
}).strict();
export type WorkflowCondition = z.infer<typeof WorkflowConditionSchema>;
export type WorkflowConditionGroup = WorkflowCondition;
export const WorkflowActionSchema = z.object({
  type: z.enum(['create_task', 'send_email', 'assign_owner', 'update_field', 'create_notification', 'move_deal_stage']),
  config: z.record(z.unknown()),
}).strict();
export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;
export type WorkflowActionType = WorkflowAction['type'];
export type WorkflowEntity = 'lead' | 'contact' | 'deal';
export const WorkflowDraftSchema = z.object({
  name: z.string().trim().min(1, 'Enter a workflow name.').max(255),
  description: z.string().max(2000).nullable().optional(),
  trigger: z.string().min(1, 'Choose a trigger.'),
  conditions: WorkflowConditionSchema.nullable().optional(),
  actions: z.array(WorkflowActionSchema).max(20),
  isActive: z.boolean().default(false),
}).strict();
export type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>;
export interface Workflow extends WorkflowDraft {
  id: string; tenantId: string; environment?: 'SANDBOX' | 'PRODUCTION';
  isArchived: boolean; createdAt: string; updatedAt: string; lastRunAt?: string | null;
}
export interface WorkflowTriggerDefinition {
  type: string; label: string; entity: WorkflowEntity;
  fields: Array<{ field: string; label: string; type: 'string' | 'number' | 'boolean' }>;
}
export interface WorkflowActionDefinition {
  type: WorkflowActionType; label: string; description: string; entities: WorkflowEntity[];
  configSchema: Record<string, { type: string; label: string; required: boolean; options?: string[] }>;
}
export type TriggerDefinition = WorkflowTriggerDefinition;
export type ActionDefinition = WorkflowActionDefinition;
export interface WorkflowExecutionStep {
  id: string; tenantId: string; executionId: string; stepIndex: number; actionType: string;
  status: 'success' | 'failed' | 'skipped'; output?: Record<string, unknown> | null;
  error?: string | null; executedAt: string;
}
export interface WorkflowExecutionRun {
  id: string; tenantId: string; workflowId: string; triggerId: string; entityType: string; entityId: string;
  status: 'running' | 'completed' | 'failed' | 'skipped'; startedAt: string; completedAt?: string | null;
  errorMessage?: string | null; steps: WorkflowExecutionStep[];
  trigger: { triggerType: string; entityType: string; triggeredAt: string };
}
export interface WorkflowTestResult {
  trigger: { matched: boolean; type: string };
  conditions: { passed: number; total: number; matched: boolean };
  actions: Array<{ type: string; valid: boolean; message: string }>;
  valid: boolean;
}
