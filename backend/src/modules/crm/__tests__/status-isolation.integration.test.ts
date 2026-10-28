import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { replayCrmMigrations } from '../../../tests/replay-crm-migrations';
import { installTenantScoping } from '../../../core/tenant/tenant-prisma';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { crmActor } from '../access/crm-record-access.service';
import { manualStatusCheckpoint } from '../status-checkpoint';
import type { GmailEmail } from '../../../integrations/gmail/gmail.types';
import { EMPTY_PERMISSION_FLAGS } from '@leadcrm/shared';

const holder = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock('../../../config/database.config', () => ({ default: new Proxy({}, { get: (_target, property) => {
  const value = (holder.client as any)[property]; return typeof value === 'function' ? value.bind(holder.client) : value;
} }) }));
let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient;
let service: typeof import('../deals/deals.service');
let customer: typeof import('../customer-classification.service');
let ingestion: typeof import('../../../integrations/gmail/mailbox-ingestion.service');
let audiences: typeof import('../../marketing/campaigns/audiences.service');
let leadRepo: typeof import('../contacts/contacts.repository');
let contactRepo: typeof import('../contacts-v2/contacts-v2.repository');
let tenantId: string, actorId: string, pipelineId: string, leadId: string, email: string, accountId: string;
let a: string, b: string;
let stages: Record<string, string>;
const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, () => crmActor.run({ tenantId, userId: actorId }, work));
const permissions = { leadsView: true, contactsView: true, leadsEdit: true, contactsEdit: true, dealsEdit: true, dealsView: true, clientAdmin: true };
beforeAll(async () => {
  pg = await PGlite.create(); await replayCrmMigrations(pg);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
  db = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1` } } });
  holder.client = db; installTenantScoping(db);
  service = await import('../deals/deals.service'); customer = await import('../customer-classification.service');
  ingestion = await import('../../../integrations/gmail/mailbox-ingestion.service');
  audiences = await import('../../marketing/campaigns/audiences.service');
  leadRepo = await import('../contacts/contacts.repository'); contactRepo = await import('../contacts-v2/contacts-v2.repository');
  tenantId = (await db.tenant.create({ data: { name: 'Status isolation', slug: randomUUID(), status: 'ACTIVE' } })).id;
  actorId = (await db.user.create({ data: { tenantId, email: 'status-admin@camxian.com', firstName: 'Status', lastName: 'Admin', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } })).id;
  pipelineId = (await db.pipeline.create({ data: { tenantId, name: 'Sales Pipeline' } })).id;
  stages = {};
  for (const [order, name] of ['Lead', 'Contacted', 'Qualified', 'Closed Deal', 'Cancelled'].entries()) stages[name] = (await db.stage.create({ data: { tenantId, pipelineId, name, order, isWon: name === 'Closed Deal', isLost: name === 'Cancelled', isDefault: name === 'Lead' } })).id;
  accountId = (await db.emailAccount.create({ data: { tenantId, userId: actorId, email: 'status-admin@camxian.com', accessToken: 'fixture', scopes: [], syncCursor: 'verified', lastSyncAt: new Date() } })).id;
}, 90000);
afterAll(async () => { await db?.$disconnect(); await socket?.stop(); await pg?.close(); });
beforeEach(async () => {
  await db.workflow.updateMany({ where: { tenantId }, data: { isActive: false } });
  email = `${randomUUID()}@example.test`;
  leadId = (await db.lead.create({ data: { tenantId, firstName: 'Lead', lastName: 'Fixture', email, phone: '+639123456789', assignedUserId: actorId } })).id;
  const ids = [];
  for (let i = 0; i < 2; i++) ids.push((await db.deal.create({ data: { tenantId, title: `Deal ${i}`, pipelineId, stageId: stages.Lead, assignedUserId: actorId, leadDeals: { create: { leadId } } } })).id);
  [a, b] = ids;
});
const deal = (id: string) => db.deal.findUniqueOrThrow({ where: { id } });
const person = () => db.lead.findUniqueOrThrow({ where: { id: leadId } });
async function ingest(direction: 'inbound' | 'outbound', dealId?: string, overrides: Partial<GmailEmail> = {}) {
  const threadId = overrides.threadId ?? randomUUID(), parent = `<parent-${randomUUID()}@example.test>`;
  if (dealId) await db.mailboxMessage.create({ data: { tenantId, accountId, providerMessageId: randomUUID(), threadId, direction: 'outbound', from: 'status-admin@camxian.com', fromAddress: 'status-admin@camxian.com', recipients: [email], recipientAddresses: [email], subject: 'Outreach', body: '', snippet: '', labels: ['SENT'], sentAt: new Date(Date.now() - 60000), leadId, dealId, dealAttribution: { kind: 'explicit_send' }, rfcMessageId: parent, engagementRuleVersion: 2, participantPolicyVersion: 1 } });
  const message: GmailEmail = { id: randomUUID(), threadId, from: direction === 'inbound' ? email : 'status-admin@camxian.com', to: [direction === 'inbound' ? 'status-admin@camxian.com' : email], subject: 'Reply', body: 'A real customer reply', snippet: '', date: new Date().toISOString(), labels: direction === 'inbound' ? ['INBOX'] : ['SENT'], direction, rfcMessageId: `<${randomUUID()}@example.test>`, ...(dealId ? { rfcInReplyTo: parent } : {}), ...overrides };
  const account = await db.emailAccount.findUniqueOrThrow({ where: { id: accountId } });
  await scope(() => ingestion.ingestMailboxMessages(account, [message], permissions));
  return { account, message };
}

describe('isolated Deal and inbound reply transitions', () => {
  it('cancels and reopens only the selected Deal and keeps Inquiry after a sweep', async () => {
    const before = await person(), sibling = await deal(b);
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Cancelled', lostReason: 'Selected opportunity ended.' }));
    expect(await deal(a)).toMatchObject({ stageId: stages.Cancelled, engagementStatus: 'Cancelled' });
    expect(await deal(b)).toEqual(sibling); expect(await person()).toEqual(before);
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Inquiry' }));
    await scope(() => import('../leads/lead-automation.service').then(({ salesTransaction }) => salesTransaction(tx => customer.refreshDealClassification(tx, tenantId, a, actorId, [], new Date(Date.now() + 90 * 86400000)))));
    expect(await deal(a)).toMatchObject({ stageId: stages.Lead, engagementStatus: 'Inquiry', closedAt: null, lostReason: null });
    expect(await deal(b)).toEqual(sibling); expect(await person()).toEqual(before);
  });
  it('synchronizes manual Warm, Hot and Cold without changing the customer or sibling', async () => {
    const before = await person(), sibling = await deal(b);
    for (const [status, stage] of [['Warm', 'Contacted'], ['Hot', 'Qualified'], ['Cold', 'Qualified']] as const) {
      await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: status }));
      expect(await deal(a)).toMatchObject({ engagementStatus: status, stageId: stages[stage] });
    }
    expect(await person()).toEqual(before); expect(await deal(b)).toEqual(sibling);
  });
  it('protects a same-value Deal selection against scheduled aging', async () => {
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Inquiry' }));
    expect((await deal(a)).manualStatusContext).toMatchObject({ source: 'manual', status: 'Inquiry' });
    await scope(() => import('../leads/lead-automation.service').then(({ salesTransaction }) => salesTransaction(tx => customer.refreshDealClassification(tx, tenantId, a, actorId, [], new Date(Date.now() + 90 * 86400000)))));
    expect(await deal(a)).toMatchObject({ engagementStatus: 'Inquiry', stageId: stages.Lead });
  });
  it('isolates cancellation and reopening for multiple Deals sharing a Contact', async () => {
    const contact = await db.contact.create({ data: { tenantId, firstName: 'Contact', lastName: 'Deals', email: `${randomUUID()}@example.test`, assignedUserId: actorId } });
    for (const id of [a,b]) {
      await db.leadDeal.deleteMany({ where: { tenantId, dealId: id } });
      await db.contactDeal.create({ data: { tenantId, dealId: id, contactId: contact.id } });
    }
    const sibling = await deal(b);
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Cancelled', lostReason: 'Only this Deal.' }));
    expect(await deal(a)).toMatchObject({ stageId: stages.Cancelled, engagementStatus: 'Cancelled' });
    expect(await deal(b)).toEqual(sibling);
    expect(await db.contact.findUniqueOrThrow({ where: { id: contact.id } })).toEqual(contact);
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Inquiry' }));
    expect(await deal(a)).toMatchObject({ stageId: stages.Lead, engagementStatus: 'Inquiry', lostReason: null });
    expect(await deal(b)).toEqual(sibling);
    expect(await db.contact.findUniqueOrThrow({ where: { id: contact.id } })).toEqual(contact);
  });
  it('keeps outbound activity without changing customer status or entering Contacted', async () => {
    await ingest('outbound', a);
    expect(await person()).toMatchObject({ status: 'Inquiry' });
    expect(await deal(a)).toMatchObject({ engagementStatus: 'Inquiry', stageId: stages.Lead });
    expect(await db.activity.count({ where: { tenantId, leadId, type: 'email' } })).toBe(1);
  });
  it('warms one customer and moves only the explicitly attributed Deal on a fresh reply', async () => {
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Hot' }));
    const sibling = await deal(b);
    const { account, message } = await ingest('inbound', a);
    expect(await person()).toMatchObject({ status: 'Warm' });
    expect(await deal(a)).toMatchObject({ engagementStatus: 'Warm', stageId: stages.Contacted });
    expect(await deal(b)).toEqual(sibling);
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Cold' }));
    await scope(() => ingestion.ingestMailboxMessages(account, [message], permissions));
    expect(await deal(a)).toMatchObject({ engagementStatus: 'Cold', stageId: stages.Contacted });
    expect(await db.activity.count({ where: { tenantId, leadId, type: 'email' } })).toBe(1);
  });
  it('does not guess a Deal for customer-only replies', async () => {
    await ingest('inbound');
    expect(await person()).toMatchObject({ status: 'Warm' });
    for (const id of [a, b]) expect(await deal(id)).toMatchObject({ engagementStatus: 'Inquiry', stageId: stages.Lead });
  });
  it('does not classify a Deal when a sender matches multiple customer records', async () => {
    await db.contact.create({ data: { tenantId, firstName: 'Duplicate', lastName: 'Identity', email, assignedUserId: actorId } });
    const before = await person(), selected = await deal(a);
    await ingest('inbound', a);
    expect(await person()).toEqual(before);
    expect(await deal(a)).toEqual(selected);
  });
  it('does not renew reply evidence from a duplicate RFC message in a different provider copy', async () => {
    const { account, message } = await ingest('inbound', a, { date: new Date(Date.now() - 60000).toISOString() });
    const before = await person();
    await scope(() => ingestion.ingestMailboxMessages(account, [{ ...message, id: randomUUID(), date: new Date().toISOString() }], permissions));
    expect((await person()).lastCustomerReplyAt).toEqual(before.lastCustomerReplyAt);
    expect((await deal(a)).manualStatusContext).toMatchObject({ source: 'reply', replyAt: message.date });
    expect(await db.mailboxMessage.count({ where: { tenantId, rfcMessageId: message.rfcMessageId, meaningful: true } })).toBe(1);
  });
  it.each([true, false])('scopes configured all-matching workflows to the inbound reply Deal (associated=%s)', async associated => {
    const { createWorkflow } = await import('../../automation/workflows/workflows.service');
    const { flushWorkflowQueue } = await import('../../automation/workflows/__tests__/workflow-queue-test-helper');
    await db.deal.update({ where: { id: b }, data: { stageId: associated ? stages.Contacted : stages.Lead } });
    await scope(() => createWorkflow(tenantId, actorId, { name: `Reply scoped action ${associated}`, trigger: 'lead.status_changed', isActive: true,
      conditions: { operator: 'AND', conditions: [{ field: 'event.newStatus', operator: 'equals', value: 'Warm' }] },
      actions: [{ type: 'move_deal_stage', config: { stageId: stages.Qualified, currentStageId: associated ? stages.Contacted : stages.Lead, targetMode: 'all_matching' } }] }));
    await ingest('inbound', associated ? a : undefined);
    await flushWorkflowQueue(tenantId);
    expect(await deal(a)).toMatchObject({ stageId: associated ? stages.Qualified : stages.Lead });
    expect(await deal(b)).toMatchObject({ stageId: associated ? stages.Contacted : stages.Lead });
  });
  it('retains the originating Deal through confirmed-sale conversion workflows', async () => {
    const { createWorkflow } = await import('../../automation/workflows/workflows.service');
    const { flushWorkflowQueue } = await import('../../automation/workflows/__tests__/workflow-queue-test-helper');
    await scope(() => createWorkflow(tenantId, actorId, { name: 'Converted Contact action', trigger: 'contact.created', isActive: true,
      actions: [{ type: 'move_deal_stage', config: { stageId: stages.Qualified, currentStageId: stages.Lead, targetMode: 'all_matching' } }] }));
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Hot' }));
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Closed Deal' }));
    await flushWorkflowQueue(tenantId);
    expect(await deal(a)).toMatchObject({ stageId: stages['Closed Deal'], engagementStatus: 'Closed Deal' });
    expect(await deal(b)).toMatchObject({ stageId: stages.Lead, engagementStatus: 'Inquiry' });
    const lead = await person(); expect(lead.status).toBe('Closed Deal'); expect(lead.contactId).toBeTruthy();
    expect(await db.contact.findUniqueOrThrow({ where: { id: lead.contactId! } })).toMatchObject({ status: 'CLOSED_DEAL', lifecycleStage: 'CUSTOMER' });
  });
  it('preserves manual selections against delayed history and duplicate RFC identities', async () => {
    const { account, message } = await ingest('inbound', a);
    await scope(() => leadRepo.updateContact(leadId, tenantId, { status: 'Cold' }, actorId, 'Warm'));
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Cold' }));
    await scope(() => ingestion.ingestMailboxMessages(account, [{ ...message, id: randomUUID() }, { ...message, id: randomUUID(), rfcMessageId: '<old-newly-discovered@example.test>', date: new Date(Date.now() - 86400000).toISOString() }], permissions));
    expect(await person()).toMatchObject({ status: 'Cold' });
    expect(await deal(a)).toMatchObject({ engagementStatus: 'Cold' });
    await ingest('inbound', a);
    expect(await person()).toMatchObject({ status: 'Warm' });
    expect(await deal(a)).toMatchObject({ engagementStatus: 'Warm', stageId: stages.Contacted });
  });
  it('protects a same-value Contact selection and allows only a later genuine reply', async () => {
    const contact = await db.contact.create({ data: { tenantId, firstName: 'Contact', lastName: 'Fixture', email: `${randomUUID()}@example.test`, assignedUserId: actorId } });
    await scope(() => contactRepo.updateContact(contact.id, tenantId, { status: 'Inquiry' }, actorId));
    const saved = await db.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(saved.manualStatusContext).toMatchObject({ source: 'manual', status: 'Inquiry' });
    await scope(() => import('../leads/lead-automation.service').then(({ salesTransaction }) => salesTransaction(tx => customer.classifyCustomerRecord(tx, tenantId, { contactId: contact.id }, actorId, {}, new Date(Date.now() + 90 * 86400000)))));
    expect((await db.contact.findUniqueOrThrow({ where: { id: contact.id } })).status).toBe('INQUIRY');
    email = contact.email!;
    await ingest('inbound');
    expect((await db.contact.findUniqueOrThrow({ where: { id: contact.id } })).status).toBe('WARM');
  });
  it('keeps cancelled terminal records closed to email activity', async () => {
    await scope(() => service.updateDeal(a, tenantId, actorId, { engagementStatus: 'Cancelled', lostReason: 'Ended' }));
    await db.lead.update({ where: { id: leadId }, data: { status: 'Cancelled', manualCancellation: true, manualStatusContext: manualStatusCheckpoint('Cancelled') } });
    await ingest('inbound', a);
    expect(await person()).toMatchObject({ status: 'Cancelled' });
    expect(await deal(a)).toMatchObject({ stageId: stages.Cancelled, engagementStatus: 'Cancelled' });
  });
  it('returns scoped canonical phone/email options and evaluates a saved condition unchanged', async () => {
    const fields = await scope(() => audiences.audienceFieldsWithOptions(tenantId, 'LEADS'));
    expect(fields.find(field => field.technicalKey === 'email')?.options).toContain(email);
    expect(fields.find(field => field.technicalKey === 'phone')?.options).toContain('+639123456789');
    const result = await scope(() => audiences.previewAudience(tenantId, { source: 'LEADS', conditions: [{ field: 'email', operator: 'equals', value: email }], channel: 'EMAIL', page: 1, limit: 25 }));
    expect(result.recipients.map(row => row.id)).toContain(leadId);
    const byPhone = await scope(() => audiences.previewAudience(tenantId, { source: 'LEADS', conditions: [{ field: 'phone', operator: 'equals', value: '+639123456789' }], channel: 'EMAIL', page: 1, limit: 25 }));
    expect(byPhone.recipients.map(row => row.id)).toContain(leadId);
  });
  it('isolates both audience pickers by source, assignment, active state and tenant', async () => {
    const role = await db.roleDefinition.create({ data: { tenantId, name: randomUUID(), permissions: { create: ['leads', 'contacts'].map(module => ({ ...EMPTY_PERMISSION_FLAGS, module, canView: true, canViewAll: true })) } } });
    const agent = await db.user.create({ data: { tenantId, firstName: 'Picker', lastName: 'Agent', email: `${randomUUID()}@camxian.com`, role: role.name, userRoles: { create: { roleId: role.id } } } });
    const foreign = await db.tenant.create({ data: { name: 'Other picker tenant', slug: randomUUID(), status: 'ACTIVE' } });
    for (const source of ['LEADS', 'CONTACTS'] as const) {
      const create = source === 'LEADS' ? db.lead.create.bind(db.lead) : db.contact.create.bind(db.contact);
      const ownEmail = `${randomUUID()}@example.test`, ownPhone = '+639998887777';
      await create({ data: { tenantId, firstName: 'Own', lastName: 'Value', assignedUserId: agent.id, email: ownEmail, phone: ownPhone } });
      for (const data of [{ tenantId, isArchived: true, assignedUserId: agent.id }, { tenantId, assignedUserId: actorId }, { tenantId: foreign.id }]) await create({ data: { ...data, firstName: 'Hidden', lastName: 'Value', email: `${randomUUID()}@example.test`, phone: '+639111110000' } });
      const fields = await tenantContext.run({ tenantId }, () => crmActor.run({ tenantId, userId: agent.id }, () => audiences.audienceFieldsWithOptions(tenantId, source)));
      expect(fields.find(field => field.technicalKey === 'email')?.options).toEqual([ownEmail]);
      expect(fields.find(field => field.technicalKey === 'phone')?.options).toEqual([ownPhone]);
    }
  });
  it('does not move a Deal whose verified participants do not match the replying customer', async () => {
    const other = await db.lead.create({ data: { tenantId, firstName: 'Other', lastName: 'Customer', email: `${randomUUID()}@example.test`, assignedUserId: actorId } });
    const foreign = await db.deal.create({ data: { tenantId, title: 'Other customer Deal', pipelineId, stageId: stages.Lead, assignedUserId: actorId, leadDeals: { create: { leadId: other.id } } } });
    await ingest('inbound', foreign.id);
    expect(await person()).toMatchObject({ status: 'Warm' });
    for (const id of [a,b,foreign.id]) expect(await deal(id)).toMatchObject({ stageId: stages.Lead, engagementStatus: 'Inquiry' });
  });
  it('inventories archived IDs and active dependency blockers without performing deletion', async () => {
    await db.deal.update({ where: { id: a }, data: { isArchived: true } });
    const { inventoryArchived } = require('../../../../scripts/inventory-archived-records.cjs');
    const before = await db.deal.count();
    const manifest = await inventoryArchived(db, tenantId);
    const archived = manifest.records.find((row: { id: string }) => row.id === a);
    expect(archived).toMatchObject({ table: 'Deal', id: a, proposedForDeletion: false });
    expect(archived.blockers).toContain('Dependency links active records: LeadDeal');
    expect(await db.deal.count()).toBe(before);
  });
});
