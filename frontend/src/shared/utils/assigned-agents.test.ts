import { expect, it } from 'vitest';
import type { User } from '@/store/types';
import { getAssignableAgents } from './assigned-agents';

it('excludes Client Admin by role while keeping other assignable users', () => {
  const users = [
    { id: 'admin', role: 'Client Admin' },
    { id: 'admin-case', role: ' client admin ' },
    { id: 'sales', role: 'Sales' },
    { id: 'support', role: 'Support Agent' },
  ] as User[];

  expect(getAssignableAgents(users).map(user => user.id)).toEqual(['sales', 'support']);
});
