import { Prisma } from '@prisma/client';
import { aggregateDealEngagement, classifyCustomer, classifyDealEngagement, normalizeCrmStatus, CRM_STATUSES, type CrmStatus } from '@leadcrm/shared';
import { evaluateDealEngagement, readDealEngagementEvidence } from './deals/deal-engagement.service';
import { ValidationError } from '../../shared/errors/http-error';
import { AppError } from '../../shared/errors/app-error';
import { communicationDealContext } from './leads/sales-context';
import { assertCrmRecordMutation, authorizedWorkflowScope, readCrmStatusEvidence } from './access/crm-record-access.service';
import { changeCustomerStatus, customerDealWhere, assertClosedStatus, type CustomerLink } from './engagement.service';
import { fireLeadStatusChanged, fireContactStatusChanged } from '../automation/triggers/triggers.service';

/** Compare business evidence, never updatedAt or the sweep's evaluation timestamp. */
async function classificationCheckpoint(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink, now: Date, manualStatus?: CrmStatus) {
  const deals = await tx.deal.findMany({ where: { tenantId, deletedAt: null,
    ...(link.leadId ? { leadDeals: { some: { tenantId, leadId: link.leadId } } } : { contactDeals: { some: { tenantId, contactId: link.contactId } } }) },
    orderBy: { id: 'asc' }, select: { id: true, stageId: true, currentStageHistoryId: true, engagementStatus: true, wonConfirmedAt: true, isArchived: true, stage: { select: { isWon: true, isLost: true } }, pipeline: { select: { isArchived: true } } } });
  const current = link.leadId ? await tx.lead.findFirstOrThrow({ where: { tenantId, id: link.leadId } }) : await tx.contact.findFirstOrThrow({ where: { tenantId, id: link.contactId } });
  const verified = await Promise.all(deals.map(async deal => {
    const { events } = await readDealEngagementEvidence(tx, tenantId, deal.id, now);
    const outcome = deal.stage.isWon ? 'won' as const : deal.stage.isLost ? 'lost' as const : undefined;
    const status = classifyDealEngagement(events, now, outcome);
    const dates = events.map(event => event.at);
    const boundaries = dates.flatMap(date => [8, 30].map(days => +date + days * 86400000))
      .filter(at => at > +now && classifyDealEngagement(events, new Date(at), outcome) !== status);
    return { id: deal.id, events, status, boundaries };
  }));
  const baseline = current.lastCustomerReplyAt ?? current.firstUnansweredOutboundAt ?? current.firstStaffOutreachAt;
  const boundaries = deals.length ? verified.flatMap(row => row.boundaries)
    : baseline ? [8, 30].map(days => +baseline + days * 86400000).filter(at => at > +now &&
      classifyCustomer({ ...current, status: manualStatus ?? current.status, qualified: false }, new Date(at)) !== classifyCustomer({ ...current, status: manualStatus ?? current.status, qualified: false }, now)) : [];
  const automaticStatus = aggregateDealEngagement(deals.map((deal, index) => ({ ...deal, engagementStatus: verified[index].status,
    pipelineArchived: deal.pipeline.isArchived, isWon: deal.stage.isWon, isLost: deal.stage.isLost, confirmedWon: !!deal.wonConfirmedAt })));
  return { evidence: JSON.stringify([deals.map(({ engagementStatus: _derived, ...evidence }) => evidence),
    current.lastCustomerReplyAt, current.firstUnansweredOutboundAt, current.firstStaffOutreachAt, verified.map(({ id, events }) => ({ id, events }))]),
    ...(automaticStatus ? { automaticStatus } : {}),
    nextAgingAt: boundaries.length ? new Date(Math.min(...boundaries)).toISOString() : null };
}

export async function prepareCustomerStatus(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink, requested: CrmStatus | undefined) {
  if (requested === undefined) return undefined;
  if (['Closed Deal', 'Cancelled'].includes(requested)) return { status: requested, checkpoint: Prisma.DbNull };
  const checkpoint = await readCrmStatusEvidence(() => classificationCheckpoint(tx, tenantId, link, new Date(), requested));
  if (checkpoint.automaticStatus === 'Closed Deal') {
    if (requested === 'Inquiry') return { status: 'Closed Deal' as const, checkpoint: Prisma.DbNull }; // Reopen directly to the canonical sale outcome.
    throw new ValidationError('This customer has a confirmed sale. Use the existing governed Deal actions.');
  }
  return { status: requested, checkpoint: authorizedWorkflowScope(tenantId) ? Prisma.DbNull : checkpoint };
}

export async function hasQualifiedDeal(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink) {
  return !!await tx.deal.findFirst({ where: { ...customerDealWhere(tenantId, link),
    pipeline: { tenantId, isArchived: false }, stage: { tenantId, isWon: false, isLost: false, name: { equals: 'Qualified', mode: 'insensitive' } },
  }, select: { id: true } });
}

