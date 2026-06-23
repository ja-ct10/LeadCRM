// Permission constants — module.action format
// These are the keys assigned to roles.
// Client Admin bypasses all checks at the middleware level.
export const Permission = {
  // Contacts
  CONTACTS_VIEW: 'contacts.view',
  CONTACTS_CREATE: 'contacts.create',
  CONTACTS_EDIT: 'contacts.edit',
  CONTACTS_DELETE: 'contacts.delete',
  CONTACTS_EXPORT: 'contacts.export',

  // Deals / Pipeline
  DEALS_VIEW: 'deals.view',
  DEALS_CREATE: 'deals.create',
  DEALS_EDIT: 'deals.edit',
  DEALS_DELETE: 'deals.delete',

  // Campaigns
  CAMPAIGNS_VIEW: 'campaigns.view',
  CAMPAIGNS_CREATE: 'campaigns.create',
  CAMPAIGNS_EDIT: 'campaigns.edit',
  CAMPAIGNS_DELETE: 'campaigns.delete',
  CAMPAIGNS_SEND: 'campaigns.send',

  // Workflows
  WORKFLOWS_VIEW: 'workflows.view',
  WORKFLOWS_CREATE: 'workflows.create',
  WORKFLOWS_EDIT: 'workflows.edit',
  WORKFLOWS_DELETE: 'workflows.delete',

  // Users
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',

  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // Billing
  BILLING_VIEW: 'billing.view',
  BILLING_MANAGE: 'billing.manage',

  // Settings / Roles
  SETTINGS_VIEW: 'settings.view',
  ROLES_MANAGE: 'roles.manage',

  // Audit
  AUDIT_VIEW: 'audit.view',

  // Admin (System Admin only)
  ADMIN_ACCESS: 'admin.access',
} as const;

export type PermissionKey = typeof Permission[keyof typeof Permission];
