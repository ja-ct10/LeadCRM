import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ lead: { fields: { createdAt: 'createdAt' }, findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() } }));
vi.mock('../../../../config/database.config', () => ({ default: db }));
import { findAllContacts } from '../contacts.repository';
beforeEach(() => {
  vi.clearAllMocks();
  db.lead.findMany.mockResolvedValue([]); db.lead.count.mockResolvedValue(100); db.lead.groupBy.mockResolvedValue([]);
});

it.each(['firstName', 'lastName'])('sorts Leads by persisted %s before pagination in both directions', async field => {
  for (const direction of ['asc', 'desc']) {
    await findAllContacts('tenant', { page: 2, limit: 25, sort: `${field}:${direction}`, search: 'Tiron' });
    expect(db.lead.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      skip: 25, take: 25, orderBy: [{ [field]: direction }, { id: 'asc' }],
      where: expect.objectContaining({ tenantId: 'tenant', isArchived: false, convertedAt: null, deletedAt: null,
        OR: expect.arrayContaining([{ lastName: { contains: 'Tiron', mode: 'insensitive' } }]) }),
    }));
  }
});

it.each(['all', 'my', 'active'])('keeps %s Leads filters when sorting by Last Name', async scope => {
  await findAllContacts('tenant', { currentUserId: 'agent', sort: 'lastName:asc', filter: { scope: `equals:${scope}`, status: 'in:Hot,Warm' } });
  const where = db.lead.findMany.mock.calls[0][0].where;
  expect(where.tenantId).toBe('tenant');
  expect(where.AND).toContainEqual({ status: { in: ['Hot', 'HOT', 'Warm', 'WARM'] } });
  if (scope === 'my') expect(where.AND).toContainEqual({ assignedUserId: 'agent' });
  if (scope === 'active') expect(where.AND).toContainEqual({ status: { in: ['Hot', 'Warm', 'HOT', 'WARM'] } });
});

it('continues rejecting arbitrary sort fields through the existing allowlist', async () => {
  await findAllContacts('tenant', { sort: 'tenantId:asc' });
  expect(db.lead.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
});
