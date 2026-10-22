import { hasModulePermission } from '../constants/permission-modules';
import type { PermissionAction, ResolvedPermissions } from '../types/roles';

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
  permissions?: ResolvedPermissions;
  groupGrants?: Array<{ groupId: string; groupName: string; permissions: ResolvedPermissions; assignmentRestricted: boolean }>;
}

export function hasCrmRecordAssignmentAccess(
  policy: CrmRecordAccessPolicy | undefined,
  record: { tenantId?: unknown; assignedUserId?: unknown; ownerGroupId?: unknown; status?: unknown } | undefined,
  module?: string,
  action: PermissionAction = 'canEdit',
): boolean {
  if (!policy || !record || record.tenantId !== policy.tenantId) return false;
  if (policy.clientAdmin) return true;
  if (!policy.permissions || !module) return module === 'accounts' || !policy.assignmentRestricted || record.assignedUserId === policy.userId;
  return [{ permissions: policy.permissions, assignmentRestricted: policy.assignmentRestricted, groupId: undefined }, ...(policy.groupGrants ?? [])]
    .some(grant => (!grant.groupId || grant.groupId === record.ownerGroupId) && hasModulePermission(grant.permissions, module, action) &&
      permittedCrmScopes(grant.permissions, module).some(scope => scope === 'all' || scope === 'my' && record.assignedUserId === policy.userId ||
        scope === 'active' && ['Inquiry', 'Hot', 'Warm', 'INQUIRY', 'HOT', 'WARM'].includes(String(record.status)) && record.assignedUserId === policy.userId) &&
      (module === 'accounts' || !grant.assignmentRestricted || record.assignedUserId === policy.userId));
}

/** Reassignment must be authorized by one unrestricted grant for this record. */
export function canReassignCrmRecord(policy: CrmRecordAccessPolicy | undefined,
  record: Parameters<typeof hasCrmRecordAssignmentAccess>[1], module: string): boolean {
  if (!policy) return false;
  if (!policy.permissions) return !policy.assignmentRestricted && hasCrmRecordAssignmentAccess(policy, record, module);
  return hasCrmRecordAssignmentAccess({ ...policy,
    permissions: policy.assignmentRestricted ? {} : policy.permissions,
    groupGrants: policy.groupGrants?.filter(grant => !grant.assignmentRestricted),
  }, record, module);
}
