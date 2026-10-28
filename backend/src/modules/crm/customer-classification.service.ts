import { Prisma } from '@prisma/client';
import { classifyCustomer, normalizeCrmStatus, CRM_STATUSES, type CrmStatus } from '@leadcrm/shared';
import { evaluateDealEngagement } from './deals/deal-engagement.service';
import { acceptsStatusReply, isManualStatus, manualStatusCheckpoint, replyStatusCheckpoint } from './status-checkpoint';
import { ValidationError } from '../../shared/errors/http-error';
import { AppError } from '../../shared/errors/app-error';
import { communicationDealContext } from './leads/sales-context';
import { assertCrmRecordMutation, readCrmStatusEvidence } from './access/crm-record-access.service';
import { changeCustomerStatus, customerDealWhere, assertClosedStatus, type CustomerLink } from './engagement.service';
import { fireLeadStatusChanged, fireContactStatusChanged } from '../automation/triggers/triggers.service';

export async function prepareCustomerStatus(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink, requested: CrmStatus | undefined) {
  if (requested === undefined) return undefined;
  if (['Closed Deal', 'Cancelled'].includes(requested)) return { status: requested, checkpoint: Prisma.DbNull };
  const sale = await readCrmStatusEvidence(() => tx.deal.findFirst({ where: { ...customerDealWhere(tenantId, link), stage: { isWon: true }, wonConfirmedAt: { not: null } }, select: { id: true } }));
  if (sale) {
    if (requested === 'Inquiry') return { status: 'Closed Deal' as const, checkpoint: Prisma.DbNull }; // Reopen directly to the canonical sale outcome.
    throw new ValidationError('This customer has a confirmed sale. Use the existing governed Deal actions.');
  }
  return { status: requested, checkpoint: manualStatusCheckpoint(requested) };
}

export async function hasQualifiedDeal(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink) {
  return !!await tx.deal.findFirst({ where: { ...customerDealWhere(tenantId, link),
    pipeline: { tenantId, isArchived: false }, stage: { tenantId, isWon: false, isLost: false, name: { equals: 'Qualified', mode: 'insensitive' } },
  }, select: { id: true } });
}

export function classifyCustomerRecord(...args: Parameters<typeof classifyCustomerWithEvidence>) {
  return readCrmStatusEvidence(() => classifyCustomerWithEvidence(...args));
}

/** Called only for a newly persisted, verified customer reply, before history replay. */
export async function acceptCustomerReply(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink, actorId: string, at: Date, key: string, originDealId?: string) {
  const current = link.leadId
    ? await tx.lead.findFirst({ where: { tenantId, id: link.leadId, isArchived: false, deletedAt: null, convertedAt: null } })
    : await tx.contact.findFirst({ where: { tenantId, id: link.contactId, isArchived: false, deletedAt: null } });
  if (!current || current.manualCancellation || ['Closed Deal', 'Cancelled'].includes(normalizeCrmStatus(current.status)) ||
    !acceptsStatusReply(current.manualStatusContext, at, current.lastCustomerReplyAt, current.lastStatusChangedAt ?? current.updatedAt)) return;
  try { await assertCrmRecordMutation(tx, link.leadId ? 'leads' : 'contacts', current.id); }
  catch (error) { if (error instanceof AppError && [403, 404].includes(error.statusCode)) return; throw error; }
  const data = { lastCustomerReplyAt: at, firstUnansweredOutboundAt: null, engagementEvaluatedAt: new Date(), manualStatusContext: replyStatusCheckpoint(at, key) };
  if (link.leadId) await tx.lead.update({ where: { tenantId, id: link.leadId }, data });
  else await tx.contact.update({ where: { tenantId, id: link.contactId }, data });
  const change = await changeCustomerStatus(tx, tenantId, actorId, link, 'Warm', 'Verified inbound customer reply.', at, {}, true, 'gmail');
  if (change && link.leadId) await fireLeadStatusChanged({ tenantId, actorId, originDealId: originDealId ?? null, eventId: change.eventId, lead: { id: current.id, status: 'Warm' }, prevStatus: change.prevStatus });
  else if (change && link.contactId) await fireContactStatusChanged({ tenantId, actorId, originDealId: originDealId ?? null, eventId: change.eventId, contact: { id: current.id, status: 'Warm' }, prevStatus: change.prevStatus });
}

