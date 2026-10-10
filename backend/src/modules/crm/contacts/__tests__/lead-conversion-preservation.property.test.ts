import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as fc from 'fast-check';
import { conversionFixture } from './conversion-fixture';
vi.mock('../../../../config/database.config', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.CONVERSION_TEST_DATABASE_URL! } } }) }));
vi.mock('../../../automation/triggers/triggers.service', () => ({ fireLeadUpdated: vi.fn(), fireLeadStatusChanged: vi.fn(), fireContactCreated: vi.fn(), fireContactUpdated: vi.fn(), fireContactStatusChanged: vi.fn(), fireDealUpdated: vi.fn() }));
let fixture: Awaited<ReturnType<typeof conversionFixture>>;
beforeAll(async () => { fixture = await conversionFixture(); }, 180000);
afterAll(async () => { await fixture?.close(); });
it('retries reuse the converted identity and preserve original Deal and conversion history', async () => {
  const { lead, deal } = await fixture.inquiry('Repeat customer');
  const first = await fixture.convert(lead.id);
  const original = await fixture.db.deal.findUniqueOrThrow({ where: { id: deal.id } });
  const second = await fixture.convert(lead.id, { contactId: '8f4c4b89-a3f6-4f14-b7ce-0db7ec7cff2c' });
  expect(second.contact.id).toBe(first.contact.id);
  expect(second.lead.convertedAt).toEqual(first.lead.convertedAt);
  expect(await fixture.db.deal.findUniqueOrThrow({ where: { id: deal.id } })).toEqual(original);
  expect(await fixture.db.auditLog.count({ where: { action: 'lead.converted', entityId: lead.id } })).toBe(1);
  expect(await fixture.db.contactDeal.count({ where: { dealId: deal.id } })).toBe(1);
});
it('keeps authored Lead history and open/completed Task responsibility visible once after conversion and retry', async () => {
  const { lead, deal } = await fixture.inquiry('Continuity customer');
  const stamp = new Date('2026-01-01T02:00:00Z');
  const note = await fixture.db.activity.create({ data: { tenantId: 'conversion', leadId: lead.id, createdById: 'actor', type: 'note', title: 'Original customer note', createdAt: stamp } });
  const tasks = await Promise.all(['pending', 'completed'].map(status => fixture.db.task.create({ data: {
    tenantId: 'conversion', title: `Original ${status} task`, status, dueDate: stamp, createdById: 'actor', assignedUserId: 'actor', assignedById: 'actor',
    leadLinks: { create: { leadId: lead.id, position: 0 } },
  } })));
  const result = await fixture.convert(lead.id);
  await fixture.db.taskContact.create({ data: { tenantId: 'conversion', taskId: tasks[0].id, contactId: result.contact.id, position: 0 } });
  await fixture.convert(lead.id);
  const { findAllActivities } = await import('../../activities/activities.repository');
  const history = await findAllActivities('conversion', { contactId: result.contact.id, type: 'note', limit: 100 });
  expect(history.data.filter(row => row.id === note.id)).toHaveLength(1);
  expect(history.data.find(row => row.id === note.id)).toMatchObject({ leadId: lead.id, contactId: null, createdById: 'actor', createdAt: stamp });
  const { getTasks } = await import('../../../operations/tasks/tasks.service');
  const { tenantContext } = await import('../../../../core/tenant/tenant-context');
  const contextual = await tenantContext.run({ tenantId: 'conversion' }, () => getTasks('conversion', { contactId: result.contact.id, limit: 100 }));
  expect(contextual.data.map(row => row.id).sort()).toEqual(tasks.map(row => row.id).sort());
  expect(contextual.data.every(row => row.createdById === 'actor' && row.assignedUserId === 'actor')).toBe(true);
  expect(await fixture.db.activity.count({ where: { id: note.id } })).toBe(1);
  expect(await fixture.db.task.count({ where: { id: { in: tasks.map(row => row.id) } } })).toBe(2);
  expect(await fixture.db.contactDeal.count({ where: { contactId: result.contact.id, dealId: deal.id } })).toBe(1);
});
it('rejects unsupported conversion options before changing any record', async () => {
  const { lead } = await fixture.inquiry('Options');
  const before = await fixture.db.lead.findUniqueOrThrow({ where: { id: lead.id } });
  for (const option of [{ createContact: false }, { createDeal: true }]) await expect(fixture.convert(lead.id, option)).rejects.toThrow();
  expect(await fixture.db.lead.findUniqueOrThrow({ where: { id: lead.id } })).toEqual(before);
  expect(await fixture.db.contact.count({ where: { email: lead.email } })).toBe(0);
});
it('rolls back conversion on missing and foreign Account links', async () => {
  const foreign = await fixture.db.account.create({ data: { tenantId: 'foreign', name: 'Foreign' } });
  await fc.assert(fc.asyncProperty(fc.uuid(), async missing => {
    const { lead } = await fixture.inquiry('Rollback');
    const before = await fixture.db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    for (const accountId of [missing, foreign.id]) await expect(fixture.convert(lead.id, { accountId })).rejects.toThrow();
    expect(await fixture.db.lead.findUniqueOrThrow({ where: { id: lead.id } })).toEqual(before);
    expect(await fixture.db.contact.count({ where: { email: lead.email } })).toBe(0);
  }), { numRuns: 4 });
}, 30000);
it('keeps the real Lead list paginated, scoped and searchable after conversion', async () => {
  const { lead } = await fixture.inquiry('Search target');
  await fixture.db.lead.create({ data: { tenantId: 'foreign', firstName: 'John', lastName: 'Foreign' } });
  for (const limit of [1, 5, 25]) {
    const result = await fixture.getContacts('conversion', { search: lead.email!, page: 1, limit });
    expect(result.data.map(row => row.id)).toEqual([lead.id]);
    expect(result.meta).toMatchObject({ page: 1, limit, total: 1, hasMore: false });
  }
});
it('preserves distinct Product IDs when a retired catalog name is reused', async () => {
  const { lead } = await fixture.inquiry('Product identity customer');
  await fixture.db.productInterest.update({ where: { id: 'product' }, data: { active: false } });
  const duplicate = await fixture.db.productInterest.create({ data: { tenantId: 'conversion', name: 'CRM Enterprise', dealValue: 900 } });
  const account = await fixture.db.account.create({ data: { tenantId: 'conversion', name: lead.companyName!, productsNormalized: true,
    productLinks: { create: { productInterestId: duplicate.id, position: 0, interested: true, activeProduct: true } } } });
  const existing = await fixture.db.contact.create({ data: { tenantId: 'conversion', firstName: 'Existing', lastName: 'Customer', email: lead.email,
    accountId: account.id, productsNormalized: true, productLinks: { create: { productInterestId: duplicate.id, position: 0, interested: true, activeProduct: true } } } });
  const result = await fixture.convert(lead.id);
  expect(result.contact.id).toBe(existing.id);
  const contactLinks = await fixture.db.contactProductInterest.findMany({ where: { contactId: existing.id } });
  expect(contactLinks.map(link => link.productInterestId).sort()).toEqual([duplicate.id, 'product'].sort());
  expect(contactLinks.every(link => link.interested && link.activeProduct)).toBe(true);
  const accountLinks = await fixture.db.accountProductInterest.findMany({ where: { accountId: account.id } });
  expect(accountLinks.map(link => link.productInterestId).sort()).toEqual([duplicate.id, 'product'].sort());
  expect(accountLinks.find(link => link.productInterestId === 'product')?.activeProduct).toBe(false);
  expect(await fixture.db.contact.findFirst({ where: { id: existing.id }, select: { productsNormalized: true } })).toEqual({ productsNormalized: true });
});
