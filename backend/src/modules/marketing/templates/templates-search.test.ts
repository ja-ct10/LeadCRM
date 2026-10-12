import { expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ template: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(3) } }));
vi.mock('../../../config/database.config', () => ({ default: db }));
import { tenantContext } from '../../../core/tenant/tenant-context';
import { getTemplates } from './templates.service';
it('searches all template name terms before pagination and retains type and tenant filters', async () => {
  await tenantContext.run({ tenantId: 'tenant' }, () => getTemplates('tenant', { search: '  Follow   up ', type: 'Email', page: 2, limit: 2 }));
  const query = db.template.findMany.mock.calls[0][0];
  expect(query).toMatchObject({ where: { tenantId: 'tenant', isArchived: false, type: 'Email', AND: [
    { OR: [{ name: { contains: 'Follow', mode: 'insensitive' } }] },
    { OR: [{ name: { contains: 'up', mode: 'insensitive' } }] },
  ] }, skip: 2, take: 2 });
  expect(db.template.count).toHaveBeenCalledWith({ where: query.where });
});
