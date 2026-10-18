import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Prisma, PrismaClient } from '@prisma/client';
import type { DealAddressContext } from '@leadcrm/shared';
import { CreateDealBatchSchema, ManualCreateDealBatchSchema, defaultQuotationContent } from '@leadcrm/shared';
import { replayCrmMigrations } from '../../../../tests/replay-crm-migrations';
import { installTenantScoping } from '../../../../core/tenant/tenant-prisma';
import { installProductProjections } from '../../../../core/tenant/product-projections';
import { crmActor, installCrmRecordAccess } from '../../access/crm-record-access.service';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { ManualCreateDealSchema, UpdateDealSchema } from '../deals.dto';

vi.mock('../../../../config/database.config', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.DEAL_ASSOCIATION_TEST_DATABASE_URL! } } }) }));
let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient;
let presentation: typeof import('../deal-presentation');
let service: typeof import('../deals.service'), batch: typeof import('../deal-batch.service');
let relationships: typeof import('../../relationships/relationships.service');
let quotations: typeof import('../../../marketing/campaigns/quotations.service');
const tenantId = 'association-tenant', foreignTenant = 'association-foreign';
const productId = randomUUID(), secondProductId = randomUUID();
const scope = <T>(work: () => T, actor = 'admin') => tenantContext.run({ tenantId }, () => crmActor.run({ tenantId, userId: actor }, work));
const input = (extra = {}) => ({ title: 'Installation', pipelineId: 'pipeline', stageId: 'initial', productInterestIds: [productId], leadIds: ['lead'], ...extra });

beforeAll(async () => {
  pg = await PGlite.create(); await replayCrmMigrations(pg);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
  process.env.DEAL_ASSOCIATION_TEST_DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  db = (await import('../../../../config/database.config')).default;
  installProductProjections(db); installTenantScoping(db); installCrmRecordAccess(db);
  presentation = await import('../deal-presentation');
  service = await import('../deals.service'); batch = await import('../deal-batch.service');
  relationships = await import('../../relationships/relationships.service');
  quotations = await import('../../../marketing/campaigns/quotations.service');
  await db.tenant.createMany({ data: [{ id: tenantId, name: 'Association', slug: tenantId, status: 'ACTIVE' }, { id: foreignTenant, name: 'Other', slug: foreignTenant, status: 'ACTIVE' }] });
  await db.user.createMany({ data: ['admin', 'agent', 'other-agent', 'denied'].map(id => ({ id, tenantId, firstName: id, lastName: 'Fixture', email: `${id}@example.test`, status: 'ACTIVE', role: id === 'admin' ? 'Client Admin' : id === 'denied' ? 'Custom' : 'Sales' })) });
  const role = await db.roleDefinition.create({ data: { tenantId, name: 'Sales', crmAssignmentRestricted: true } });
  await db.rolePermission.createMany({ data: ['deals', 'leads', 'contacts'].map(module => ({ tenantId, roleId: role.id, module, canView: true, canCreate: true, canEdit: true })) });
  await db.userRole.createMany({ data: ['agent', 'other-agent'].map(userId => ({ tenantId, roleId: role.id, userId })) });
  await db.account.createMany({ data: [{ id: 'account', tenantId, name: 'Linked company' }, { id: 'other-account', tenantId, name: 'Other company' }] });
  await db.pipeline.create({ data: { id: 'pipeline', tenantId, name: 'Sales Pipeline' } });
  await db.stage.create({ data: { id: 'initial', tenantId, pipelineId: 'pipeline', name: 'Lead', order: 0 } });
  await db.productInterest.createMany({ data: [{ id: productId, tenantId, name: 'CCTV', dealValue: 1234.56 }, { id: secondProductId, tenantId, name: 'Support', dealValue: 500 }] });
  await db.lead.createMany({ data: [
    { id: 'lead', tenantId, firstName: 'Lead', lastName: 'Fixture', assignedUserId: 'agent', accountId: 'account' },
    { id: 'extra-lead', tenantId, firstName: 'Extra', lastName: 'Fixture', assignedUserId: 'agent' },
    { id: 'unassigned', tenantId, firstName: 'Unassigned', lastName: 'Fixture' },
    { id: 'archived', tenantId, firstName: 'Archived', lastName: 'Fixture', isArchived: true },
    { id: 'foreign-lead', tenantId: foreignTenant, firstName: 'Foreign', lastName: 'Fixture' },
  ] });
  await db.contact.createMany({ data: [
    { id: 'contact', tenantId, firstName: 'Contact', lastName: 'Fixture', assignedUserId: 'other-agent', accountId: 'other-account' },
    { id: 'extra-contact', tenantId, firstName: 'Extra', lastName: 'Fixture' },
  ] });
}, 180000);
afterAll(async () => { await db?.$disconnect(); await socket?.stop(); await pg?.close(); });

