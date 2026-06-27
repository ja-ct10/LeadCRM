import { Permission } from '../../shared/constants/permissions';

// Maps built-in roles to their default permission sets
// Used during tenant provisioning and role seeding
export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  'Sales Rep': [
    Permission.CONTACTS_VIEW,
    Permission.CONTACTS_CREATE,
    Permission.CONTACTS_EDIT,
    Permission.DEALS_VIEW,
    Permission.DEALS_CREATE,
    Permission.DEALS_EDIT,
    Permission.CAMPAIGNS_VIEW,
    Permission.REPORTS_VIEW,
  ],
  'Technician': [
    Permission.CONTACTS_VIEW,
    Permission.DEALS_VIEW,
  ],
  'Viewer': [
    Permission.CONTACTS_VIEW,
    Permission.DEALS_VIEW,
    Permission.CAMPAIGNS_VIEW,
    Permission.REPORTS_VIEW,
  ],
};
