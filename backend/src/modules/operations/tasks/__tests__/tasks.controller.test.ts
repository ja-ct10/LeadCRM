import { beforeEach, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { EMPTY_PERMISSION_FLAGS, type TaskRecord } from '@leadcrm/shared';

const mocks = vi.hoisted(() => ({ getTasks: vi.fn(), permissions: vi.fn() }));
vi.mock('../tasks.service', () => ({ getTasks: mocks.getTasks }));
vi.mock('../../../administration/roles/roles.repository', () => ({ findUserEffectivePermissions: mocks.permissions }));
import { getTasks } from '../tasks.controller';

const task: TaskRecord = { id: 'task', tenantId: 'tenant', title: 'Follow up', description: '', status: 'pending',
  dueDate: '2030-01-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', assignedUserId: 'agent',
  deals: [{ id: 'deal', title: 'Private Deal' }], relatedRecords: [
    { kind: 'contact', id: 'contact', label: 'Visible Contact', via: 'Deal: Private Deal' },
    { kind: 'account', id: 'account', label: 'Private Account', via: 'Lead: Private Lead' },
  ] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getTasks.mockResolvedValue({ data: [task], meta: { total: 1 } });
  mocks.permissions.mockResolvedValue({ tasks: { ...EMPTY_PERMISSION_FLAGS, canView: true }, contacts: { ...EMPTY_PERMISSION_FLAGS, canView: true } });
});

it('keeps authorized target labels while hiding inaccessible source provenance', async () => {
  const json = vi.fn(), next = vi.fn();
  await getTasks({ user: { userId: 'agent', tenantId: 'tenant', role: 'Support' }, query: {} } as unknown as Request, { json } as unknown as Response, next);
  expect(next).not.toHaveBeenCalled();
  expect(json.mock.calls[0][0].data[0]).toMatchObject({ deals: [], relatedRecords: [
    { kind: 'contact', id: 'contact', label: 'Visible Contact', via: 'Related Deal' },
  ] });
  expect(task.relatedRecords?.[0].via).toBe('Deal: Private Deal');
});

it('preserves administrator context without consulting restricted staff grants', async () => {
  const json = vi.fn(), next = vi.fn();
  await getTasks({ user: { userId: 'admin', tenantId: 'tenant', role: 'Client Admin' }, query: {} } as unknown as Request, { json } as unknown as Response, next);
  expect(json.mock.calls[0][0].data[0]).toEqual(task);
  expect(mocks.permissions).not.toHaveBeenCalled();
});
