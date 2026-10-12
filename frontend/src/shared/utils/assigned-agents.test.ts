import { expect, it } from 'vitest';
import type { User } from '@/store/types';
import { getAssignableAgents } from './assigned-agents';
import { userAdapter, type UserDTO } from '@/features/tenant/administration/users/adapters/user.adapter';

it('excludes Client Admin by role while keeping other assignable users', () => {
  const users = [
    { status: 'ACTIVE', assignableAgent: true, id: 'admin', role: 'Client Admin' },
    { status: 'ACTIVE', assignableAgent: true, id: 'admin-case', role: ' client admin ' },
    { status: 'ACTIVE', assignableAgent: true, id: 'sales', role: 'Sales' },
    { status: 'ACTIVE', assignableAgent: true, id: 'support', role: 'Support Agent' },
  ] as User[];

  expect(getAssignableAgents(users).map(user => user.id)).toEqual(['sales', 'support']);
});

it('uses module capabilities and retains compatibility with older user responses', () => {
  const users = [
    { status: 'ACTIVE', assignableAgent: false, assignableModules: ['tasks'], id: 'task-agent', role: 'Support' },
    { status: 'ACTIVE', assignableAgent: true, assignableModules: ['contacts', 'deals'], id: 'crm-agent', role: 'Sales' },
    { status: 'ACTIVE', assignableAgent: true, id: 'legacy', role: 'Sales' },
    { status: 'ACTIVE', assignableAgent: true, assignableModules: ['tasks'], id: 'admin', role: 'Client Admin' },
  ] as User[];

  expect(getAssignableAgents(users, ['tasks']).map(user => user.id)).toEqual(['task-agent', 'legacy']);
  expect(getAssignableAgents(users, ['contacts', 'deals']).map(user => user.id)).toEqual(['crm-agent', 'legacy']);
});

it('retains assignment module capabilities when API users enter client state', () => {
  const staff = userAdapter.toModel({ id: 'staff', status: 'ACTIVE', role: 'Support', assignableAgent: false, assignableModules: ['tasks'] } as UserDTO);
  expect(getAssignableAgents([staff], ['tasks']).map(user => user.id)).toEqual(['staff']);
  expect(getAssignableAgents([staff], ['deals'])).toEqual([]);
});
