import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ deal: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock('../../../../config/database.config', () => ({ default: db }));
import { findAllDeals } from '../deals.repository';
import { DealsQuerySchema } from '../deals.dto';
beforeEach(() => { vi.clearAllMocks(); db.deal.findMany.mockResolvedValue([]); db.deal.count.mockResolvedValue(0); });
it('searches Account names and Deal categories before pagination without replacing other filters', async () => {
  await findAllDeals('tenant', DealsQuerySchema.parse({ search: '  Acme   high  ', page: 3, limit: 4, pipelineId: 'pipeline', assignedUserId: 'agent' }));
  const { where, skip, take } = db.deal.findMany.mock.calls[0][0];
  expect({ skip, take }).toEqual({ skip: 8, take: 4 });
  expect(where).toMatchObject({ tenantId: 'tenant', isArchived: false, pipelineId: 'pipeline', assignedUserId: 'agent' });
  expect(where.AND).toContainEqual({ tenantId: 'tenant' });
  expect(where.AND).toContainEqual({ OR: expect.arrayContaining([
    { organization: { name: { contains: 'Acme', mode: 'insensitive' } } },
  ]) });
  expect(where.AND).toContainEqual({ OR: expect.arrayContaining([{ priority: 'HIGH' }]) });
  expect(db.deal.count.mock.calls[0][0].where).toEqual(where);
});
