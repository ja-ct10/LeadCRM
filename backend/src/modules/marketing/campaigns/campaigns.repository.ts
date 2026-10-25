import { creatorWhere } from '../../crm/access/record-visibility';
import prisma from '../../../config/database.config';

export async function findCampaignReport(id: string, tenantId: string) {
  return prisma.$transaction(async tx => tx.campaign.findFirst({
    where: { id, ...await creatorWhere(tenantId, tx) },
    include: {
      targetAudience: { select: { name: true } },
      campaignContacts: { where: { tenantId }, orderBy: { id: 'asc' }, include: {
        lead: { select: { tenantId: true, firstName: true, lastName: true } },
        contact: { select: { tenantId: true, firstName: true, lastName: true } },
        smsWebhookReceipts: { where: { tenantId, status: { not: null } }, orderBy: { createdAt: 'desc' }, take: 10, select: { status: true, eventAt: true, createdAt: true } },
      } },
      emailDeliveryLogs: { where: { tenantId }, select: {
        toEmail: true, brevoMessageId: true, EmailEvent: { where: { tenantId }, select: { eventType: true, url: true, createdAt: true, providerEventKey: true } },
      } },
    },
  }), { isolationLevel: 'RepeatableRead' });
}
