import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ template: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(3) } }));
vi.mock('../../../config/database.config', () => ({ default: db }));
import { tenantContext } from '../../../core/tenant/tenant-context';
import { getTemplates } from './templates.service';
beforeEach(() => vi.clearAllMocks());
it.each(['Email', 'SMS', 'Quotation'])('searches %s names and categories before pagination with the same count constraints', async type => {
  const result = await tenantContext.run({ tenantId: 'tenant' }, () => getTemplates('tenant', { search: '  Follow   SALES ', type, category: 'Sales', page: 2, limit: 2 }));
  const query = db.template.findMany.mock.calls[0][0];
  expect(query).toMatchObject({ where: { tenantId: 'tenant', isArchived: false, type, category: 'Sales', AND: [
    { OR: [{ name: { contains: 'Follow', mode: 'insensitive' } }, { category: { contains: 'Follow', mode: 'insensitive' } }] },
    { OR: [{ name: { contains: 'SALES', mode: 'insensitive' } }, { category: { contains: 'SALES', mode: 'insensitive' } }] },
  ] }, skip: 2, take: 2 });
  expect(db.template.count).toHaveBeenCalledWith({ where: query.where });
  expect(result.meta).toEqual({ total: 3, page: 2, limit: 2, hasMore: false });
});
it('preserves name-only search for untyped callers and archived scope', async () => {
  await tenantContext.run({ tenantId: 'tenant' }, () => getTemplates('tenant', { search: 'Follow', archived: 'true' }));
  expect(db.template.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', isArchived: true, AND: [
    { OR: [{ name: { contains: 'Follow', mode: 'insensitive' } }] },
  ] } }));
});
it('clears search clauses for an empty search while retaining category and type', async () => {
  await tenantContext.run({ tenantId: 'tenant' }, () => getTemplates('tenant', { type: 'SMS', category: 'Support', search: '  ' }));
  expect(db.template.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', isArchived: false, type: 'SMS', category: 'Support', AND: [] } }));
});
