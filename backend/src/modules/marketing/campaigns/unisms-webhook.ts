import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { AppError } from '../../../shared/errors/app-error';

export const UniSmsEventSchema = z.object({
  event: z.enum(['message.sent', 'message.failed', 'message.retrying']),
  id: z.string().min(1).max(500),
  message: z.object({ reference_id: z.string().min(1).max(500), status: z.enum(['sent', 'failed', 'retrying']), recipient: z.string().regex(/^\+[1-9]\d{7,14}$/), fail_reason: z.string().max(2000).nullable().optional() }),
}).refine(e => e.id === e.message.reference_id && e.event === `message.${e.message.status}`, 'Inconsistent SMS event.');

export function verifyUniSmsAuthorization(header?: string) {
  const secret = process.env.UNISMS_WEBHOOK_SECRET_KEY?.trim();
  if (!secret) throw new AppError('SMS webhook is not configured.', 503);
  if (!timingSafeEqual(createHash('sha256').update(header || '').digest(), createHash('sha256').update(secret).digest())) throw new AppError('Unauthorized webhook.', 401);
}
export async function processUniSmsEvent(input: unknown) {
  const event = UniSmsEventSchema.parse(input);
  const recipient = await prisma.campaignContact.findUnique({ where: { messageId: event.message.reference_id }, include: { campaign: { select: { type: true } } } });
  // Like Brevo, return retryable 503 when the callback races receipt persistence.
  if (!recipient) throw new AppError('SMS delivery record is not available.', 503);
  if (recipient.campaign.type !== 'SMS' || recipient.phone !== event.message.recipient) throw new AppError('SMS delivery record does not match.', 400);
  return tenantContext.run({ tenantId: recipient.tenantId }, () => prisma.$transaction(async tx => {
    const where = { tenantId: recipient.tenantId, campaignId: recipient.campaignId };
    // Same campaign-first lock order as sending and the existing email webhook.
    const campaign = await tx.campaign.update({ where: { id: recipient.campaignId, tenantId: recipient.tenantId }, data: { engagement: { increment: 0 } } });
    const status = event.message.status;
    const changed = await tx.campaignContact.updateMany({ where: { ...where, id: recipient.id,
      status: { in: status === 'sent' ? ['submitted', 'retrying', 'failed'] : ['submitted', 'retrying'].filter(s => s !== status) } },
      data: { status, providerUpdatedAt: new Date(), ...(status === 'sent' ? { sentAt: new Date() } : {}),
        // Provider text is not necessary for diagnosis and may echo message content.
        failureReason: status === 'failed' ? 'UNISMS_FAILED' : null } });
    if (!changed.count) return;
    const [submitted, failed, pending] = await Promise.all([
      tx.campaignContact.count({ where: { ...where, submittedAt: { not: null } } }),
      tx.campaignContact.count({ where: { ...where, status: 'failed' } }),
      tx.campaignContact.count({ where: { ...where, status: 'pending' } }),
    ]);
    await tx.campaign.update({ where: { id: recipient.campaignId, tenantId: recipient.tenantId }, data: {
      sentCount: submitted, failedCount: failed,
      ...(campaign.status === 'SENDING' ? {} : { status: pending ? 'PAUSED' : failed === campaign.recipientCount ? 'FAILED' : failed ? 'PARTIALLY_SENT' : 'SENT' }),
    } });
    await tx.campaignMetrics.create({ data: { ...where, sentCount: submitted } });
  }));
}
export const unismsWebhookRouter = Router();
unismsWebhookRouter.post('/', rateLimit({ windowMs: 60000, limit: 1000, standardHeaders: true, legacyHeaders: false }), async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' && !req.secure) throw new AppError('HTTPS is required.', 400);
    verifyUniSmsAuthorization(req.get('webhook-secret-key'));
    await processUniSmsEvent(req.body);
    res.json({ success: true });
  } catch (error) { next(error); }
});
