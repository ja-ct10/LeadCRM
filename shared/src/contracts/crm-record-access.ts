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