export function classifyCustomerRecord(...args: Parameters<typeof classifyCustomerWithEvidence>) {
  return readCrmStatusEvidence(() => classifyCustomerWithEvidence(...args));
}

async function classifyCustomerWithEvidence(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink, actorId: string,
  evidence: { genuineReply?: boolean; qualificationChanged?: boolean; originDealId?: string; source?: string } = {}, now = new Date(), emit = true): Promise<void> {
  const current = link.leadId ? await tx.lead.findFirst({ where: { tenantId, id: link.leadId, isArchived: false, deletedAt: null } })
    : await tx.contact.findFirst({ where: { tenantId, id: link.contactId, isArchived: false, deletedAt: null } });
  if (!current) return;
  if ('contactId' in current && current.contactId && current.convertedAt) await classifyCustomerRecord(tx, tenantId, { contactId: current.contactId }, actorId, evidence, now, emit);
  if (current.manualCancellation) return;
  if (current.manualStatusContext && typeof current.manualStatusContext === 'object' && !Array.isArray(current.manualStatusContext)) {
    const checkpoint = current.manualStatusContext;
    const latest = await classificationCheckpoint(tx, tenantId, link, now);
    if (checkpoint.evidence === latest.evidence && (!checkpoint.nextAgingAt || +now < +new Date(String(checkpoint.nextAgingAt)))) return;
    if (link.leadId) await tx.lead.update({ where: { tenantId, id: link.leadId }, data: { manualStatusContext: Prisma.DbNull } });
    else await tx.contact.update({ where: { tenantId, id: link.contactId }, data: { manualStatusContext: Prisma.DbNull } });
  }
  const deals = await tx.deal.findMany({ where: { tenantId, deletedAt: null,
    ...(link.leadId ? { leadDeals: { some: { tenantId, leadId: link.leadId } } } : { contactDeals: { some: { tenantId, contactId: link.contactId } } }) },
    include: { stage: true, pipeline: true } });
  const status = deals.length ? aggregateDealEngagement(deals.map(deal => ({ ...deal, pipelineArchived: deal.pipeline.isArchived,
    isWon: deal.stage.isWon, isLost: deal.stage.isLost, confirmedWon: !!deal.wonConfirmedAt })))
    : classifyCustomer({ ...current, ...evidence, qualified: false }, now);
  if (!status || status === normalizeCrmStatus(current.status)) return;
  try { await assertCrmRecordMutation(tx, link.leadId ? 'leads' : 'contacts', current.id); }
  catch (error) { if (error instanceof AppError && [403, 404].includes(error.statusCode)) return; throw error; }
  const change = await changeCustomerStatus(tx, tenantId, actorId, link, status,
    deals.length ? 'Overall status calculated from related Deal engagement.' : 'Customer classification reevaluated from verified engagement evidence.', now, {}, emit, evidence.source);
  if (!emit) return;
  if (change && link.leadId) await fireLeadStatusChanged({ tenantId, actorId, originDealId: evidence.originDealId, eventId: change.eventId, lead: { id: current.id, status }, prevStatus: change.prevStatus });
  else if (change && link.contactId) await fireContactStatusChanged({ tenantId, actorId, originDealId: evidence.originDealId, eventId: change.eventId, contact: { id: current.id, status }, prevStatus: change.prevStatus });
}

/** Include removed participants so unlinking the last qualifying Deal releases protection. */
export async function refreshDealClassification(tx: Prisma.TransactionClient, tenantId: string, dealId: string, actorId: string, previous: CustomerLink[] = [], now = new Date(), emit = true, originDealId?: string, source?: string) {
  return communicationDealContext.run(originDealId ?? communicationDealContext.getStore(), async () => {
  const evaluated = await evaluateDealEngagement(tx, tenantId, dealId, actorId, now, emit);
  const [leads, contacts] = await Promise.all([
    tx.leadDeal.findMany({ where: { tenantId, dealId }, select: { leadId: true } }),
    tx.contactDeal.findMany({ where: { tenantId, dealId }, select: { contactId: true } }),
  ]);
  const links: CustomerLink[] = [...previous, ...leads, ...contacts];
  const unique = new Map(links.map(link => [link.leadId ? `lead:${link.leadId}` : `contact:${link.contactId}`, link]));
  for (const link of unique.values()) await classifyCustomerRecord(tx, tenantId, link, actorId, { qualificationChanged: true, originDealId: communicationDealContext.getStore(), source }, now, emit);
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
  const governed = new Set(links.map(link => 'leadId' in link ? link.leadId : link.contactId));
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
    return { ...visible, statusManagedByDeals: governed.has(record.id), statusEditOptions,
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
