import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ $transaction: vi.fn(), deal: { findMany: vi.fn() }, lead: { fields: { createdAt: 'createdAt' }, findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() } }));
vi.mock('../../../../config/database.config', () => ({ default: db }));
import { findAllContacts } from '../contacts.repository';
beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(work => work(db));
  db.deal.findMany.mockResolvedValue([]);
  db.lead.findMany.mockResolvedValue([]); db.lead.count.mockResolvedValue(100); db.lead.groupBy.mockResolvedValue([]);
});

it.each(['firstName', 'lastName'])('sorts Leads by displayed %s before pagination in both directions', async field => {
  for (const direction of ['asc', 'desc']) {
    const rows = [{ id: 'b', firstName: 'zebra', lastName: 'zebra' }, { id: 'a', firstName: 'Alpha', lastName: 'Alpha' }, { id: 'c', firstName: ' ', lastName: '' }];
    const expected = direction === 'asc' ? 'b' : 'a';
    db.lead.findMany.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows.filter(row => row.id === expected));
    const result = await findAllContacts('tenant', { page: 2, limit: 1, sort: `${field}:${direction}`, search: 'Tiron' });
    expect(result.data.map(row => row.id)).toEqual([expected]);
    expect(db.lead.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      skip: 0, take: 1,
      where: expect.objectContaining({ tenantId: 'tenant', isArchived: false, convertedAt: null, deletedAt: null,
        id: { in: [expected] },
        AND: expect.arrayContaining([{ OR: expect.arrayContaining([{ lastName: { contains: 'Tiron', mode: 'insensitive' } }]) }]) }),
    }));
  }
});

it.each(['asc', 'desc'])('sorts full Name by persisted names with stable ID before pagination (%s)', async direction => {
  const rows = [{ id: 'b', firstName: 'Mary Ann', lastName: 'de la Cruz' }, { id: 'a', firstName: 'mary ann', lastName: 'De la Cruz' }, { id: 'c', firstName: 'Zebra', lastName: 'Alpha' }];
  const expected = direction === 'asc' ? 'b' : 'a';
  db.lead.findMany.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows.filter(row => row.id === expected));
  const result = await findAllContacts('tenant', { page: 2, limit: 1, sort: `name:${direction}` });
  expect(result.data.map(row => row.id)).toEqual([expected]);
  expect(db.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({
    skip: 0, take: 1, where: expect.objectContaining({ tenantId: 'tenant', id: { in: [expected] } }),
  }));
});
it('orders normalized status labels and leaves blank text last', async () => {
  const rows = [{ id: 'warm', status: 'WARM' }, { id: 'cold', status: 'Cold' }, { id: 'hot', status: 'HOT' }];
  db.lead.findMany.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows);
  expect((await findAllContacts('tenant', { sort: 'status:asc' })).data.map(row => row.id)).toEqual(['cold', 'hot', 'warm']);
});

it('matches full and multiword names across canonical fields while keeping tenant and filter scope', async () => {
  await findAllContacts('tenant', { search: '  Mary   Jane  de la Cruz  ', currentUserId: 'agent', filter: { scope: 'equals:my', status: 'in:Hot' } });
  const where = db.lead.findMany.mock.calls[0][0].where;
  expect(where).toMatchObject({ tenantId: 'tenant', isArchived: false, convertedAt: null, deletedAt: null });
  expect(where.AND).toContainEqual({ assignedUserId: 'agent' });
  expect(where.AND).toContainEqual({ status: { in: ['Hot', 'HOT'] } });
  for (const token of ['Mary', 'Jane', 'de', 'la', 'Cruz']) {
    expect(where.AND).toContainEqual({ OR: expect.arrayContaining([
      { firstName: { contains: token, mode: 'insensitive' } },
      { lastName: { contains: token, mode: 'insensitive' } },
      { email: { contains: token, mode: 'insensitive' } },
      { companyName: { contains: token, mode: 'insensitive' } },
    ]) });
  }
  expect(db.lead.count.mock.calls[0][0].where).toEqual(where);
});

it.each(['josh@example.test', 'Teleperformance'])('retains email and company search (%s)', async search => {
  await findAllContacts('tenant', { search });
  expect(db.lead.findMany.mock.calls[0][0].where.AND).toContainEqual({ OR: expect.arrayContaining([
    { email: { contains: search, mode: 'insensitive' } },
    { companyName: { contains: search, mode: 'insensitive' } },
  ]) });
});

it.each(['all', 'my', 'active'])('keeps %s Leads filters when sorting by Last Name', async scope => {
  await findAllContacts('tenant', { currentUserId: 'agent', sort: 'lastName:asc', filter: { scope: `equals:${scope}`, status: 'in:Hot,Warm' } });
  const where = db.lead.findMany.mock.calls[0][0].where;
  expect(where.tenantId).toBe('tenant');
  expect(where.AND).toContainEqual({ status: { in: ['Hot', 'HOT', 'Warm', 'WARM'] } });
  if (scope === 'my') expect(where.AND).toContainEqual({ assignedUserId: 'agent' });
  if (scope === 'active') expect(where.AND).toContainEqual({ status: { in: ['Inquiry', 'Hot', 'Warm', 'INQUIRY', 'HOT', 'WARM'] } });
});

it('continues rejecting arbitrary sort fields through the existing allowlist', async () => {
  await findAllContacts('tenant', { sort: 'tenantId:asc' });
  expect(db.lead.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
});
