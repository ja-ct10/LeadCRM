import type { User } from '@/store/types';

/** Users whose role is reserved for tenant administration cannot be assigned as agents. */
export function getAssignableAgents(users: readonly User[]): User[] {
  return users.filter((user) => user.role?.trim().toLowerCase() !== 'client admin');
}