describe('manual Deal associations on disposable SQL', () => {
  it('requires exactly one Lead or Contact only on manual entry points', () => {
    for (const extra of [{ leadIds: [] }, { contactIds: ['contact'] }, { leadIds: ['lead', 'extra-lead'] }, { leadIds: ['lead', 'lead'] }]) {
      expect(ManualCreateDealSchema.safeParse(input(extra)).success).toBe(false);
      expect(ManualCreateDealBatchSchema.safeParse({ ...input(extra), idempotencyKey: randomUUID() }).success).toBe(false);
    }
    expect(UpdateDealSchema.safeParse({ title: 'Legacy edit' }).success).toBe(true);
    expect(UpdateDealSchema.safeParse({ primaryAssociation: { type: 'lead', id: 'lead' }, contactIds: [] }).success).toBe(false);
  });

  it.each(['lead', 'contact'] as const)('creates a %s-linked Deal with its source agent, Account and catalog value', async type => {
    const deal = await scope(() => service.createDeal(tenantId, 'admin', ManualCreateDealSchema.parse(input(type === 'contact' ? { leadIds: undefined, contactIds: ['contact'] } : {}))));
    expect(deal).toMatchObject({ assignedUserId: type === 'lead' ? 'agent' : 'other-agent', accountId: type === 'lead' ? 'account' : 'other-account', value: 1234.56 });
    expect(type === 'lead' ? deal.leadId : deal.contactId).toBe(type);
    const listed = await scope(() => service.getDeals(tenantId, { page: 1, limit: 25, sortOrder: 'desc', archived: 'false', [type === 'lead' ? 'leadId' : 'contactId']: type }));
    expect(listed.data.some(row => row.id === deal.id)).toBe(true);
    const related = await scope(() => type === 'lead' ? relationships.getLeadRelationships(type, tenantId) : relationships.getContactRelationships(type, tenantId));
    expect(related.deals.some(row => row.id === deal.id)).toBe(true);
  });

  it('keeps multiple Product Deals atomic, correctly linked and idempotent', async () => {
    const dto = { ...input(), productInterestIds: [productId, secondProductId], idempotencyKey: randomUUID() };
    const result = await scope(() => batch.createDealBatch(tenantId, 'admin', dto));
    expect(result.deals).toHaveLength(2);
    expect(result.deals.map(row => row.value)).toEqual([1234.56, 500]);
    for (const deal of result.deals) expect(deal).toMatchObject({ leadId: 'lead', assignedUserId: 'agent', accountId: 'account' });
    const retry = await scope(() => batch.createDealBatch(tenantId, 'admin', dto));
    expect(retry.replayed).toBe(true); expect(retry.deals.map(row => row.id)).toEqual(result.deals.map(row => row.id));
  });

  it('replays a committed legacy batch without imposing new associations on existing Deals', async () => {
    const dto = CreateDealBatchSchema.parse({ ...input({ leadIds: undefined }), idempotencyKey: randomUUID() });
    const deal = await db.deal.create({ data: { tenantId, title: dto.title, pipelineId: 'pipeline', stageId: 'initial' } });
    const requestHash = createHash('sha256').update(JSON.stringify({ actorId: 'admin', ...dto, productInterestIds: [...dto.productInterestIds].sort() })).digest('hex');
    await db.dealCreationReceipt.create({ data: { tenantId, actorId: 'admin', idempotencyKey: dto.idempotencyKey, requestHash, dealIds: [deal.id] } });
    const result = await scope(() => batch.createDealBatch(tenantId, 'admin', dto));
    expect(result.replayed).toBe(true); expect(result.deals[0]).toMatchObject({ id: deal.id, leadId: null, contactId: null });
    await expect(scope(() => batch.createDealBatch(tenantId, 'admin', { ...dto, idempotencyKey: randomUUID() }))).rejects.toThrow('Select one Lead or Contact');
  });

  it.each(['foreign-lead', 'missing', 'archived'])('rejects unavailable association %s without creating a Deal', async id => {
    const count = await db.deal.count();
    await expect(scope(() => batch.createDealBatch(tenantId, 'admin', { ...input({ leadIds: [id] }), idempotencyKey: randomUUID() }))).rejects.toThrow('unavailable');
    expect(await db.deal.count()).toBe(count);
  });

  it.each(['Lead', 'Contact'] as const)('keeps %s recipient-to-Deal quotation lookup on the existing junctions', async recipientType => {
    const isLead = recipientType === 'Lead';
    const deal = await scope(() => service.createDeal(tenantId, 'admin', ManualCreateDealSchema.parse(input(isLead ? {} : { leadIds: undefined, contactIds: ['contact'] }))));
    const template = await db.template.create({ data: { tenantId, name: 'Quotation', type: 'Quotation', category: 'Sales', content: JSON.stringify(defaultQuotationContent()) } });
    const draft = { quotationId: randomUUID(), templateId: template.id, recipientType, recipientId: isLead ? 'lead' : 'contact', dealId: deal.id, products: [{ productId, quantity: 1 }], quotationDate: '2026-10-18', validUntil: '2026-11-18', notes: '' };
    // Public draft IDs are UUIDs; fixture people use stable IDs for the Deal tests.
    const recipientId = randomUUID();
    if (isLead) await db.lead.create({ data: { id: recipientId, tenantId, firstName: 'Quote', lastName: 'Lead', address: 'Recipient address', assignedUserId: 'agent' } });
    else await db.contact.create({ data: { id: recipientId, tenantId, firstName: 'Quote', lastName: 'Contact', address: 'Recipient address', assignedUserId: 'agent' } });
    await scope(() => service.updateDeal(deal.id, tenantId, 'admin', { address: 'Unrelated project override', primaryAssociation: { type: isLead ? 'lead' : 'contact', id: recipientId } }));
    const result = await scope(() => quotations.buildQuotationDocument({ tenantId, userId: 'admin', role: 'Client Admin' }, { ...draft, recipientId }));
    expect(result.document.recipient.name).toBe(`Quote ${recipientType}`);
    expect(result.document.total).toBe('1234.56');
    expect(result.document.recipient.address).toBe('Recipient address');
    await expect(scope(() => quotations.buildQuotationDocument({ tenantId, userId: 'admin', role: 'Client Admin' }, { ...draft, recipientId, dealId: randomUUID() }))).rejects.toThrow('linked to this recipient');
  });

  it('enforces source View permission and restricted assignment without changing RBAC', async () => {
    await expect(scope(() => service.createDeal(tenantId, 'denied', ManualCreateDealSchema.parse(input())), 'denied')).rejects.toThrow('permission');
    await expect(scope(() => service.createDeal(tenantId, 'other-agent', ManualCreateDealSchema.parse(input())), 'other-agent')).rejects.toThrow('another agent');
    const own = await scope(() => service.createDeal(tenantId, 'agent', ManualCreateDealSchema.parse(input())), 'agent');
    expect(own.assignedUserId).toBe('agent');
  });

  it('uses the existing eligible-agent fallback for an unassigned record', async () => {
    const deal = await scope(() => service.createDeal(tenantId, 'admin', ManualCreateDealSchema.parse(input({ leadIds: ['unassigned'] }))));
    expect(['agent', 'other-agent']).toContain(deal.assignedUserId);
    expect(deal.accountId).toBeNull();
  });

  it('rejects an ineligible source owner instead of silently choosing another agent', async () => {
    await db.lead.create({ data: { id: 'invalid-owner', tenantId, firstName: 'Legacy', lastName: 'Owner', assignedUserId: 'admin' } });
    await expect(scope(() => service.createDeal(tenantId, 'admin', ManualCreateDealSchema.parse(input({ leadIds: ['invalid-owner'] }))))).rejects.toThrow('Ask an administrator to correct its assignment');
  });

  it('returns a validation error when no eligible fallback agent exists', async () => {
    const emptyTenant = 'empty-assignment';
    await db.tenant.create({ data: { id: emptyTenant, name: 'No agents', slug: emptyTenant, status: 'ACTIVE' } });
    await db.user.create({ data: { id: 'empty-admin', tenantId: emptyTenant, firstName: 'Admin', lastName: 'Fixture', email: 'empty-admin@example.test', role: 'Client Admin' } });
    await db.lead.create({ data: { id: 'empty-lead', tenantId: emptyTenant, firstName: 'Unassigned', lastName: 'Fixture' } });
    const { resolveManualDealAssociation } = await import('../deal-association');
    await expect(tenantContext.run({ tenantId: emptyTenant }, () => crmActor.run({ tenantId: emptyTenant, userId: 'empty-admin' }, () =>
      db.$transaction(tx => resolveManualDealAssociation(tx, emptyTenant, { leadIds: ['empty-lead'] }))
    ))).rejects.toThrow('No eligible Deal agent');
  });

  it.each([{ accountId: 'other-account' }, { assignedUserId: 'other-agent' }])('rejects conflicting initial Account or agent', async extra => {
    await expect(scope(() => service.createDeal(tenantId, 'admin', ManualCreateDealSchema.parse(input(extra))))).rejects.toThrow('must match');
  });

  it('changes the primary link while preserving current additional links, Account and ownership', async () => {
    const deal = await scope(() => service.createDeal(tenantId, 'admin', ManualCreateDealSchema.parse(input())));
    // A relationship added after opening the form must survive its submission.
    await db.leadDeal.create({ data: { tenantId, dealId: deal.id, leadId: 'extra-lead', position: 1 } });
    await db.contactDeal.create({ data: { tenantId, dealId: deal.id, contactId: 'extra-contact', position: 0 } });
    const saved = await scope(() => service.updateDeal(deal.id, tenantId, 'admin', { primaryAssociation: { type: 'contact', id: 'contact', previous: { type: 'lead', id: 'lead' } } }));
    expect(saved).toMatchObject({ assignedUserId: 'agent', accountId: 'account', leadId: 'extra-lead', contactId: 'contact', value: 1234.56 });
    expect(saved.contactDeals.map(link => link.contactId)).toEqual(['contact', 'extra-contact']);
    await expect(scope(() => service.updateDeal(deal.id, tenantId, 'admin', { primaryAssociation: { type: 'lead', id: 'lead', previous: { type: 'lead', id: 'missing' } } }))).rejects.toThrow('relationships changed');
  });

  it('reapplies the targeted association to the current relationships after a transaction retry', async () => {
    const repo = await import('../deals.repository');
    const deal = await scope(() => service.createDeal(tenantId, 'admin', ManualCreateDealSchema.parse(input())));
    const snapshot = await repo.findDealById(deal.id, tenantId);
    await db.leadDeal.create({ data: { tenantId, dealId: deal.id, leadId: 'extra-lead', position: 1 } });
    const read = vi.spyOn(repo, 'findDealById').mockResolvedValueOnce(snapshot);
    const write = vi.spyOn(repo, 'updateDeal').mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Retry fixture', { code: 'P2034', clientVersion: '5' }));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const saved = await scope(() => service.updateDeal(deal.id, tenantId, 'admin', { primaryAssociation: { type: 'contact', id: 'contact', previous: { type: 'lead', id: 'lead' } } }));
      expect(saved.leadDeals.map(link => link.leadId)).toEqual(['extra-lead']);
      expect(saved.contactId).toBe('contact');
      expect(write).toHaveBeenCalledTimes(2);
    } finally { read.mockRestore(); write.mockRestore(); logged.mockRestore(); }
  });

  it('leaves legacy records alone and adds an explicit choice without deleting ambiguous links', async () => {
    const deal = await db.deal.create({ data: { tenantId, title: 'Legacy', pipelineId: 'pipeline', stageId: 'initial', assignedUserId: 'agent', accountId: 'account' } });
    const updated = await scope(() => service.updateDeal(deal.id, tenantId, 'admin', { title: 'Unrelated legacy edit' }));
    expect(updated).toMatchObject({ leadDeals: [], contactDeals: [], assignedUserId: 'agent', accountId: 'account' });
    await db.leadDeal.createMany({ data: ['lead', 'extra-lead'].map((leadId, position) => ({ tenantId, dealId: deal.id, leadId, position })) });
    const saved = await scope(() => service.updateDeal(deal.id, tenantId, 'admin', { primaryAssociation: { type: 'contact', id: 'contact' } }));
    expect(saved.leadDeals.map(row => row.leadId)).toEqual(['lead', 'extra-lead']);
    expect(saved.contactId).toBe('contact');
    await expect(scope(() => service.updateDeal(deal.id, tenantId, 'other-agent', { title: 'Denied' }), 'other-agent')).rejects.toThrow('assigned to you');
  });
});


