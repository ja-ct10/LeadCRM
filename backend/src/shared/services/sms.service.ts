import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { appendSmsFooter, isValidPhMobile, toE164, SMS_MAX_LENGTH, SMS_ORGANIZATION_EMAIL_REQUIRED } from '@leadcrm/shared';
import { ValidationError } from '../errors/http-error';
import prisma from '../../config/database.config';
import { tenantContext } from '../../core/tenant/tenant-context';

export function isSmsConfigured(): boolean {
  return !!process.env.UNISMS_API_SECRET_KEY?.trim() && !!process.env.UNISMS_SENDER_ID?.trim();
}
export function assertSmsConfigured() {
  if (!isSmsConfigured()) throw new ValidationError('Configure the UniSMS API secret and registered Sender ID before sending SMS.');
}
export function normalizeSmsPhone(value: unknown): string {
  let number = typeof value === 'string' ? value.trim().replace(/[\s().-]/g, '') : '';
  const local = number.startsWith('0') ? number.slice(1) : number;
  if (isValidPhMobile(local)) number = toE164(local);
  if (!/^\+[1-9]\d{7,14}$/.test(number) || (number.startsWith('+63') && !isValidPhMobile(number.slice(3)))) {
    throw new ValidationError('A valid phone number with country code is required for SMS (for example, +639171234567).');
  }
  return number;
}
export async function getSmsOrganizationEmail(tenantId: string, db: Prisma.TransactionClient = prisma): Promise<string> {
  if (tenantContext.getStore()?.tenantId !== tenantId) throw new ValidationError('CRM tenant context is required for SMS.');
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { email: true } });
  const parsed = z.string().trim().email().safeParse(tenant?.email);
  if (!parsed.success) throw new ValidationError(SMS_ORGANIZATION_EMAIL_REQUIRED);
  return parsed.data;
}
export class SmsSubmissionError extends ValidationError {
  constructor(readonly outcome: 'rejected' | 'unconfirmed', readonly httpStatus?: number) {
    super(outcome === 'rejected' ? `SMS provider rejected the message${httpStatus ? ` (HTTP ${httpStatus})` : ''}. Check the UniSMS secret, registered Sender ID and SMS balance.` : 'SMS submission could not be confirmed. Review the provider history before sending again.');
  }
}
const receiptSchema = z.object({ message: z.object({ reference_id: z.string().min(1).max(500), status: z.enum(['pending', 'retrying', 'sent', 'failed']) }) });
export interface SmsOptions { metadata?: { campaign_id: string; campaign_recipient_id: string }; organizationEmail?: string }
/** Every caller, including Workflows, gets the persisted organization footer. A
 * campaign passes the server-read email snapshot used by its complete preflight. */
export async function sendSms(recipient: string, content: string, options: SmsOptions = {}): Promise<{ submitted: true; messageId: string; status: 'pending' | 'retrying' | 'sent' | 'failed' }> {
  assertSmsConfigured();
  const phone = normalizeSmsPhone(recipient);
  const tenantId = tenantContext.getStore()?.tenantId;
  if (!tenantId) throw new ValidationError('CRM tenant context is required for SMS.');
  const email = options.organizationEmail ?? await getSmsOrganizationEmail(tenantId);
  if (!content.trim()) throw new ValidationError('SMS message content is required.');
  const finalContent = appendSmsFooter(content, email);
  if (finalContent.length > SMS_MAX_LENGTH) throw new ValidationError(`SMS exceeds the ${SMS_MAX_LENGTH}-character limit including the contact footer.`);
  let response: Response;
  try {
    response = await fetch('https://unismsapi.com/api/sms', { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${Buffer.from(process.env.UNISMS_API_SECRET_KEY!.trim() + ':').toString('base64')}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ recipient: phone, content: finalContent, sender_id: process.env.UNISMS_SENDER_ID!.trim(), ...(options.metadata ? { metadata: options.metadata } : {}) }),
    });
  } catch { throw new SmsSubmissionError('unconfirmed'); }
  if (!response.ok) throw new SmsSubmissionError(response.status >= 500 ? 'unconfirmed' : 'rejected', response.status);
  const receipt = receiptSchema.safeParse(await response.json().catch(() => null));
  if (!receipt.success) throw new SmsSubmissionError('unconfirmed');
  return { submitted: true, messageId: receipt.data.message.reference_id, status: receipt.data.message.status };
}
