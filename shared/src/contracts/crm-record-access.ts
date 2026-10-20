import { hasModulePermission } from '../constants/permission-modules';
import type { ResolvedPermissions } from '../types/roles';

export const CRM_SCOPE_ACTIONS = { all: 'canViewAll', my: 'canViewMy', active: 'canViewActive' } as const;
export type CrmReadScope = keyof typeof CRM_SCOPE_ACTIONS;
export const CRM_MODULE_KEYS = ['leads', 'contacts', 'accounts', 'deals'] as const;

export function permittedCrmScopes(permissions: ResolvedPermissions, module: string): CrmReadScope[] {
  return (Object.keys(CRM_SCOPE_ACTIONS) as CrmReadScope[]).filter(scope => hasModulePermission(permissions, module, CRM_SCOPE_ACTIONS[scope]));
}

/** Server-resolved from the current tenant's RoleDefinition/UserRole assignments. */
export interface CrmRecordAccessPolicy {
  userId: string;
  tenantId: string;
  assignmentRestricted: boolean;
  clientAdmin: boolean;
}

export function hasCrmRecordAssignmentAccess(
  policy: CrmRecordAccessPolicy | undefined,
  record: { tenantId?: unknown; assignedUserId?: unknown } | undefined,
  module?: string,
): boolean {
  if (!policy || !record || record.tenantId !== policy.tenantId) return false;
  return module === 'accounts' || policy.clientAdmin || !policy.assignmentRestricted || record.assignedUserId === policy.userId;
}
