import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export class GmailService {
  /**
   * Send a single email using a specific tenant's connected Gmail account
   */
  static async sendEmail(
    tenantId: string,
    to: string,
    subject: string,
    html: string,
    text?: string,
    campaignId?: string,
    contactId?: string
  ) {
    // 1. Get the connected EmailAccount for this tenant
    const emailAccount = await prisma.emailAccount.findFirst({
      where: { tenantId, isActive: true, provider: 'gmail' }
    });

    if (!emailAccount) {
      throw new Error(`No active Gmail account connected for tenant: ${tenantId}`);
    }

    // 2. Set credentials
    oauth2Client.setCredentials({
      access_token: emailAccount.accessToken,
      refresh_token: emailAccount.refreshToken,
      expiry_date: emailAccount.tokenExpiresAt ? emailAccount.tokenExpiresAt.getTime() : undefined,
    });

    // Handle token refresh internally via googleapis if refresh token exists
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        await prisma.emailAccount.update({
          where: { id: emailAccount.id },
          data: {
            accessToken: tokens.access_token || undefined,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined
          }
        });
      }
    });

    // 3. Create the Raw message string using Nodemailer
    const transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'windows'
    });

    const mailOptions = {
      from: emailAccount.email,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''), // fallback
    };

    const mail = await transporter.sendMail(mailOptions);
    const rawMessage = await new Promise<string>((resolve) => {
      let result = '';
      const stream = mail.message as any;
      stream.on('data', (data: any) => { result += data; });
      stream.on('end', () => resolve(result));
    });

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 4. Send using Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    try {
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      // 5. Log delivery
      await prisma.emailDeliveryLog.create({
        data: {
          tenantId,
          campaignId,
          leadId: contactId,
          fromEmail: emailAccount.email,
          toEmail: to,
          subject,
          gmailMessageId: res.data.id,
          gmailThreadId: res.data.threadId,
          status: 'sent',
          sentAt: new Date(),
        }
      });

      return { success: true, messageId: res.data.id };
    } catch (error: any) {
      await prisma.emailDeliveryLog.create({
        data: {
          tenantId,
          campaignId,
          leadId: contactId,
          fromEmail: emailAccount.email,
          toEmail: to,
          subject,
          status: 'failed',
          errorMessage: error.message,
        }
      });
      throw error;
    }
  }

  /**
   * Batch sending (simulated in batches of 50 to respect rate limits)
   */
  static async sendBulkEmail(
    tenantId: string,
    recipients: { to: string; contactId?: string }[],
    subject: string,
    html: string,
    campaignId?: string
  ) {
    const BATCH_SIZE = 50;
    const results = { successful: 0, failed: 0 };

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (recipient) => {
        try {
          await this.sendEmail(tenantId, recipient.to, subject, html, undefined, campaignId, recipient.contactId);
          results.successful++;
        } catch (err) {
          results.failed++;
        }
      }));

      // Small delay between batches to respect Gmail limits (1 sec)
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}
