import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ user: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock('../../../config/database.config', () => ({ default: db }));
vi.mock('../../crm/leads/lead-automation.service', () => ({ eligibleAgents: async () => [] }));
import { getAll } from './users.service';
beforeEach(() => { vi.clearAllMocks(); db.user.findMany.mockResolvedValue([]); db.user.count.mockResolvedValue(0); });
it('searches a full user name before paging while retaining tenant, role and status filters', async () => {
  await getAll('tenant', { page: 2, limit: 25, role: 'Sales', status: 'ACTIVE', search: '  Juan   Dela Cruz ' });
  const { where, skip, take, select } = db.user.findMany.mock.calls[0][0];
  expect({ skip, take }).toEqual({ skip: 25, take: 25 });
  expect(where).toMatchObject({ tenantId: 'tenant', role: 'Sales', status: 'ACTIVE' });
  for (const term of ['Juan', 'Dela', 'Cruz']) expect(where.AND).toContainEqual({ OR: expect.arrayContaining([
    { firstName: { contains: term, mode: 'insensitive' } }, { lastName: { contains: term, mode: 'insensitive' } },
  ]) });
  expect(db.user.count.mock.calls[0][0].where).toEqual(where);
  expect(select.passwordHash).toBeUndefined();
});
