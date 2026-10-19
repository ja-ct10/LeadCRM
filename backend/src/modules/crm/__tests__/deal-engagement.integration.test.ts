import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { crmActor } from '../access/crm-record-access.service';
import { salesTransaction } from '../leads/lead-automation.service';
import { refreshDealClassification, assertCustomerStatusEdit } from '../customer-classification.service';
import { moveDealStage, archiveDeal, syncLeadAssociations } from '../deals/deals.repository';
import { ingestMailboxMessages } from '../../../integrations/gmail/mailbox-ingestion.service';
import type { GmailEmail } from '../../../integrations/gmail/gmail.types';
import { associateMailboxDeal } from '../../../integrations/gmail/mailbox-sync.service';
import { backfillDealAttribution } from '../../../integrations/gmail/mailbox-deal-attribution';
import { updateContact } from '../contacts-v2/contacts-v2.repository';
import { duplicateDeal, restoreDeal } from '../deals/deals.service';
import { bulkArchive } from '../deals/bulk-deals.service';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_[a-z0-9_]+$/.test(url.pathname);
describe.skipIf(!disposable)('Deal engagement on disposable PostgreSQL', () => {
  let tenantId: string, actorId: string, pipelineId: string, leadId: string, leadStage: string, qualified: string, lost: string, won: string, accountId: string;
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, () => crmActor.run({ tenantId, userId: actorId }, work));
  const now = new Date(), ago = (days: number) => new Date(+now - days * 86_400_000);
  const refresh = (id: string, date = now) => scope(() => salesTransaction(tx => refreshDealClassification(tx, tenantId, id, actorId, [], date)));
  const read = (id: string) => prisma.deal.findFirstOrThrow({ where: { tenantId, id } });
  const person = () => prisma.lead.findFirstOrThrow({ where: { tenantId, id: leadId } });
  async function deal() {
    const result = await prisma.deal.create({ data: { tenantId, pipelineId, stageId: leadStage, title: randomUUID(), assignedUserId: actorId, value: 12000 } });
    await prisma.leadDeal.create({ data: { tenantId, leadId, dealId: result.id } });
    return result;
  }
  async function reply(dealId: string, days: number, verified = true) {
    return prisma.mailboxMessage.create({ data: { tenantId, accountId, providerMessageId: randomUUID(), threadId: randomUUID(), direction: 'inbound',
      from: (await person()).email!, fromAddress: (await person()).email!, recipients: ['staff@camxian.com'], subject: 'Deal reply', body: '', snippet: '',
      labels: ['INBOX'], sentAt: ago(days), leadId, dealId, meaningful: true, engagementRuleVersion: 2, participantPolicyVersion: 1,
      ...(verified ? { dealAttribution: { kind: 'manual', verifiedAt: now.toISOString() } } : {}) } });
  }
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Deal engagement fixture', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: now } })).id;
    actorId = (await prisma.user.create({ data: { tenantId, firstName: 'Fixture', lastName: 'Admin', email: 'staff@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: now, emailVerified: now } })).id;
    pipelineId = (await prisma.pipeline.create({ data: { tenantId, name: 'Sales Pipeline' } })).id;
    leadStage = (await prisma.stage.create({ data: { tenantId, pipelineId, name: 'Lead', order: 0, isDefault: true } })).id;
    qualified = (await prisma.stage.create({ data: { tenantId, pipelineId, name: 'Qualified', order: 1 } })).id;
    lost = (await prisma.stage.create({ data: { tenantId, pipelineId, name: 'Cancelled', order: 2, isLost: true } })).id;
    won = (await prisma.stage.create({ data: { tenantId, pipelineId, name: 'Closed Deal', order: 3, isWon: true } })).id;
    accountId = (await prisma.emailAccount.create({ data: { tenantId, userId: actorId, email: 'staff@camxian.com', accessToken: 'fixture', scopes: [], syncCursor: 'fixture', lastSyncAt: now } })).id;
  });
  beforeEach(async () => {
    leadId = (await prisma.lead.create({ data: { tenantId, firstName: 'Customer', lastName: 'Fixture', email: `${randomUUID()}@example.test`, assignedUserId: actorId } })).id;
  });
  it('isolates Deal replies, aggregates customers, and retains values and stages', async () => {
    const a = await deal(), b = await deal();
    await reply(a.id, 0); await reply(b.id, 0, false);
    await refresh(a.id); await refresh(b.id);
    expect((await read(a.id)).engagementStatus).toBe('Warm');
    expect((await read(b.id)).engagementStatus).toBe('Inquiry');
    expect((await person()).status).toBe('Warm');
    expect((await read(a.id))).toMatchObject({ value: 12000, stageId: leadStage });
    await scope(() => moveDealStage(b.id, tenantId, qualified, actorId));
    expect((await read(b.id)).engagementStatus).toBe('Hot');
    expect((await person()).status).toBe('Hot');
    await refresh(b.id, new Date(+now + 31 * 86_400_000));
    expect((await read(b.id))).toMatchObject({ engagementStatus: 'Cold', stageId: qualified, value: 12000 });
    await refresh(a.id, new Date(+now + 31 * 86_400_000));
    expect((await person()).status).toBe('Cold');
    const history = await prisma.dealStageHistory.count({ where: { tenantId, dealId: b.id } });
    await refresh(b.id, new Date(+now + 32 * 86_400_000));
    expect(await prisma.dealStageHistory.count({ where: { tenantId, dealId: b.id } })).toBe(history);
    await scope(() => archiveDeal(a.id, tenantId, 'Fixture', actorId));
    await scope(() => salesTransaction(tx => assertCustomerStatusEdit(tx, tenantId, { leadId }, { status: 'Cold', manualCancellation: false }, 'Hot'))).then(() => { throw Error('Expected derived-status rejection'); }, error => expect(error.message).toContain('calculated'));
  });
  it('requires loss reasons and cancels the customer only after every Deal is cancelled', async () => {
    const a = await deal(), b = await deal();
    await expect(scope(() => moveDealStage(a.id, tenantId, lost, actorId))).rejects.toThrow('reason');
    await scope(() => moveDealStage(a.id, tenantId, lost, actorId, undefined, undefined, 'Customer declined'));
    expect((await read(b.id))).toMatchObject({ engagementStatus: 'Inquiry', stageId: leadStage });
    expect((await person()).status).not.toBe('Cancelled');
    // Remove this test's other links without deleting any Deal or history.
    const other = await prisma.leadDeal.findMany({ where: { tenantId, leadId, dealId: { notIn: [a.id, b.id] } } });
    for (const link of other) await scope(() => syncLeadAssociations(link.dealId, tenantId, [], actorId));
    await scope(() => moveDealStage(b.id, tenantId, lost, actorId, undefined, undefined, 'No longer required'));
    expect((await person()).status).toBe('Cancelled');
    const c = await deal(); await refresh(c.id);
    expect((await person()).status).toBe('Inquiry');
    await prisma.lead.update({ where: { id: leadId }, data: { status: 'Cancelled', manualCancellation: true } });
    await reply(c.id, 0); await refresh(c.id);
    expect((await read(c.id)).engagementStatus).toBe('Warm');
    expect((await person()).status).toBe('Cancelled');
  });
  it('does not use foreign-tenant email evidence', async () => {
    const other = (await prisma.tenant.create({ data: { name: 'Foreign fixture', slug: randomUUID() } })).id;
    const target = await deal();
    const message = await reply(target.id, 0);
    const foreignActor = await prisma.user.create({ data: { tenantId: other, firstName: 'Foreign', lastName: 'User', role: 'Client Admin', email: `${randomUUID()}@example.test` } });
    const foreignAccount = await prisma.emailAccount.create({ data: { tenantId: other, userId: foreignActor.id, email: 'foreign@example.test', accessToken: 'fixture', scopes: [] } });
    await prisma.mailboxMessage.update({ where: { id: message.id }, data: { tenantId: other, accountId: foreignAccount.id } });
    await refresh(target.id);
    expect((await read(target.id)).engagementStatus).toBe('Inquiry');
    expect(other).not.toBe(tenantId);
  });
  it('starts duplicated Deals at Inquiry and aggregates bulk archive/restore', async () => {
    const a = await deal();
    const product = await prisma.productInterest.create({ data: { tenantId, name: randomUUID(), category: 'Security', dealValue: 12000 } });
    await prisma.deal.update({ where: { id: a.id }, data: { productInterestId: product.id, productsNormalized: true, assignedUserId: null } });
    await scope(() => moveDealStage(a.id, tenantId, qualified, actorId));
    const copy = await scope(() => duplicateDeal(a.id, tenantId, actorId));
    expect(copy).toMatchObject({ engagementStatus: 'Inquiry', stageId: leadStage, value: 12000 });
    expect((await person()).status).toBe('Hot');
    expect(await scope(() => bulkArchive(tenantId, actorId, { dealIds: [a.id] }))).toMatchObject({ succeeded: 1, failed: 0 });
    expect((await person()).status).toBe('Inquiry');
    await scope(() => restoreDeal(a.id, tenantId, actorId));
    expect((await person()).status).toBe('Hot');
    expect((await read(a.id))).toMatchObject({ value: 12000, stageId: qualified });
  });
  it('distinguishes automatic cancellation, ordinary saves, and authorized cancellation/reopening', async () => {
    const contact = await prisma.contact.create({ data: { tenantId, firstName: 'Status', lastName: 'Policy', assignedUserId: actorId } });
    const a = await deal();
    await prisma.contactDeal.create({ data: { tenantId, contactId: contact.id, dealId: a.id } });
    await scope(() => moveDealStage(a.id, tenantId, lost, actorId, undefined, undefined, 'Declined'));
    const customer = () => prisma.contact.findFirstOrThrow({ where: { tenantId, id: contact.id } });
    expect(await customer()).toMatchObject({ status: 'CANCELLED', manualCancellation: false });
    await scope(() => updateContact(contact.id, tenantId, { status: 'Cancelled', notes: 'Ordinary edit' }, actorId));
    expect((await customer()).manualCancellation).toBe(false);
    await scope(() => updateContact(contact.id, tenantId, { status: 'Cancelled' }, actorId));
    expect((await customer()).manualCancellation).toBe(true);
    const b = await deal(); await prisma.contactDeal.create({ data: { tenantId, contactId: contact.id, dealId: b.id } });
    await refresh(b.id);
    expect((await customer()).status).toBe('CANCELLED');
    await expect(scope(() => updateContact(contact.id, tenantId, { status: 'Hot' }, actorId))).rejects.toThrow('calculated');
    await scope(() => updateContact(contact.id, tenantId, { status: 'Inquiry' }, actorId));
    expect(await customer()).toMatchObject({ status: 'INQUIRY', manualCancellation: false });
    expect((await read(b.id)).stageId).toBe(leadStage);
  });
  it('requires explicit attribution and verified ancestry, never the only open Deal', async () => {
    const a = await deal(), b = await deal(), customer = await person();
    const account = await prisma.emailAccount.findFirstOrThrow({ where: { tenantId, id: accountId } });
    const permissions = { leadsView: true, contactsView: true, leadsEdit: true, contactsEdit: true, dealsView: true, dealsEdit: true };
    const email = (extra: Partial<GmailEmail> = {}): GmailEmail => ({ id: randomUUID(), threadId: randomUUID(), from: customer.email!, to: [account.email],
      subject: 'Specific opportunity', body: 'A genuine reply', snippet: 'Reply', date: now.toISOString(), labels: ['INBOX'], isRead: false, automated: false, ...extra });
    const unassociated = email();
    await scope(() => ingestMailboxMessages(account, [unassociated], permissions));
    const legacy = await prisma.mailboxMessage.findFirstOrThrow({ where: { tenantId, providerMessageId: unassociated.id } });
    expect(legacy.dealId).toBeNull();
    await prisma.mailboxMessage.update({ where: { id: legacy.id }, data: { dealId: a.id } });
    await scope(() => associateMailboxDeal(tenantId, actorId, unassociated.threadId, a.id, { messageId: unassociated.id }));
    expect((await prisma.mailboxMessage.findUniqueOrThrow({ where: { id: legacy.id } })).dealAttribution).toMatchObject({ kind: 'manual' });
    const associationNotes = await prisma.activity.count({ where: { tenantId, dealId: a.id, title: 'Email conversation associated with this Deal' } });
    await scope(() => associateMailboxDeal(tenantId, actorId, unassociated.threadId, a.id, { messageId: unassociated.id }));
    expect(await prisma.activity.count({ where: { tenantId, dealId: a.id, title: 'Email conversation associated with this Deal' } })).toBe(associationNotes);
    const sent = email({ from: account.email, to: [customer.email!], labels: ['SENT'], rfcMessageId: '<explicit@fixture>' });
    await scope(() => ingestMailboxMessages(account, [sent], permissions, { dealId: a.id }));
    const inbound = email({ threadId: sent.threadId, rfcInReplyTo: '<explicit@fixture>' });
    await scope(() => ingestMailboxMessages(account, [inbound], permissions));
    expect((await read(a.id)).engagementStatus).toBe('Warm');
    expect((await read(b.id)).engagementStatus).toBe('Inquiry');
    const participant = await prisma.contact.create({ data: { tenantId, firstName: 'Second', lastName: 'Participant', email: `${randomUUID()}@example.test`, assignedUserId: actorId } });
    await prisma.contactDeal.create({ data: { tenantId, contactId: participant.id, dealId: a.id } });
    const secondReply = email({ from: participant.email!, threadId: sent.threadId, rfcInReplyTo: '<explicit@fixture>' });
    await scope(() => ingestMailboxMessages(account, [secondReply], permissions));
    expect((await prisma.mailboxMessage.findFirstOrThrow({ where: { tenantId, providerMessageId: secondReply.id } })).dealAttribution).toMatchObject({ kind: 'reply' });
    const count = await prisma.activity.count({ where: { tenantId, dealId: a.id, type: 'stage_change' } });
    await scope(() => ingestMailboxMessages(account, [inbound], permissions));
    expect(await prisma.activity.count({ where: { tenantId, dealId: a.id, type: 'stage_change' } })).toBe(count);
    const only = await deal();
    await scope(() => syncLeadAssociations(a.id, tenantId, [], actorId));
    await scope(() => syncLeadAssociations(b.id, tenantId, [], actorId));
    const unrelated = email(); await scope(() => ingestMailboxMessages(account, [unrelated], permissions));
    expect((await prisma.mailboxMessage.findFirstOrThrow({ where: { tenantId, providerMessageId: unrelated.id } })).dealId).toBeNull();
    expect((await read(only.id)).engagementStatus).toBe('Inquiry');
  });
  it('preserves winning requirements and lifecycle while another opportunity remains active', async () => {
    const a = await deal(), b = await deal();
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: null } });
    await expect(scope(() => moveDealStage(a.id, tenantId, won, actorId))).rejects.toThrow('Qualified');
    await scope(() => moveDealStage(a.id, tenantId, qualified, actorId));
    await scope(() => moveDealStage(a.id, tenantId, won, actorId));
    expect((await read(a.id))).toMatchObject({ engagementStatus: 'Closed Deal', stageId: won, value: 12000, hasEverBeenWon: true });
    expect((await read(a.id)).wonConfirmedAt).toBeInstanceOf(Date);
    expect((await read(b.id))).toMatchObject({ engagementStatus: 'Inquiry', stageId: leadStage, value: 12000 });
    const lead = await person(); expect(lead.status).toBe('Inquiry'); expect(lead.convertedAt).toBeInstanceOf(Date);
    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId, id: lead.contactId! } });
    expect(contact).toMatchObject({ status: 'INQUIRY', lifecycleStage: 'CUSTOMER' });
    expect(contact.customerSince).toBeInstanceOf(Date);
    await expect(scope(() => moveDealStage(a.id, tenantId, leadStage, actorId))).rejects.toThrow('won');
    await scope(() => archiveDeal(a.id, tenantId, 'Historical sale', actorId));
    await scope(() => moveDealStage(b.id, tenantId, lost, actorId, undefined, undefined, 'Other opportunity declined'));
    expect((await person()).status).toBe('Closed Deal');
    await scope(() => updateContact(contact.id, tenantId, { status: 'Closed Deal', notes: 'Historical sale retained' }, actorId));
    expect(await prisma.contact.findFirstOrThrow({ where: { tenantId, id: contact.id } })).toMatchObject({ status: 'CLOSED_DEAL', customerSince: contact.customerSince });
  });
  it('backfills only provable history without replaying activities or workflows', async () => {
    const a = await deal(), b = await deal();
    const sent = await prisma.mailboxMessage.create({ data: { tenantId, accountId, providerMessageId: randomUUID(), threadId: randomUUID(), direction: 'outbound',
      from: 'staff@camxian.com', recipients: [(await person()).email!], subject: 'Historical send', body: '', snippet: '', labels: ['SENT'], sentAt: ago(40),
      leadId, dealId: a.id, engagementRuleVersion: 2, participantPolicyVersion: 1, rfcMessageId: '<backfill@fixture>' } });
    await prisma.mailboxSendReceipt.create({ data: { tenantId, accountId, requestId: randomUUID(), payloadHash: 'fixture', status: 'sent',
      providerMessageId: sent.providerMessageId, authorizationContext: { dealId: a.id, composeMode: 'compose' } } });
    await reply(b.id, 0, false);
    const activities = await prisma.activity.count({ where: { tenantId } });
    const events = await prisma.workflowTriggerRecord.count({ where: { tenantId } });
    await scope(() => salesTransaction(async tx => {
      await backfillDealAttribution(tx, tenantId);
      await refreshDealClassification(tx, tenantId, a.id, actorId, [], now, false);
      await refreshDealClassification(tx, tenantId, b.id, actorId, [], now, false);
    }));
    expect((await read(a.id)).engagementStatus).toBe('Cold');
    expect((await read(b.id)).engagementStatus).toBe('Inquiry');
    const inbound = await reply(a.id, 2, false);
    await prisma.mailboxMessage.update({ where: { id: inbound.id }, data: { threadId: sent.threadId, rfcInReplyTo: sent.rfcMessageId } });
    await scope(() => salesTransaction(async tx => {
      await backfillDealAttribution(tx, tenantId);
      await refreshDealClassification(tx, tenantId, a.id, actorId, [], now, false);
    }));
    expect((await read(a.id)).engagementStatus).toBe('Warm');
    expect((await prisma.mailboxMessage.findUniqueOrThrow({ where: { id: inbound.id } })).dealAttribution).toMatchObject({ kind: 'reply' });
    expect(await prisma.activity.count({ where: { tenantId } })).toBe(activities);
    expect(await prisma.workflowTriggerRecord.count({ where: { tenantId } })).toBe(events);
    const unrelated = await reply(a.id, 0, false);
    await prisma.mailboxMessage.update({ where: { id: unrelated.id }, data: { from: 'unlinked@example.test', threadId: sent.threadId, rfcInReplyTo: sent.rfcMessageId } });
    await scope(() => salesTransaction(tx => backfillDealAttribution(tx, tenantId)));
    expect((await prisma.mailboxMessage.findUniqueOrThrow({ where: { id: unrelated.id } })).dealAttribution).toBeNull();
  });
});
