/**
 * Central re-export for all domain types.
 * Import from here — never from individual files directly.
 */

export type { Role, Permission, RoleDefinition, User, Tenant } from './user.types';
export type { Organization, Contact } from './contact.types';
export type { DealOwnershipRecord, Stage, Pipeline, Deal } from './deal.types';
export type {
  WorkflowAction, Workflow, PendingAction,
  WorkflowExecution,
  WorkflowTriggerRecord, WorkflowExecutionRun, WorkflowExecutionStep,
} from './workflow.types';
export type { Campaign, Template } from './campaign.types';
export type {
  AuditLog,
  ActivityType, Activity,
  Task, TaskStatus, TaskAssignmentRecord,
  ServiceOrder, Asset, InventoryItem,
  Invoice,
} from './shared.types';
export type { Lead, CreateLeadRequest, UpdateLeadRequest } from './lead.types';
export type { Customer } from './customer.types';
