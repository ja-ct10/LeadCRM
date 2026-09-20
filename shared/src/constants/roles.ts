// Predefined administrator identities. Custom roles are tenant data, not constants.
export const Role = {
  CLIENT_ADMIN: 'Client Admin',
  SYSTEM_ADMIN: 'System Admin',
} as const;
export type RoleKey = (typeof Role)[keyof typeof Role];
