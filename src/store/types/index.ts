/**
 * Central re-export for all domain types.
 *
 * Import from here instead of individual files so no component
 * import paths change when types are reorganised.
 *
 * @example
 *   import { Contact, Deal, User } from '../../store/types';
 */

export type { Role, Permission, RoleDefinition, User, Tenant } from './user.types';
export type { Organization, Contact } from './contact.types';
export type { Stage, Pipeline, Deal } from './deal.types';
export type { WorkflowAction, Workflow, PendingAction, WorkflowExecution } from './workflow.types';
export type { Campaign, Template } from './campaign.types';
export type { AuditLog, Task, ServiceOrder, Asset, InventoryItem } from './shared.types';
