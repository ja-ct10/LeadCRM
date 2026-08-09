/**
 * Re-export shim — do NOT add type definitions here.
 * All canonical types live in store/types/*.ts
 */
export type {
  Role, Permission, RoleDefinition, User, Tenant,
  Organization, Contact,
  DealOwnershipRecord, Stage, Pipeline, Deal,
  WorkflowAction, Workflow, PendingAction,
  WorkflowExecution,
  WorkflowTriggerRecord, WorkflowExecutionRun, WorkflowExecutionStep,
  Campaign, Template,
  AuditLog,
  ActivityType, Activity,
  Task, TaskStatus, TaskAssignmentRecord,
  ServiceOrder, Asset, InventoryItem,
  Invoice,
  Lead, CreateLeadRequest, UpdateLeadRequest,
  Customer,
} from './types/index';
