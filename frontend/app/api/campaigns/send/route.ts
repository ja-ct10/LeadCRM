import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GmailService } from '@/src/lib/email/gmail';
import { LocalSmsGateway } from '@/src/lib/sms/local-gateway';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-id';
    const body = await req.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId, tenantId },
      include: {
        campaignContacts: {
          include: { lead: true }
        },
        emailTemplate: true,
        smsTemplate: true,
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Campaign already completed' }, { status: 400 });
    }

    // Update status to processing
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' }
    });

    try {
      if (campaign.type === 'EMAIL' || campaign.type === 'MULTI_CHANNEL') {
        const emailTpl = campaign.emailTemplate as { content?: string; subject?: string } | null;
        const content = emailTpl?.content || (campaign as any).body || '';
        const subject = emailTpl?.subject || (campaign as any).subject || '';

        if (content && subject) {
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
              content,
              campaign.id
            );
          }
        }
      }

      if (campaign.type === 'SMS' || campaign.type === 'MULTI_CHANNEL') {
        const smsTpl = campaign.smsTemplate as { content?: string } | null;
        const content = smsTpl?.content || (campaign as any).body || '';

        if (content) {
          const contacts = (campaign.campaignContacts as any[])
            .map((cc: any) => cc.lead)
            .filter(Boolean);

          const recipients = contacts
            .map((c: any) => ({ to: c.phone as string, contactId: c.id }))
            .filter((r: any) => !!r.to);

          if (recipients.length > 0) {
            await LocalSmsGateway.sendBulkSMS(
              recipients,
              content,
              campaign.tenantId,
              campaign.id
            );
          }
        }
      }

      // Mark completed
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          sentAt: new Date()
        }
      });

      return NextResponse.json({ success: true, message: 'Campaign sent successfully' });
    } catch (sendError: any) {
      console.error('Send error:', sendError);
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED' }
      });
      throw sendError;
    }
  } catch (error: any) {
    console.error('Failed to send campaign:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
