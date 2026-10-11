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
): boolean {
  if (!policy || !record || record.tenantId !== policy.tenantId) return false;
  return policy.clientAdmin || !policy.assignmentRestricted || record.assignedUserId === policy.userId;
}
