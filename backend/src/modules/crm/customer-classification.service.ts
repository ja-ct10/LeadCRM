import type { Prisma } from '@prisma/client';
import { aggregateDealEngagement, classifyCustomer, normalizeCrmStatus } from '@leadcrm/shared';
import { evaluateDealEngagement } from './deals/deal-engagement.service';
import { ValidationError } from '../../shared/errors/http-error';
import { AppError } from '../../shared/errors/app-error';
import { assertCrmRecordMutation } from './access/crm-record-access.service';
import { changeCustomerStatus, customerDealWhere, type CustomerLink } from './engagement.service';
import { fireLeadStatusChanged, fireContactStatusChanged } from '../automation/triggers/triggers.service';

export async function hasQualifiedDeal(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink) {
  return !!await tx.deal.findFirst({ where: { ...customerDealWhere(tenantId, link),
    pipeline: { tenantId, isArchived: false }, stage: { tenantId, isWon: false, isLost: false, name: { equals: 'Qualified', mode: 'insensitive' } },
  }, select: { id: true } });
}

export async function classifyCustomerRecord(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink, actorId: string,
  evidence: { genuineReply?: boolean; qualificationChanged?: boolean } = {}, now = new Date(), emit = true): Promise<void> {
  const current = link.leadId ? await tx.lead.findFirst({ where: { tenantId, id: link.leadId, isArchived: false, deletedAt: null } })
    : await tx.contact.findFirst({ where: { tenantId, id: link.contactId, isArchived: false, deletedAt: null } });
  if (!current) return;
  if ('contactId' in current && current.contactId && current.convertedAt) await classifyCustomerRecord(tx, tenantId, { contactId: current.contactId }, actorId, evidence, now, emit);
  if (current.manualCancellation) return;
  const deals = await tx.deal.findMany({ where: { tenantId, deletedAt: null,
    ...(link.leadId ? { leadDeals: { some: { tenantId, leadId: link.leadId } } } : { contactDeals: { some: { tenantId, contactId: link.contactId } } }) },
    include: { stage: true, pipeline: true } });
  const status = deals.length ? aggregateDealEngagement(deals.map(deal => ({ ...deal, pipelineArchived: deal.pipeline.isArchived,
    isWon: deal.stage.isWon, isLost: deal.stage.isLost, confirmedWon: !!deal.wonConfirmedAt })))
    : classifyCustomer({ ...current, ...evidence, qualified: false }, now);
  if (!status || status === normalizeCrmStatus(current.status)) return;
  try { await assertCrmRecordMutation(tx, link.leadId ? 'leads' : 'contacts', current.id); }
  catch (error) { if (error instanceof AppError && [403, 404].includes(error.statusCode)) return; throw error; }
  if (!emit) {
    if (link.leadId) await tx.lead.update({ where: { tenantId, id: link.leadId }, data: { status } });
    else await tx.contact.update({ where: { tenantId, id: link.contactId }, data: { status: status.toUpperCase().replace(' ', '_') as import('@prisma/client').ContactStatus } });
    return;
  }
  const change = await changeCustomerStatus(tx, tenantId, actorId, link, status,
    deals.length ? 'Overall status calculated from related Deal engagement.' : 'Customer classification reevaluated from verified engagement evidence.', now);
  if (change && link.leadId) await fireLeadStatusChanged({ tenantId, actorId, eventId: change.eventId, lead: { id: current.id, status }, prevStatus: change.prevStatus });
  else if (change && link.contactId) await fireContactStatusChanged({ tenantId, actorId, eventId: change.eventId, contact: { id: current.id, status }, prevStatus: change.prevStatus });
}

/** Include removed participants so unlinking the last qualifying Deal releases protection. */
export async function refreshDealClassification(tx: Prisma.TransactionClient, tenantId: string, dealId: string, actorId: string, previous: CustomerLink[] = [], now = new Date(), emit = true) {
  const evaluated = await evaluateDealEngagement(tx, tenantId, dealId, actorId, now, emit);
  const [leads, contacts] = await Promise.all([
    tx.leadDeal.findMany({ where: { tenantId, dealId }, select: { leadId: true } }),
    tx.contactDeal.findMany({ where: { tenantId, dealId }, select: { contactId: true } }),
  ]);
  const links: CustomerLink[] = [...previous, ...leads, ...contacts];
  const unique = new Map(links.map(link => [link.leadId ? `lead:${link.leadId}` : `contact:${link.contactId}`, link]));
  for (const link of unique.values()) await classifyCustomerRecord(tx, tenantId, link, actorId, { qualificationChanged: true }, now, emit);
  return evaluated;
}

/** Existing customer update routes retain explicit cancellation and reopening only. */
export async function assertCustomerStatusEdit(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink,
  current: { status: string; manualCancellation: boolean }, requested: string | undefined) {
  if (requested === undefined || requested === normalizeCrmStatus(current.status) || requested === 'Cancelled') return;
  if (current.manualCancellation && requested === 'Inquiry') return;
  if (await tx.deal.count({ where: { tenantId, deletedAt: null,
    ...(link.leadId ? { leadDeals: { some: { tenantId, leadId: link.leadId } } } : { contactDeals: { some: { tenantId, contactId: link.contactId } } }) } })) {
    throw new ValidationError('This customer’s status is calculated from their Deals. Cancel or reopen the customer using the status action.');
  }
}

export async function withCustomerStatusPolicy<T extends { id: string }>(tx: Prisma.TransactionClient, tenantId: string, kind: 'lead' | 'contact', records: T[]) {
  const where = { tenantId, deal: { deletedAt: null } };
  const ids = records.map(record => record.id);
  const links = kind === 'lead' ? await tx.leadDeal.findMany({ where: { ...where, leadId: { in: ids } }, select: { leadId: true } })
    : await tx.contactDeal.findMany({ where: { ...where, contactId: { in: ids } }, select: { contactId: true } });
  const governed = new Set(links.map(link => 'leadId' in link ? link.leadId : link.contactId));
  return records.map(record => ({ ...record, statusManagedByDeals: governed.has(record.id) }));
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