describe('linked customer address references', () => {
  const source = { type: 'lead' as const, id: 'address-lead' };
  let dealId: string;
  const read = () => scope(async () => { const deal = await service.getDealById(dealId, tenantId); return await presentation.presentDealResponse(tenantId, deal) as typeof deal & { addressContext: DealAddressContext }; });
  it('resolves individuals automatically and supports an explicit company choice', async () => {
    await db.account.create({ data: { id: 'address-account', tenantId, name: 'Address Company', address: 'Company office\nMakati' } });
    await db.lead.create({ data: { id: source.id, tenantId, firstName: 'Address', lastName: 'Customer', address: 'Home street\nPasig', assignedUserId: 'agent' } });
    const deal = await scope(() => service.createDeal(tenantId, 'admin', ManualCreateDealSchema.parse(input({ leadIds: [source.id] }))));
    dealId = deal.id;
    expect((await read()).addressContext).toMatchObject({ status: 'linked', effectiveAddress: 'Home street\nPasig' });
    await db.lead.update({ where: { id: source.id }, data: { accountId: 'address-account' } });
    expect((await read()).addressContext).toMatchObject({ status: 'choice_required', effectiveAddress: null });
    await scope(() => service.updateDeal(dealId, tenantId, 'admin', { addressSource: { type: 'account', id: 'address-account' } }));
    expect((await read()).addressContext).toMatchObject({ status: 'linked', effectiveAddress: 'Company office\nMakati' });
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).address).toBeNull();
  });
  it('shows source edits live without rewriting Deal rows and keeps overrides independent', async () => {
    const before = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
    await db.account.update({ where: { id: 'address-account' }, data: { address: 'Updated company office' } });
    expect((await read()).addressContext.effectiveAddress).toBe('Updated company office');
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).updatedAt).toEqual(before.updatedAt);
    await scope(() => service.updateDeal(dealId, tenantId, 'admin', { address: 'Installation site' }));
    expect((await read()).addressContext).toMatchObject({ status: 'override', effectiveAddress: 'Installation site', customerAddress: 'Updated company office' });
    expect((await db.account.findUniqueOrThrow({ where: { id: 'address-account' } })).address).toBe('Updated company office');
    await scope(() => service.updateDeal(dealId, tenantId, 'admin', { address: '' }));
    expect((await read()).addressContext.effectiveAddress).toBe('Updated company office');
  });
  it('rejects unrelated, archived, missing and foreign sources atomically', async () => {
    for (const id of ['extra-lead', 'archived', 'missing', 'foreign-lead']) {
      await expect(scope(() => service.updateDeal(dealId, tenantId, 'admin', { title: 'Must roll back', addressSource: { type: 'lead', id } }))).rejects.toThrow('Customer Address');
    }
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).title).toBe('Installation');
    const count = await db.deal.count();
    await expect(scope(() => service.createDeal(tenantId, 'admin', ManualCreateDealSchema.parse(input({ addressSource: source }))))).rejects.toThrow('Customer Address');
    expect(await db.deal.count()).toBe(count);
  });
  it('validates a new choice against the resulting associations and preserves unrelated links', async () => {
    await scope(() => service.updateDeal(dealId, tenantId, 'admin', { primaryAssociation: { type: 'lead', id: 'extra-lead' } }));
    await scope(() => service.updateDeal(dealId, tenantId, 'admin', { primaryAssociation: { type: 'lead', id: source.id, previous: { type: 'lead', id: 'extra-lead' } }, addressSource: source }));
    expect((await read()).leadDeals.map(link => link.leadId)).toContain(source.id);
    expect((await read()).addressSource).toEqual(source);
  });
  it('keeps a stale choice unavailable and permits unrelated legacy edits', async () => {
    await db.lead.update({ where: { id: source.id }, data: { address: '' } });
    const context = (await read()).addressContext;
    expect(context).toMatchObject({ status: 'unavailable', customerStatus: 'unavailable', effectiveAddress: null, source: null });
    await scope(() => service.updateDeal(dealId, tenantId, 'admin', { title: 'Unrelated legacy edit' }));
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).addressSource).toEqual(source);
    await scope(() => service.updateDeal(dealId, tenantId, 'admin', { addressSource: null }));
    expect((await read()).addressContext.effectiveAddress).toBe('Updated company office');
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).addressSource).toBeNull();
  });
  it('redacts inaccessible sources and retains batch creation and receipts', async () => {
    await db.lead.update({ where: { id: source.id }, data: { address: 'Current personal address' } });
    await scope(() => service.updateDeal(dealId, tenantId, 'admin', { addressSource: { type: 'account', id: 'address-account' } }));
    const hidden = await scope(async () => { const deal = await service.getDealById(dealId, tenantId); return await presentation.presentDealResponse(tenantId, deal) as typeof deal & { addressContext: DealAddressContext }; }, 'agent');
    expect(hidden.addressSource).toBeNull(); expect(hidden.addressContext).toMatchObject({ status: 'unavailable', effectiveAddress: null, source: null });
    expect(hidden.addressContext.options.every(option => option.type !== 'account')).toBe(true);
    await expect(scope(() => service.updateDeal(dealId, tenantId, 'agent', { addressSource: { type: 'account', id: 'address-account' } }), 'agent')).rejects.toThrow('Customer Address');
    const dto = { ...input({ leadIds: [source.id], addressSource: source }), productInterestIds: [productId, secondProductId], idempotencyKey: randomUUID() };
    const result = await scope(() => batch.createDealBatch(tenantId, 'admin', dto));
    expect(result.deals).toHaveLength(2);
    for (const deal of result.deals) expect(deal).toMatchObject({ addressSource: source, address: null, assignedUserId: 'agent' });
    expect((await scope(() => batch.createDealBatch(tenantId, 'admin', dto))).replayed).toBe(true);
  });
});
