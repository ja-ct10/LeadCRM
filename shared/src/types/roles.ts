/**
 * Roles & Permissions — shared types used by both frontend and backend.
 * Spec 5 Phase B.
 */

export interface PermissionFlags {
  canView:   boolean;
  canCreate: boolean;
  canEdit:   boolean;
  canDelete: boolean;
}

export interface RolePermissionRow extends PermissionFlags {
  id:     string;
  roleId: string;
  module: string;
}

export interface AssignedUser {
  id:        string;
  firstName: string;
  lastName:  string;
  email:     string;
  role:      string;
  status:    string;
}

export interface RoleListItem {
  id:          string;
  tenantId:    string;
  name:        string;
  description: string | null;
  isSystemRole: boolean;
  isArchived:  boolean;
  userCount:   number;
  permissions: RolePermissionRow[];
  createdAt:   string;
  updatedAt:   string;
}

export interface RoleDetail extends RoleListItem {
  assignedUsers: AssignedUser[];
}

/** Map of module key → resolved permission flags for a user. */
export type ResolvedPermissions = Record<string, PermissionFlags>;

export type PermissionAction = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';

export interface PermissionModuleDefinition {
  /** e.g. "contacts" */
  key:     string;
  /** e.g. "Contacts" */
  label:   string;
  actions: PermissionAction[];
}
