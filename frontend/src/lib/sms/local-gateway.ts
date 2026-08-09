import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class LocalSmsGateway {
  /**
   * Queue a single SMS message
   */
  static async sendSMS(to: string, message: string, tenantId: string, campaignId?: string, contactId?: string) {
    const formattedNumber = this.formatNumber(to);
    
    if (!formattedNumber) {
      throw new Error(`Invalid phone number format: ${to}`);
    }

    const queuedSms = await prisma.sMSQueue.create({
      data: {
        tenantId,
        campaignId,
        leadId: contactId,
        toNumber: formattedNumber,
        message,
        status: 'pending',
      },
    });

    return queuedSms;
  }

  /**
   * Queue bulk SMS messages
   */
  static async sendBulkSMS(
    recipients: { to: string; contactId?: string }[],
    message: string,
    tenantId: string,
    campaignId?: string
  ) {
    const validRecipients = recipients
      .map(r => ({ ...r, to: this.formatNumber(r.to) }))
      .filter(r => r.to !== null);

    if (validRecipients.length === 0) {
      throw new Error('No valid recipients found');
    }

    const created = await prisma.sMSQueue.createMany({
      data: validRecipients.map(r => ({
        tenantId,
        campaignId,
        leadId: r.contactId,
        toNumber: r.to as string,
        message,
        status: 'pending',
      })),
    });

    return { queued: created.count };
  }

  /**
   * Format Philippine numbers to +639XXXXXXXXX
   */
  static formatNumber(phone: string): string | null {
    let clean = phone.replace(/[^0-9+]/g, '');
    
    // Handle 09XXXXXXXXX
    if (clean.startsWith('09') && clean.length === 11) {
      return '+63' + clean.substring(1);
    }
    
    // Handle 9XXXXXXXXX
    if (clean.startsWith('9') && clean.length === 10) {
      return '+63' + clean;
    }
    
    // Handle +639XXXXXXXXX
    if (clean.startsWith('+639') && clean.length === 13) {
      return clean;
    }
    
    // Handle 639XXXXXXXXX
    if (clean.startsWith('639') && clean.length === 12) {
      return '+' + clean;
    }

    return null; // Invalid format
  }

  /**
   * Fetch the next batch of pending messages for the Android Gateway
   * This endpoint is meant to be polled by the Android device
   */
  static async getPendingMessages(limit: number = 10) {
    // Get pending messages, mark them as processing
    const pending = await prisma.$transaction(async (tx) => {
      const messages = await tx.sMSQueue.findMany({
        where: { status: 'pending' },
        take: limit,
        orderBy: { createdAt: 'asc' }
      });

      if (messages.length > 0) {
        await tx.sMSQueue.updateMany({
          where: { id: { in: messages.map(m => m.id) } },
          data: { status: 'processing' }
        });
      }

      return messages;
    });

    return pending;
  }

  /**
   * Update message status from the Android Gateway
   */
  static async updateStatus(id: string, status: 'sent' | 'delivered' | 'failed', errorMessage?: string) {
    const updated = await prisma.sMSQueue.update({
      where: { id },
      data: {
        status,
        sentAt: status === 'sent' || status === 'delivered' ? new Date() : undefined,
        errorMessage,
      }
    });
    return updated;
  }
}
