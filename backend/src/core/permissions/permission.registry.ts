import { PermissionKey } from '../../shared/constants/permissions';
import { Role } from '../../shared/constants/roles';

// Default permission sets per built-in role
// Client Admin bypasses this entirely (handled at middleware level)
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  [Role.SALES_REP]: [
    'contacts.view', 'contacts.create', 'contacts.edit',
    'deals.view', 'deals.create', 'deals.edit',
    'campaigns.view',
    'reports.view',
  ],
  [Role.TECHNICIAN]: [
    'contacts.view',
    'deals.view',
  ],
  [Role.VIEWER]: [
    'contacts.view',
    'deals.view',
    'campaigns.view',
    'reports.view',
  ],
};

export function hasPermission(userPermissions: string[], permission: PermissionKey): boolean {
  return userPermissions.includes(permission);
}
