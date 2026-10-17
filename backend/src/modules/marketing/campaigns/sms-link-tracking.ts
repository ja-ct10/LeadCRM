import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { campaignLinkDestination, mapCampaignTextLinks, smsCampaignTrackingUrl, SMS_LINK_TOKEN_PATTERN } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { AppError } from '../../../shared/errors/app-error';
import { recalculateCampaignDelivery } from './campaign-delivery-status';

export function smsTrackingOrigin(): string {
  try {
    const value = process.env.APP_URL?.trim() || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '');
    const url = new URL(smsCampaignTrackingUrl(value, 'x'.repeat(24)));
    if (process.env.NODE_ENV === 'production' && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error();
    return url.origin;
  } catch { throw new AppError('Configure APP_URL as the public website origin before sending SMS links.', 503); }
}

export function prepareSmsLinks(text: string, origin?: string) {
  const links = new Map<string, { id: string; url: string }>();
  const message = mapCampaignTextLinks(text, url => {
    const link = links.get(url) ?? { id: randomBytes(18).toString('base64url'), url };
    links.set(url, link);
    return smsCampaignTrackingUrl(origin ?? smsTrackingOrigin(), link.id);
  });
  return { message, links: [...links.values()] };
}

// Known preview/scanner requests must not be reported as recipient engagement.
// Unidentified automation cannot reliably be distinguished from a browser.
export function isSmsLinkPreview(method: string, headers: { userAgent?: string; purpose?: string; secPurpose?: string }) {
  return method !== 'GET' || /prefetch|preview/i.test(`${headers.purpose ?? ''} ${headers.secPurpose ?? ''}`)
    || /bot|crawler|spider|preview|facebookexternalhit|facebookcatalog|WhatsApp|SkypeUriPreview|Google-Safety|SafeLinks|Microsoft Office|curl\/|wget\//i.test(headers.userAgent ?? '');
}

export async function visitSmsLink(token: string, recordClick: boolean): Promise<string> {
  if (!SMS_LINK_TOKEN_PATTERN.test(token)) throw new AppError('SMS link not found.', 404);
  // Public discovery resolves one opaque token; all subsequent reads/writes enter its tenant.
  const link = await prisma.smsCampaignLink.findUnique({ where: { id: token }, select: { tenantId: true, campaignContactId: true, url: true, campaignContact: { select: { campaignId: true } } } });
  if (!link || !campaignLinkDestination(link.url)) throw new AppError('SMS link not found.', 404);
  if (!recordClick) return link.url;
  await tenantContext.run({ tenantId: link.tenantId }, () => prisma.$transaction(async tx => {
    const campaign = await tx.campaign.update({ where: { id: link.campaignContact.campaignId, tenantId: link.tenantId }, data: { engagement: { increment: 0 } } });
    const row = await tx.campaignContact.findUniqueOrThrow({ where: { id: link.campaignContactId, tenantId: link.tenantId } });
    if (campaign.type !== 'SMS' || campaign.smsTrackingVersion !== 1 || campaign.isArchived || !campaign.submissionStartedAt || !row.submissionAttemptedAt || row.status === 'excluded'
      || (!row.submittedAt && !['submitting', 'sent', 'delivered', 'unknown'].includes(row.status) && row.failureReason !== 'PROVIDER_SUBMISSION_UNCONFIRMED')) return;
    const now = new Date();
    const current = await tx.smsCampaignLink.findUniqueOrThrow({ where: { id: token, tenantId: link.tenantId } });
    await tx.smsCampaignLink.update({ where: { id: token, tenantId: link.tenantId }, data: { clickedAt: current.clickedAt ?? now, lastClickedAt: now, clickCount: { increment: 1 } } });
    if (!row.clickedAt) {
      await tx.campaignContact.update({ where: { id: row.id, tenantId: link.tenantId }, data: { clickedAt: now } });
      await recalculateCampaignDelivery(tx, campaign.id, link.tenantId, true);
    }
  }));
  return link.url;
}

export const smsLinkRouter = Router();
smsLinkRouter.all('/:token', rateLimit({ windowMs: 60000, limit: 300, standardHeaders: true, legacyHeaders: false }), async (req, res, next) => {
  res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.set('Allow', 'GET, HEAD').status(405).end(); return; }
    const preview = isSmsLinkPreview(req.method, { userAgent: req.get('User-Agent'), purpose: req.get('Purpose'), secPurpose: req.get('Sec-Purpose') });
    res.redirect(302, await visitSmsLink(String(req.params.token), !preview));
  } catch (error) { next(error); }
});
