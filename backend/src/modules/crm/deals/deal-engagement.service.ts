import { Prisma } from '@prisma/client';
import { classifyDealEngagement, type DealEngagementEvent } from '@leadcrm/shared';
import { fireDealUpdated } from '../../automation/triggers/triggers.service';
import { assertCrmRecordMutation } from '../access/crm-record-access.service';
import { AppError } from '../../../shared/errors/app-error';

/** Evidence stays in the existing stage history and mailbox tables, not a second event store. */
export async function evaluateDealEngagement(tx: Prisma.TransactionClient, tenantId: string, dealId: string, actorId: string,
  now = new Date(), emit = true) {
  const deal = await tx.deal.findFirst({ where: { tenantId, id: dealId, deletedAt: null }, include: { stage: true } });
  if (!deal || deal.isArchived) return deal;
  // A sweep's snapshot may precede a qualification/reply committed during that sweep.
  if (deal.engagementEvaluatedAt && +deal.engagementEvaluatedAt > +now) return deal;
  const [qualifications, messages] = await Promise.all([
    tx.dealStageHistory.findMany({ where: { tenantId, dealId, newStage: { tenantId, name: { equals: 'Qualified', mode: 'insensitive' }, isWon: false, isLost: false } },
      select: { previousStageId: true, newStageId: true, movedAt: true } }),
    tx.mailboxMessage.findMany({ where: { tenantId, dealId,
      NOT: [{ dealAttribution: { equals: Prisma.DbNull } }, { labels: { hasSome: ['DRAFT', 'SPAM', 'TRASH', 'DELETED'] } }],
      engagementRuleVersion: 2, participantPolicyVersion: 1, sentAt: { lte: now } },
      select: { id: true, accountId: true, providerMessageId: true, direction: true, meaningful: true, sentAt: true,
        account: { select: { syncPageToken: true, syncBaselineHistoryId: true, syncError: true } } } }),
  ]);
  const receipts = messages.length ? await tx.mailboxSendReceipt.findMany({ where: { tenantId, operation: { in: ['send', 'schedule'] }, status: 'sent',
    OR: messages.filter(message => message.direction === 'outbound').map(message => ({ accountId: message.accountId, providerMessageId: message.providerMessageId })) },
    select: { accountId: true, providerMessageId: true } }) : [];
  const events: DealEngagementEvent[] = qualifications.filter(row => row.previousStageId !== row.newStageId).map(row => ({ type: 'qualified', at: row.movedAt }));
  for (const message of messages) {
    if (message.direction === 'inbound' && message.meaningful) events.push({ type: 'reply', at: message.sentAt });
    if (message.direction === 'outbound' && receipts.some(receipt => receipt.accountId === message.accountId && receipt.providerMessageId === message.providerMessageId)) events.push({ type: 'outreach', at: message.sentAt });
  }
  let status = classifyDealEngagement(events, now, deal.stage.isWon ? 'won' : deal.stage.isLost ? 'lost' : undefined);
  const incomplete = messages.some(message => message.account.syncPageToken || message.account.syncBaselineHistoryId || message.account.syncError);
  // Incomplete first sync cannot prove absence of a newer reply. Verified snapshots can still age offline.
  if (!deal.engagementEvaluatedAt && incomplete && status === 'Cold') status = 'Inquiry';
  if (status === deal.engagementStatus && (deal.engagementEvaluatedAt || incomplete)) return deal;
  // Readable mailbox history must still persist when CRM editing is unavailable.
  // The existing administrator sweep will update the derived status later.
  try { await assertCrmRecordMutation(tx, 'deals', dealId); }
  catch (error) { if (error instanceof AppError && [403, 404].includes(error.statusCode)) return deal; throw error; }
  const updated = await tx.deal.update({ where: { tenantId, id: dealId }, data: { engagementStatus: status,
    ...(!incomplete ? { engagementEvaluatedAt: now } : {}) } });
  if (emit && status !== deal.engagementStatus) {
    const activity = await tx.activity.create({ data: { tenantId, dealId, createdById: actorId, type: 'stage_change',
      title: `Deal engagement changed from ${deal.engagementStatus} to ${status}`, metadata: { source: 'deal_engagement' } } });
    await tx.auditLog.create({ data: { tenantId, userId: actorId, action: 'deal.engagement_changed', entityType: 'Deal', entityId: dealId,
      changeset: { before: { engagementStatus: deal.engagementStatus }, after: { engagementStatus: status } } } });
    await fireDealUpdated({ tenantId, actorId, eventId: activity.id, record: updated,
      changedFields: ['engagementStatus'], changes: { before: { engagementStatus: deal.engagementStatus }, after: { engagementStatus: status } } });
  }
  return updated;
}
