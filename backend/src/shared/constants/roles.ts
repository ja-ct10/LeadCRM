// RBAC Role definitions
// Client Admin is the tenant super-user — bypass at middleware level
// System Admin is cross-tenant — only exists in the admin portal
export const Role = {
  SYSTEM_ADMIN: 'System Admin',
  CLIENT_ADMIN: 'Client Admin',
  SALES_REP: 'Sales Rep',
  TECHNICIAN: 'Technician',
  VIEWER: 'Viewer',
} as const;

export type RoleKey = typeof Role[keyof typeof Role];