async function classifyCustomerWithEvidence(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink, actorId: string,
  evidence: { genuineReply?: boolean; qualificationChanged?: boolean; confirmedSale?: boolean; originDealId?: string; source?: string } = {}, now = new Date(), emit = true): Promise<void> {
  const current = link.leadId ? await tx.lead.findFirst({ where: { tenantId, id: link.leadId, isArchived: false, deletedAt: null } })
    : await tx.contact.findFirst({ where: { tenantId, id: link.contactId, isArchived: false, deletedAt: null } });
  if (!current) return;
  if ('contactId' in current && current.contactId && current.convertedAt) await classifyCustomerRecord(tx, tenantId, { contactId: current.contactId }, actorId, evidence, now, emit);
  if (current.manualCancellation) return;
  if (!evidence.confirmedSale && isManualStatus(current.manualStatusContext)) return;
  const status = evidence.confirmedSale ? 'Closed Deal' : classifyCustomer({ ...current, ...evidence, qualified: false }, now);
  if (!status || status === normalizeCrmStatus(current.status)) return;
  try { await assertCrmRecordMutation(tx, link.leadId ? 'leads' : 'contacts', current.id); }
  catch (error) { if (error instanceof AppError && [403, 404].includes(error.statusCode)) return; throw error; }
  const change = await changeCustomerStatus(tx, tenantId, actorId, link, status,
    evidence.confirmedSale ? 'Sale completed through the confirmed Deal.' : 'Customer classification reevaluated from verified engagement evidence.', now, {}, emit, evidence.source);
  if (!emit) return;
  if (change && link.leadId) await fireLeadStatusChanged({ tenantId, actorId, originDealId: evidence.originDealId, eventId: change.eventId, lead: { id: current.id, status }, prevStatus: change.prevStatus });
  else if (change && link.contactId) await fireContactStatusChanged({ tenantId, actorId, originDealId: evidence.originDealId, eventId: change.eventId, contact: { id: current.id, status }, prevStatus: change.prevStatus });
}

/** Ordinary Deal edits stay isolated; confirmed sales retain customer completion. */
export async function refreshDealClassification(tx: Prisma.TransactionClient, tenantId: string, dealId: string, actorId: string, previous: CustomerLink[] = [], now = new Date(), emit = true, originDealId?: string, source?: string) {
  return communicationDealContext.run(originDealId ?? communicationDealContext.getStore() ?? dealId, async () => {
  const evaluated = await evaluateDealEngagement(tx, tenantId, dealId, actorId, now, emit);
  const sale = await tx.deal.findFirst({ where: { tenantId, id: dealId, isArchived: false, deletedAt: null, stage: { isWon: true }, wonConfirmedAt: { not: null } }, select: { id: true } });
  if (!sale) return evaluated;
  const [leads, contacts] = await Promise.all([
    tx.leadDeal.findMany({ where: { tenantId, dealId }, select: { leadId: true } }),
    tx.contactDeal.findMany({ where: { tenantId, dealId }, select: { contactId: true } }),
  ]);
  const links: CustomerLink[] = [...leads, ...contacts];
  const unique = new Map(links.map(link => [link.leadId ? `lead:${link.leadId}` : `contact:${link.contactId}`, link]));
  for (const link of unique.values()) await classifyCustomerRecord(tx, tenantId, link, actorId, { confirmedSale: true, originDealId: communicationDealContext.getStore(), source }, now, emit);
  return evaluated;
  });
}

