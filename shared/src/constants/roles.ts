// RBAC Roles — defined once, imported by both frontend and backend
// Adding a new role: add it here only. Code elsewhere stays the same.
export const Role = {
  ADMIN: 'Admin',
  SUPER_USER: 'Super User',
  USER: 'User',
  RESTRICTED_USER: 'Restricted User',
} as const;

export type RoleKey = (typeof Role)[keyof typeof Role];
