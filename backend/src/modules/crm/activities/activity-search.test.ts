import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ activity: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock('../../../config/database.config', () => ({ default: db }));
import { findAllActivities } from './activities.repository';
beforeEach(() => { vi.clearAllMocks(); db.activity.findMany.mockResolvedValue([]); db.activity.count.mockResolvedValue(0); });
it('searches full actor names before paging while retaining tenant and record scope for count and rows', async () => {
  await findAllActivities('tenant', { leadId: 'lead', type: 'note', page: 2, limit: 25, search: '  Mary   Jane Cruz ' });
  const { where, skip, take } = db.activity.findMany.mock.calls[0][0];
  expect({ skip, take }).toEqual({ skip: 25, take: 26 });
  expect(where).toMatchObject({ tenantId: 'tenant', type: { in: ['note'] } });
  expect(where.AND).toContainEqual({ OR: expect.arrayContaining([{ leadId: 'lead' }]) });
  for (const term of ['Mary', 'Jane', 'Cruz']) expect(where.AND).toContainEqual({ OR: expect.arrayContaining([
    { title: { contains: term, mode: 'insensitive' } },
    { createdBy: { firstName: { contains: term, mode: 'insensitive' } } },
    { createdBy: { lastName: { contains: term, mode: 'insensitive' } } },
  ]) });
  expect(db.activity.count.mock.calls[0][0].where).toEqual(where);
});
