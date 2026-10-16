import type { Campaign, Prisma } from '@prisma/client';
import type { SmsCampaignSummary } from '@leadcrm/shared';

type Evidence = { status: string; failureReason: string | null; sentAt: Date | null; deliveredAt: Date | null; submittedAt: Date | null };
type DeliveryEvidence = Pick<Evidence, 'status' | 'sentAt' | 'deliveredAt'>;
export const smsDelivered = (row: DeliveryEvidence) => row.status === 'delivered' || !!row.deliveredAt;
export const smsSent = (row: DeliveryEvidence) => row.status === 'sent' || smsDelivered(row) || !!row.sentAt;
export function smsCampaignSummary(rows: Evidence[]): SmsCampaignSummary {
  const result: SmsCampaignSummary = { total: 0, pending: 0, submitting: 0, submitted: 0, sent: 0, delivered: 0, failed: 0, unconfirmed: 0 };
  for (const row of rows) {
    if (row.status === 'excluded') continue;
    result.total++;
    if (row.status === 'failed') result.failed++;
    else if (smsDelivered(row)) result.delivered++;
    else if (smsSent(row)) result.sent++;
    else if (row.status === 'unknown' || ['PROVIDER_SUBMISSION_UNCONFIRMED', 'TEXTBEE_UNKNOWN_STATE'].includes(row.failureReason ?? '')) result.unconfirmed++;
    else if (row.submittedAt) result.submitted++;
    else if (row.status === 'submitting') result.submitting++;
    else result.pending++;
  }
  return result;
}

/** The caller holds the campaign lock. Events and their immutable count snapshots
 * commit with the evidence; delivery uses the existing deletion-safe ledger. */
export async function enqueueSmsCampaignOutcomes(tx: Prisma.TransactionClient, campaign: Campaign, rows: Evidence[]) {
  if (campaign.type !== 'SMS' || !campaign.submissionStartedAt) return;
  const counts = smsCampaignSummary(rows);
  if (!counts.total || counts.total !== campaign.recipientCount) return;
  const outcomes: string[] = [];
  if (campaign.status === 'DELIVERED') outcomes.push('delivered');
  else if (campaign.status === 'SENT' && counts.sent + counts.delivered === counts.total) outcomes.push('sent');
  else if (campaign.status === 'FAILED') outcomes.push('failed');
  else if (campaign.status === 'PARTIALLY_SENT' && counts.sent + counts.delivered + counts.failed === counts.total) outcomes.push('partial');
  else if (counts.failed) outcomes.push('progress');
  if (counts.unconfirmed) outcomes.push('unconfirmed');
  for (const outcome of outcomes) {
    const eventKey = `sms-campaign:${campaign.id}:v${campaign.notificationRunVersion}:${outcome}`;
    if (await tx.notificationEvent.findUnique({ where: { tenantId_eventKey: { tenantId: campaign.tenantId, eventKey } }, select: { id: true } })) continue;
    const version = await tx.campaign.update({ where: { id: campaign.id, tenantId: campaign.tenantId }, data: { smsTransitionVersion: { increment: 1 } }, select: { smsTransitionVersion: true } });
    await tx.notificationEvent.create({ data: {
      tenantId: campaign.tenantId, eventKey, type: `sms_campaign_${outcome}`, entityType: 'Campaign', entityId: campaign.id,
      ownerId: campaign.createdById, actorId: campaign.submittedById,
      admins: ['failed', 'partial', 'progress', 'unconfirmed'].includes(outcome),
      payload: { name: campaign.name, counts: { ...counts }, sequence: version.smsTransitionVersion },
    } });
  }
}
