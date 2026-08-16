// RBAC Role definitions
export const Role = {
  ADMIN: 'Admin',
  SUPER_USER: 'Super User',
  USER: 'User',
  RESTRICTED_USER: 'Restricted User',
} as const;

export type RoleKey = typeof Role[keyof typeof Role];