/** Manual engagement is allowed; terminal actions keep their existing prerequisites. */
export async function assertCustomerStatusEdit(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink,
  current: { status: string; manualCancellation: boolean }, requested: string | undefined) {
  if (requested === undefined || requested === normalizeCrmStatus(current.status) || requested === 'Cancelled') return;
  if (normalizeCrmStatus(current.status) === 'Closed Deal') throw new ValidationError('Closed Deal follows confirmed sale evidence. Use the existing governed Deal actions.');
  if (current.manualCancellation && requested === 'Inquiry') return;
  if (normalizeCrmStatus(current.status) === 'Cancelled' && requested !== 'Inquiry') throw new ValidationError('Reopen this customer to Inquiry before changing engagement.');
  if (requested === 'Closed Deal') await readCrmStatusEvidence(() => assertClosedStatus(tx, tenantId, link));
}

export function withCustomerStatusPolicy<T extends { id: string }>(tx: Prisma.TransactionClient, tenantId: string, kind: 'lead' | 'contact', records: T[]) {
  return readCrmStatusEvidence(() => customerStatusPolicyWithEvidence(tx, tenantId, kind, records));
}

async function customerStatusPolicyWithEvidence<T extends { id: string }>(tx: Prisma.TransactionClient, tenantId: string, kind: 'lead' | 'contact', records: T[]) {
  const where = { tenantId, deal: { deletedAt: null } };
  const ids = records.map(record => record.id);
  const deal = { select: { isArchived: true, wonConfirmedAt: true, stage: { select: { isWon: true } } } };
  const links = kind === 'lead' ? await tx.leadDeal.findMany({ where: { ...where, leadId: { in: ids } }, select: { leadId: true, deal } })
    : await tx.contactDeal.findMany({ where: { ...where, contactId: { in: ids } }, select: { contactId: true, deal } });
  return records.map(record => {
    const current = record as T & { status?: string };
    const canClose = links.some(link => ('leadId' in link ? link.leadId : link.contactId) === record.id && !link.deal.isArchived && link.deal.wonConfirmedAt && link.deal.stage.isWon);
    const status = normalizeCrmStatus(current.status);
    const { manualStatusContext: _checkpoint, ...visible } = record as T & { manualStatusContext?: unknown };
    const statusEditOptions = CRM_STATUSES.filter(option =>
      status === 'Cancelled' ? option === 'Inquiry' : status === 'Closed Deal' ? option === 'Closed Deal' || option === 'Cancelled' : option !== 'Closed Deal' || canClose);
    const reason = status === 'Cancelled' ? 'Reopen to Inquiry before changing engagement.'
      : status === 'Closed Deal' ? 'Closed Deal follows confirmed sale evidence. Use the governed Deal actions.'
      : 'Confirm a related Deal as Closed Deal first.';
    return { ...visible, statusManagedByDeals: status === 'Closed Deal', statusEditOptions,
      statusEditRestrictions: Object.fromEntries(CRM_STATUSES.filter(option => !statusEditOptions.includes(option)).map(option => [option, reason])) };
  });
}

export async function recordStaffOutreach(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink, occurredAt: Date): Promise<void> {
  if (!Number.isFinite(+occurredAt) || +occurredAt > Date.now()) return;
  const where = { tenantId, id: link.leadId ?? link.contactId, OR: [{ firstStaffOutreachAt: null }, { firstStaffOutreachAt: { gt: occurredAt } }] };
  if (link.leadId) {
    const lead = await tx.lead.findFirst({ where: { tenantId, id: link.leadId }, select: { convertedAt: true, contactId: true } });
    if (lead?.convertedAt && lead.contactId) return recordStaffOutreach(tx, tenantId, { contactId: lead.contactId }, occurredAt);
    await tx.lead.updateMany({ where, data: { firstStaffOutreachAt: occurredAt } });
  } else await tx.contact.updateMany({ where, data: { firstStaffOutreachAt: occurredAt } });
}
