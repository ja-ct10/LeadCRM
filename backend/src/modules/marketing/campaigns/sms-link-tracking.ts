import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { campaignLinkDestination, SMS_LINK_TOKEN_PATTERN } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { AppError } from '../../../shared/errors/app-error';

export interface SmsLinkHistory {
  id: string;
  url: string;
  clickedAt: Date | null;
  lastClickedAt: Date | null;
  clickCount: number;
}

function historyDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  // PostgreSQL timestamp(3) JSON has no zone; the preserved values are UTC.
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? value + 'Z' : value;
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** The retirement migration freezes these receipts; new SMS never creates them. */
export function readSmsLinkHistory(value: unknown): SmsLinkHistory[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const link = entry as Record<string, unknown>;
    if (typeof link.id !== 'string' || !SMS_LINK_TOKEN_PATTERN.test(link.id)
      || typeof link.url !== 'string' || !campaignLinkDestination(link.url)
      || typeof link.clickCount !== 'number' || !Number.isSafeInteger(link.clickCount) || link.clickCount < 0) return [];
    return [{ id: link.id, url: link.url, clickedAt: historyDate(link.clickedAt), lastClickedAt: historyDate(link.lastClickedAt), clickCount: link.clickCount }];
  });
}

export async function visitSmsLink(token: string): Promise<string> {
  if (!SMS_LINK_TOKEN_PATTERN.test(token)) throw new AppError('SMS link not found.', 404);
  // Public discovery uses indexed JSON containment on immutable receipts. Fail
  // closed if corrupted history ever assigns one opaque token to two recipients.
  const matches = await prisma.campaignContact.findMany({
    where: { smsLinkHistory: { array_contains: [{ id: token }] } },
    select: { smsLinkHistory: true }, take: 2,
  });
  if (matches.length !== 1) throw new AppError('SMS link not found.', 404);
  const links = readSmsLinkHistory(matches[0].smsLinkHistory).filter(link => link.id === token);
  if (links.length !== 1) throw new AppError('SMS link not found.', 404);
  return links[0].url;
}

export const smsLinkRouter = Router();
smsLinkRouter.all('/:token', rateLimit({ windowMs: 60000, limit: 300, standardHeaders: true, legacyHeaders: false }), async (req, res, next) => {
  res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.set('Allow', 'GET, HEAD').status(405).end(); return; }
    res.redirect(302, await visitSmsLink(String(req.params.token)));
  } catch (error) { next(error); }
});
