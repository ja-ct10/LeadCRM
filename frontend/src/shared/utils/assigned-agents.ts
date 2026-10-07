import type { User } from '@/store/types';
import { isAssignableAgent } from '@leadcrm/shared';

/** Users whose role is reserved for tenant administration cannot be assigned as agents. */
export function getAssignableAgents(users: readonly User[]): User[] {
  return users.filter(isAssignableAgent);
}
