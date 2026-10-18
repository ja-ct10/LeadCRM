import type { Prisma } from '@prisma/client';
import { classifyCustomer, normalizeCrmStatus } from '@leadcrm/shared';
import { changeCustomerStatus, customerDealWhere, type CustomerLink } from './engagement.service';
import { fireLeadStatusChanged, fireContactStatusChanged } from '../automation/triggers/triggers.service';

export async function hasQualifiedDeal(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink) {
  return !!await tx.deal.findFirst({ where: { ...customerDealWhere(tenantId, link),
    pipeline: { tenantId, isArchived: false }, stage: { tenantId, isWon: false, isLost: false, name: { equals: 'Qualified', mode: 'insensitive' } },
  }, select: { id: true } });
}

export async function classifyCustomerRecord(tx: Prisma.TransactionClient, tenantId: string, link: CustomerLink, actorId: string,
  evidence: { genuineReply?: boolean; qualificationChanged?: boolean } = {}, now = new Date()): Promise<void> {
  const current = link.leadId ? await tx.lead.findFirst({ where: { tenantId, id: link.leadId, isArchived: false, deletedAt: null } })
    : await tx.contact.findFirst({ where: { tenantId, id: link.contactId, isArchived: false, deletedAt: null } });
  if (!current) return;
  if ('contactId' in current && current.contactId && current.convertedAt) return classifyCustomerRecord(tx, tenantId, { contactId: current.contactId }, actorId, evidence, now);
  const qualified = await hasQualifiedDeal(tx, tenantId, link);
  const status = classifyCustomer({ ...current, ...evidence, qualified,
    qualificationChanged: evidence.qualificationChanged && normalizeCrmStatus(current.status) === 'Hot' }, now);
  if (!status || status === normalizeCrmStatus(current.status)) return;
  const change = await changeCustomerStatus(tx, tenantId, actorId, link, status,
    qualified ? 'A current related Deal is Qualified.' : evidence.genuineReply ? 'Verified customer reply received.' : 'Customer classification reevaluated from current Deal and engagement evidence.', now);
  if (change && link.leadId) await fireLeadStatusChanged({ tenantId, actorId, eventId: change.eventId, lead: { id: current.id, status }, prevStatus: change.prevStatus });
  else if (change && link.contactId) await fireContactStatusChanged({ tenantId, actorId, eventId: change.eventId, contact: { id: current.id, status }, prevStatus: change.prevStatus });
}

/** Include removed participants so unlinking the last qualifying Deal releases protection. */
export async function refreshDealClassification(tx: Prisma.TransactionClient, tenantId: string, dealId: string, actorId: string, previous: CustomerLink[] = []) {
  const [leads, contacts] = await Promise.all([
    tx.leadDeal.findMany({ where: { tenantId, dealId }, select: { leadId: true } }),
    tx.contactDeal.findMany({ where: { tenantId, dealId }, select: { contactId: true } }),
  ]);
  const links: CustomerLink[] = [...previous, ...leads, ...contacts];
  const unique = new Map(links.map(link => [link.leadId ? `lead:${link.leadId}` : `contact:${link.contactId}`, link]));
  for (const link of unique.values()) await classifyCustomerRecord(tx, tenantId, link, actorId, { qualificationChanged: true });
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
