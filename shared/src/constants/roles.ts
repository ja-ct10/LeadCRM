// RBAC Roles — defined once, imported by both frontend and backend
// Adding a new role: add it here only. Code elsewhere stays the same.
export const Role = {
  SYSTEM_ADMIN: 'System Admin',
  CLIENT_ADMIN: 'Client Admin',
  SALES_REP: 'Sales Rep',
  TECHNICIAN: 'Technician',
  VIEWER: 'Viewer',
} as const;

export type RoleKey = (typeof Role)[keyof typeof Role];
