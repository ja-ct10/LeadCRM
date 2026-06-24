// ─── Workflow, Automation Engine ───────────────────────────────────────────
import type { Contact } from './contact.types';
import type { Deal } from './deal.types';

export interface WorkflowAction {
  id: string;
  type: string;
  config?: { taskTitle?: string; taskDescription?: string; templateId?: string; [key: string]: unknown };
  delay?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
}

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category?: 'Security' | 'Telecom' | 'IT' | 'General';
  status: 'active' | 'paused';
  trigger: string;
  condition?: string;
  action?: string;
  actionConfig?: { taskTitle?: string; taskDescription?: string; templateId?: string };
  delay?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
  actions?: WorkflowAction[];
  executionCount: number;
  isArchived?: boolean;
}

export interface PendingAction {
  id: string;
  workflowId: string;
  tenantId: string;
  executeAt: string;
  trigger: string;
  context: { contact?: Contact; deal?: Deal };
  actionId?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  tenantId: string;
  timestamp: string;
  status: 'success' | 'failure';
  details: string;
  relatedEntityId?: string;
}

// ─── Three-level workflow execution (replaces single WorkflowExecution log) ─

export interface WorkflowTriggerRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  triggerType: string;               // e.g. 'contact.created', 'deal.stage_changed'
  entityType: string;
  entityId: string;
  triggeredAt: string;
  payload: Record<string, unknown>;
}

export interface WorkflowExecutionRun {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowName: string;
  triggerId: string;                 // → WorkflowTriggerRecord.id
  entityType: string;
  entityId: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
}

export interface WorkflowExecutionStep {
  id: string;
  executionId: string;               // → WorkflowExecutionRun.id
  tenantId: string;
  stepIndex: number;
  actionType: string;                // e.g. 'create_task', 'send_email', 'assign_owner'
  status: 'success' | 'failed' | 'skipped';
  output?: Record<string, unknown>;  // what was created (task id, email id, etc.)
  error?: string;
  executedAt: string;
}
