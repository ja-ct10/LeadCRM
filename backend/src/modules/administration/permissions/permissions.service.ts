/**
 * Permissions service — returns the canonical permission list.
 * Permissions are compile-time constants (permissions.ts), not DB rows.
 * This service exposes them to the frontend for role builder UI.
 */
import { Permission } from '../../../shared/constants/permissions';

export interface PermissionGroup {
  module:      string;
  permissions: Array<{ key: string; label: string }>;
}

export function getAllPermissions(): PermissionGroup[] {
  return [
    {
      module: 'Contacts',
      permissions: [
        { key: Permission.CONTACTS_VIEW,   label: 'View Contacts' },
        { key: Permission.CONTACTS_CREATE, label: 'Create Contacts' },
        { key: Permission.CONTACTS_EDIT,   label: 'Edit Contacts' },
        { key: Permission.CONTACTS_DELETE, label: 'Archive Contacts' },
        { key: Permission.CONTACTS_EXPORT, label: 'Export Contacts' },
      ],
    },
    {
      module: 'Deals & Pipeline',
      permissions: [
        { key: Permission.DEALS_VIEW,   label: 'View Deals' },
        { key: Permission.DEALS_CREATE, label: 'Create Deals' },
        { key: Permission.DEALS_EDIT,   label: 'Edit & Move Deals' },
        { key: Permission.DEALS_DELETE, label: 'Archive Deals' },
      ],
    },
    {
      module: 'Campaigns',
      permissions: [
        { key: Permission.CAMPAIGNS_VIEW,   label: 'View Campaigns' },
        { key: Permission.CAMPAIGNS_CREATE, label: 'Create Campaigns' },
        { key: Permission.CAMPAIGNS_EDIT,   label: 'Edit Campaigns' },
        { key: Permission.CAMPAIGNS_DELETE, label: 'Archive Campaigns' },
        { key: Permission.CAMPAIGNS_SEND,   label: 'Send Campaigns' },
      ],
    },
    {
      module: 'Workflows',
      permissions: [
        { key: Permission.WORKFLOWS_VIEW,     label: 'View Workflows' },
        { key: Permission.WORKFLOWS_CREATE,   label: 'Create Workflows' },
        { key: Permission.WORKFLOWS_EDIT,     label: 'Edit Workflows' },
        { key: Permission.WORKFLOWS_DELETE,   label: 'Delete Workflows' },
        { key: Permission.WORKFLOWS_ACTIVATE, label: 'Activate/Deactivate Workflows' },
      ],
    },
    {
      module: 'Users',
      permissions: [
        { key: Permission.USERS_VIEW,   label: 'View Users' },
        { key: Permission.USERS_MANAGE, label: 'Create & Manage Users' },
      ],
    },
    {
      module: 'Roles',
      permissions: [
        { key: Permission.ROLES_MANAGE, label: 'Create & Manage Roles' },
      ],
    },
    {
      module: 'Billing',
      permissions: [
        { key: Permission.BILLING_VIEW,   label: 'View Invoices' },
        { key: Permission.BILLING_MANAGE, label: 'Manage Billing & Payments' },
      ],
    },
    {
      module: 'Reports',
      permissions: [
        { key: Permission.REPORTS_VIEW,   label: 'View Reports' },
        { key: Permission.REPORTS_EXPORT, label: 'Export Reports' },
      ],
    },
    {
      module: 'Audit',
      permissions: [
        { key: Permission.AUDIT_VIEW, label: 'View Audit Log' },
      ],
    },
    {
      module: 'Settings',
      permissions: [
        { key: Permission.SETTINGS_VIEW, label: 'View Settings' },
      ],
    },
  ];
}
