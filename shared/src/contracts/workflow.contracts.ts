/**
 * WorkflowCondition — the ONLY allowed format for Workflow.conditions JSON.
 *
 * NEVER eval() or execute this string as code.
 * The workflow engine MUST parse this as structured data only.
 *
 * Stored as JSON in: Workflow.conditions (Json? column)
 */
export interface WorkflowCondition {
  operator:   'AND' | 'OR';
  conditions: WorkflowConditionRule[];
}

export interface WorkflowConditionRule {
  field:    string;      // e.g. "contact.status" | "deal.value" | "deal.stage.isWon"
  operator: WorkflowConditionOperator;
  value:    string | number | boolean | null;
}

export type WorkflowConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty';

/**
 * WorkflowAction — one step in Workflow.actions JSON array.
 */
export interface WorkflowAction {
  type:   WorkflowActionType;
  config: Record<string, unknown>;  // action-specific config
}

export type WorkflowActionType =
  | 'create_task'
  | 'send_email'
  | 'send_sms'
  | 'assign_owner'
  | 'update_field'
  | 'create_notification'
  | 'move_deal_stage'
  | 'add_tag'
  | 'remove_tag'
  | 'create_activity';

/**
 * Example condition stored in Workflow.conditions:
 *
 * {
 *   operator: 'AND',
 *   conditions: [
 *     { field: 'contact.status', operator: 'equals', value: 'HOT' },
 *     { field: 'deal.value',     operator: 'greater_than', value: 100000 }
 *   ]
 * }
 */
