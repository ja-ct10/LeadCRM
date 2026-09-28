import { expect, it, vi } from 'vitest';
vi.mock('../../../../config/database.config', () => ({ default: {
  campaign: { findMany: vi.fn(async () => []), count: vi.fn(async () => 305) },
} }));
import prisma from '../../../../config/database.config';
import { environmentContext } from '../../../../core/environment/environment-context';
import { getCampaigns } from '../campaigns.service';
it('counts and pages the full filtered campaign dataset in the same tenant and environment', async () => {
  const result = await environmentContext.run({ tenantId: 'tenant-a', environment: 'PRODUCTION' }, () => getCampaigns('tenant-a', { page: 3, limit: 20, status: 'SENT,DRAFT', type: 'EMAIL,SMS', search: 'Follow' }));
  const find = vi.mocked(prisma.campaign.findMany).mock.calls[0][0]!;
  expect(find).toEqual(expect.objectContaining({ skip: 40, take: 20 }));
  expect(find.where).toEqual(expect.objectContaining({ tenantId: 'tenant-a', environment: 'PRODUCTION', isArchived: false, status: { in: ['SENT', 'DRAFT'] }, type: { in: ['EMAIL', 'SMS'] } }));
  expect(prisma.campaign.count).toHaveBeenCalledWith({ where: find.where });
  expect(result.meta).toEqual(expect.objectContaining({ total: 305, page: 3, limit: 20, hasMore: true }));
});
