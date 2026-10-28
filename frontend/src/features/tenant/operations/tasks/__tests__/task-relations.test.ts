import { expect, it } from 'vitest';
import type { TaskRecord } from '@leadcrm/shared';
import { canManageTask, isTaskOwner, taskRecordOptions } from '../task-relations';

it.each(['another-agent', null, undefined])('lets Client Admin manage creator %s and another agent assignment', createdById => {
  expect(canManageTask({ createdById, assignedUserId: 'other' }, { id: 'admin', role: 'Client Admin' })).toBe(true);
});

it('retains assignment and team scope for ordinary roles', () => {
  const task = { createdById: 'agent', assignedUserId: 'other' }, user = { id: 'agent', role: 'Custom staff' };
  expect(canManageTask(task, user)).toBe(false);
  expect(canManageTask(task, user, true)).toBe(true);
  expect(canManageTask({ ...task, assignedUserId: user.id }, user)).toBe(true);
  expect(canManageTask(undefined, user, true)).toBe(false);
  expect(canManageTask(task, null, true)).toBe(false);
});

it('requires the authoritative creator ID without assignee, name, or missing-creator fallbacks', () => {
  expect(isTaskOwner({ createdById: 'owner' }, 'owner')).toBe(true);
  for (const createdById of ['other', null, undefined]) expect(isTaskOwner({ createdById }, 'owner')).toBe(false);
  expect(isTaskOwner({ createdById: 'owner' }, undefined)).toBe(false);
});

it('retains legacy labels when hydrated arrays are empty and deduplicates mixed responses', () => {
  const task = { leads: [], lead: { id: 'l', firstName: 'Lead', lastName: 'One' }, contacts: [{ id: 'c', firstName: 'Contact', lastName: 'One' }], contact: { id: 'c', firstName: 'Contact', lastName: 'One' }, deals: [], deal: { id: 'd', title: 'Expansion' }, accounts: [], account: { id: 'a', name: 'Acme' } } as unknown as TaskRecord;
  expect(taskRecordOptions(task, 'lead')).toEqual([{ id: 'l', label: 'Lead One' }]);
  expect(taskRecordOptions(task, 'contact')).toEqual([{ id: 'c', label: 'Contact One' }]);
  expect(taskRecordOptions(task, 'deal')).toEqual([{ id: 'd', label: 'Expansion' }]);
  expect(taskRecordOptions(task, 'account')).toEqual([{ id: 'a', label: 'Acme' }]);
});
