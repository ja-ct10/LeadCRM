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
