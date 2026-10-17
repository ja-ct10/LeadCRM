import prisma from '../../../config/database.config';
import { campaignScope } from './audiences.service';

export async function findCampaignReport(id: string, tenantId: string) {
  return prisma.$transaction(tx => tx.campaign.findFirst({
    where: { id, ...campaignScope(tenantId) },
    include: {
      targetAudience: { select: { name: true } },
      campaignContacts: { where: { tenantId }, orderBy: { id: 'asc' }, include: {
        lead: { select: { tenantId: true, firstName: true, lastName: true } },
        contact: { select: { tenantId: true, firstName: true, lastName: true } },
        smsLinks: { where: { tenantId }, select: { url: true, clickedAt: true, lastClickedAt: true, clickCount: true } },
        smsWebhookReceipts: { where: { tenantId, status: { not: null } }, orderBy: { createdAt: 'desc' }, take: 10, select: { status: true, eventAt: true, createdAt: true } },
      } },
      emailDeliveryLogs: { where: { tenantId }, select: {
        toEmail: true, brevoMessageId: true, EmailEvent: { where: { tenantId }, select: { eventType: true, url: true, createdAt: true, providerEventKey: true } },
      } },
    },
  }), { isolationLevel: 'RepeatableRead' });
}
