import type { PermissionKey } from '../../shared/constants/permissions';

/** Custom roles resolve permissions exclusively from their tenant RBAC records. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {};

export function hasPermission(
  userPermissions: string[],
  permission: PermissionKey,
): boolean {
  return userPermissions.includes(permission);
}

/**
 * getPermissionsForRole — returns the permission array for a given role string.
 * Returns empty array for unknown roles (safe default — deny all).
 */
export function getPermissionsForRole(role: string): PermissionKey[] {
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}
