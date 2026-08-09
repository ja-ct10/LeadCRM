import { PrismaClient } from '@prisma/client';
import { GmailService } from '../email/gmail';
import { LocalSmsGateway } from '../sms/local-gateway';

const prisma = new PrismaClient();

export class JobProcessor {
  private static isRunning = false;
  private static pollInterval: NodeJS.Timeout | null = null;

  static start(intervalMs: number = 60000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[JobProcessor] Started background job processor');
    this.processScheduledCampaigns().catch(console.error);
    this.pollInterval = setInterval(async () => {
      try {
        await this.processScheduledCampaigns();
      } catch (error) {
        console.error('[JobProcessor] Error processing scheduled campaigns:', error);
      }
    }, intervalMs);
  }

  static stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log('[JobProcessor] Stopped background job processor');
  }

  static async processScheduledCampaigns() {
    const dueCampaigns = await prisma.campaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: { lte: new Date() },
        isArchived: false,
      },
      include: {
        campaignContacts: {
          include: { lead: true }
        },
        emailTemplate: true,
        smsTemplate: true,
      }
    });

    if (dueCampaigns.length === 0) return;

    console.log(`[JobProcessor] Found ${dueCampaigns.length} due campaigns`);

    for (const campaign of dueCampaigns) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'ACTIVE' }
      });

      try {
        if (campaign.type === 'EMAIL' || campaign.type === 'MULTI_CHANNEL') {
          const emailTpl = campaign.emailTemplate as { content?: string; subject?: string } | null;
          const body = emailTpl?.content || (campaign as any).body || '';
          const subject = emailTpl?.subject || (campaign as any).subject || '';

          if (body && subject) {
            const contacts = (campaign.campaignContacts as any[])
              .map((cc: any) => cc.lead)
              .filter(Boolean);

            const recipients = contacts
              .map((c: any) => ({ to: c.email as string, contactId: c.id }))
              .filter((r: any) => !!r.to);

            if (recipients.length > 0) {
              await GmailService.sendBulkEmail(
                campaign.tenantId,
                recipients,
                subject,
                body,
                campaign.id
              );
            }
          }
        }

        if (campaign.type === 'SMS' || campaign.type === 'MULTI_CHANNEL') {
          const smsTpl = campaign.smsTemplate as { content?: string } | null;
          const body = smsTpl?.content || (campaign as any).body || '';

          if (body) {
            const contacts = (campaign.campaignContacts as any[])
              .map((cc: any) => cc.lead)
              .filter(Boolean);

            const recipients = contacts
              .map((c: any) => ({ to: c.phone as string, contactId: c.id }))
              .filter((r: any) => !!r.to);

            if (recipients.length > 0) {
              await LocalSmsGateway.sendBulkSMS(
                recipients,
                body,
                campaign.tenantId,
                campaign.id
              );
            }
          }
        }

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'COMPLETED',
            sentAt: new Date()
          }
        });

      } catch (error) {
        console.error(`[JobProcessor] Failed to execute campaign ${campaign.id}:`, error);
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'PAUSED' }
        });
      }
    }
  }
}
