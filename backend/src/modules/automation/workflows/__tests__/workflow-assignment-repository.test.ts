import { expect, it, vi } from 'vitest';
import { assignmentCandidates, assignmentOptions, assignmentWorkloads } from '../../assignment/workflow-assignment.repository';

it('excludes Client Admin task targets and permits staff granted Tasks access through another role', async () => {
  const tenantId = 'tenant';
  const user = (id: string, role: string) => ({ id, tenantId, role, status: 'ACTIVE', tenant: { status: 'ACTIVE' }, userRoles: [
    { tenantId, role: { tenantId, isArchived: false, permissions: [] } },
    { tenantId, role: { tenantId, isArchived: false, permissions: [{ tenantId, module: 'tasks', canView: true }] } },
  ] });
  const db = { user: { findMany: vi.fn().mockResolvedValue([user('admin', 'Client Admin'), user('staff', 'Support')]) } };
  expect((await assignmentCandidates(db as never, tenantId, 'task_assignee')).map(row => row.id)).toEqual(['staff']);
});

it('counts canonical in_progress Tasks toward assignment capacity', async () => {
  const db = { task: { groupBy: vi.fn(({ where }) => Promise.resolve(where.status.in.includes('in_progress')
    ? [{ assignedUserId: 'staff', _count: { _all: 1 } }] : [])) } };
  expect(await assignmentWorkloads(db as never, 'tenant', ['staff'], 'task_assignee')).toEqual(new Map([['staff', 1]]));
});

it('keeps supported module-specific owners and excludes Account-only permissions from ownership', async () => {
  const tenantId = 'tenant';
  const user = (module: string) => ({ id: `${module}-staff`, firstName: module, lastName: 'Staff', tenantId, role: 'Support', status: 'ACTIVE', tenant: { status: 'ACTIVE' }, userRoles: [
    { tenantId, role: { tenantId, isArchived: false, permissions: [{ tenantId, module, canView: true, canEdit: true }] } },
  ] });
  const db = { user: { findMany: vi.fn().mockResolvedValue([user('accounts'), user('contacts')]) } };
  expect((await assignmentOptions(db as never, tenantId, { users: true, roles: false, groups: false })).users).toEqual([{ id: 'contacts-staff', name: 'contacts Staff' }]);
  expect(await assignmentCandidates(db as never, tenantId, 'crm_owner', 'account')).toEqual([]);
  expect((await assignmentCandidates(db as never, tenantId, 'crm_owner', 'contact')).map(user => user.id)).toEqual(['contacts-staff']);
  expect(await assignmentCandidates(db as never, tenantId, 'crm_owner', 'deal')).toEqual([]);
});
