import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: { $transaction: vi.fn() },
  tx: { $queryRaw: vi.fn(), roleDefinition: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    userRole: { count: vi.fn(), deleteMany: vi.fn() }, rolePermission: { deleteMany: vi.fn() } },
  audit: vi.fn(),
}));
vi.mock('../../../../config/database.config', () => ({ default: state.db }));
vi.mock('../../../../core/audit/audit.service', () => ({ writeAuditLog: state.audit }));
import { archiveRole } from '../roles.service';
import { tenantContext } from '../../../../core/tenant/tenant-context';

beforeEach(() => {
  vi.resetAllMocks();
  state.db.$transaction.mockImplementation(work => work(state.tx));
  state.tx.roleDefinition.findFirst.mockResolvedValue({ id: 'role', tenantId: 'tenant', name: 'Staff', isSystemRole: false, isArchived: false });
  state.tx.roleDefinition.update.mockResolvedValue({ id: 'role', name: 'Staff', isArchived: true });
  state.tx.userRole.count.mockResolvedValue(0);
});

it('locks, rechecks and soft-deletes in one transaction, retaining permissions and recording the business audit', async () => {
  await tenantContext.run({ tenantId: 'tenant' }, () => archiveRole('role', 'tenant', 'actor'));
  expect(state.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
  const [sql, id, tenant] = state.tx.$queryRaw.mock.calls[0];
  expect(sql.join('?')).toContain('WHERE "id" = ? AND "tenantId" = ? FOR UPDATE');
  expect([id, tenant]).toEqual(['role', 'tenant']);
  expect(state.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(state.tx.userRole.count.mock.invocationCallOrder[0]);
  expect(state.tx.userRole.count.mock.invocationCallOrder[0]).toBeLessThan(state.tx.roleDefinition.update.mock.invocationCallOrder[0]);
  expect(state.tx.roleDefinition.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 'role', tenantId: 'tenant', isArchived: false }, data: { isArchived: true } });
  expect(state.audit).toHaveBeenCalledExactlyOnceWith({ tenantId: 'tenant', userId: 'actor', entityType: 'RoleDefinition', entityId: 'role', action: 'role.deleted',
    before: { name: 'Staff', isArchived: false }, after: { name: 'Staff', isArchived: true } });
  expect(state.tx.roleDefinition.delete).not.toHaveBeenCalled();
  expect(state.tx.rolePermission.deleteMany).not.toHaveBeenCalled();
  expect(state.tx.userRole.deleteMany).not.toHaveBeenCalled();
});

it.each([1, 3])('blocks deletion with %s assigned relationships without modifying records or auditing success', async count => {
  state.tx.userRole.count.mockResolvedValue(count);
  await expect(archiveRole('role', 'tenant', 'actor')).rejects.toMatchObject({ statusCode: 409,
    message: `Role has ${count} assigned user(s). Reassign users to another role before deleting.` });
  expect(state.tx.userRole.count).toHaveBeenCalledWith({ where: { roleId: 'role', tenantId: 'tenant' } });
  expect(state.tx.roleDefinition.update).not.toHaveBeenCalled();
  expect(state.tx.userRole.deleteMany).not.toHaveBeenCalled();
  expect(state.audit).not.toHaveBeenCalled();
});

it('rejects protected system roles', async () => {
  state.tx.roleDefinition.findFirst.mockResolvedValue({ isSystemRole: true });
  await expect(archiveRole('role', 'tenant', 'actor')).rejects.toMatchObject({ statusCode: 403 });
  expect(state.tx.roleDefinition.update).not.toHaveBeenCalled();
});

it('rejects missing, foreign or already deleted roles using the active tenant query', async () => {
  state.tx.roleDefinition.findFirst.mockResolvedValue(null);
  await expect(archiveRole('role', 'tenant', 'actor')).rejects.toMatchObject({ statusCode: 404 });
  expect(state.tx.roleDefinition.findFirst).toHaveBeenCalledWith({ where: { id: 'role', tenantId: 'tenant', isArchived: false } });
  expect(state.tx.roleDefinition.update).not.toHaveBeenCalled();
});
