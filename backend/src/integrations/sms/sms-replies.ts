import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hasModulePermission } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { tenantContext } from '../../core/tenant/tenant-context';
import { salesTransaction } from '../../modules/crm/leads/lead-automation.service';
import { classifyCustomerRecord } from '../../modules/crm/customer-classification.service';
import type { CustomerLink } from '../../modules/crm/engagement.service';
import { resolveCrmActor } from '../../modules/crm/access/crm-record-access.service';
import { AppError } from '../../shared/errors/app-error';
import { normalizeSmsPhone } from '../../shared/services/sms.service';

const routeSchema = z.array(z.object({ deviceId: z.string().regex(/^[a-f\d]{24}$/i), tenantId: z.string().uuid(), userId: z.string().uuid() }).strict())
  .refine(rows => new Set(rows.map(row => row.deviceId)).size === rows.length, 'Each receiving device must identify exactly one workspace.');
export function smsReceiverRoutes() {
  try { return routeSchema.parse(JSON.parse(process.env.TEXTBEE_RECEIVER_ROUTES || '[]')); }
  catch { throw new AppError('Invalid SMS receiver routing configuration.', 503); }
}
export const SmsReplySchema = z.object({ webhookEvent: z.literal('MESSAGE_RECEIVED'), smsId: z.string().min(1).max(500),
  deviceId: z.string().regex(/^[a-f\d]{24}$/i), sender: z.string().min(1).max(100),
  message: z.string().max(10000), receivedAt: z.string().datetime({ offset: true }), automated: z.boolean().optional(),
});
export function isCustomerSmsReply(event: z.infer<typeof SmsReplySchema>) {
  return !event.automated && !!event.message.trim() && !/^(?:stop|stopall|unsubscribe|cancel|end|quit|start|help|info)$/i.test(event.message.trim())
    && !/\b(?:verification code|one.time password|automated message|do not reply)\b/i.test(event.message);
}

/** Never infer workspace identity from a phone number or an incoming tenantId. */
export async function processSmsReply(input: unknown, now = new Date(), retryReview = false) {
  const event = SmsReplySchema.parse(input);
  const route = smsReceiverRoutes().find(row => row.deviceId === event.deviceId);
  let sender: string;
  try { sender = normalizeSmsPhone(event.sender); } catch { sender = event.sender; }
  const receivedAt = new Date(event.receivedAt);
  // A previously unknown device may become attributable after trusted routing is repaired.
  if (route) {
    const attributed = await tenantContext.exit(async () => await prisma.smsInboundReceipt.updateMany({
      where: { deviceId: event.deviceId, smsId: event.smsId, tenantId: null, status: 'review' }, data: { tenantId: route.tenantId },
    }));
    if (attributed.count) retryReview = true;
  }
  const work = async () => salesTransaction(async tx => {
    const key = { deviceId: event.deviceId, smsId: event.smsId };
    const inserted = await tx.smsInboundReceipt.createMany({ data: [{ id: randomUUID(), ...key, tenantId: route?.tenantId, sender, receivedAt, message: event.message }], skipDuplicates: true });
    if (!inserted.count && !retryReview) return;
    const claimed = await tx.smsInboundReceipt.updateMany({ where: { ...key, status: 'review', ...(retryReview ? { tenantId: route?.tenantId } : {}) }, data: { status: 'processing' } });
    if (!claimed.count) return;
    const review = async (reason: string, status = 'review') => { await tx.smsInboundReceipt.update({ where: { deviceId_smsId: key }, data: { status, reason } }); };
    if (!route) return review('Receiving device is not mapped to one workspace.');
    if (+receivedAt > +now) return review('Provider timestamp is in the future.');
    if (!/^\+[1-9]\d{7,14}$/.test(sender) || !isCustomerSmsReply(event)) return review('Non-customer sender or automated/control message.', 'ignored');
    let policy;
    try { policy = await resolveCrmActor(tx, { tenantId: route.tenantId, userId: route.userId }); }
    catch { return review('Receiving integration owner is unavailable.'); }
    const [leads, contacts] = await Promise.all([
      tx.lead.findMany({ where: { tenantId: route.tenantId, isArchived: false, deletedAt: null, convertedAt: null, phone: { not: null } }, select: { id: true, phone: true, assignedUserId: true } }),
      tx.contact.findMany({ where: { tenantId: route.tenantId, isArchived: false, deletedAt: null, phone: { not: null } }, select: { id: true, phone: true, assignedUserId: true } }),
    ]);
    const matches = (phone: string | null) => { try { return normalizeSmsPhone(phone) === sender; } catch { return false; } };
    const people = [...leads.filter(row => matches(row.phone)).map(row => ({ ...row, kind: 'lead' as const })), ...contacts.filter(row => matches(row.phone)).map(row => ({ ...row, kind: 'contact' as const }))];
    if (people.length !== 1) return review(people.length ? 'Multiple current CRM records share this phone. Resolve the duplicate before classification.' : 'No current CRM record matches the sender.');
    const person = people[0], module = person.kind === 'lead' ? 'leads' : 'contacts';
    if (!policy.clientAdmin && (!hasModulePermission(policy.permissions, module, 'canEdit') || policy.assignmentRestricted && person.assignedUserId !== route.userId)) return review('Receiving integration owner cannot edit this customer.');
    const link: CustomerLink = person.kind === 'lead' ? { leadId: person.id } : { contactId: person.id };
    const where = { tenantId: route.tenantId, id: person.id, OR: [{ lastCustomerReplyAt: null }, { lastCustomerReplyAt: { lt: receivedAt } }] };
    if (person.kind === 'lead') await tx.lead.updateMany({ where, data: { lastCustomerReplyAt: receivedAt, firstUnansweredOutboundAt: null, engagementEvaluatedAt: now } });
    else await tx.contact.updateMany({ where, data: { lastCustomerReplyAt: receivedAt, firstUnansweredOutboundAt: null, engagementEvaluatedAt: now } });
    await tx.activity.create({ data: { tenantId: route.tenantId, ...link, createdById: route.userId, type: 'sms', title: 'Customer SMS reply received',
      description: event.message, metadata: { source: 'textbee', direction: 'inbound', smsId: event.smsId, occurredAt: receivedAt.toISOString() } } });
    await classifyCustomerRecord(tx, route.tenantId, link, route.userId, { genuineReply: true }, now);
    await review('Verified customer reply processed.', 'processed');
  });
  return route ? tenantContext.run({ tenantId: route.tenantId }, work) : prisma.$transaction(async tx => {
    await tx.smsInboundReceipt.createMany({ data: [{ id: randomUUID(), deviceId: event.deviceId, smsId: event.smsId, sender, receivedAt, message: event.message, reason: 'Receiving device is not mapped to one workspace.' }], skipDuplicates: true });
  });
}

/** A bounded overlap finds late uploads; provider identity, rather than cursor arrival order, deduplicates them. */
export async function reconcileSmsReplies() {
  const routes = smsReceiverRoutes();
  if (!routes.length || !process.env.TEXTBEE_API_KEY?.trim()) return;
  for (const route of routes) await tenantContext.run({ tenantId: route.tenantId }, async () => {
    const key = { tenantId: route.tenantId, module: 'sms-replies', key: `history:${route.deviceId}` };
    const saved = await prisma.tenantPreference.findUnique({ where: { tenantId_module_key: key } });
    const parsed = z.object({ from: z.string().datetime(), cursor: z.string().optional() }).safeParse(saved?.value);
    const from = parsed.success ? parsed.data.from : new Date(Date.now() - 30 * 86400000).toISOString();
    let cursor = parsed.success ? parsed.data.cursor : undefined, more = false;
    for (let page = 0; page < 20; page++) {
      const query = new URLSearchParams({ direction: 'received', order: 'asc', limit: '100', from, deviceIds: route.deviceId, ...(cursor ? { cursor } : {}) });
      const response = await fetch(`https://api.textbee.dev/api/v1/gateway/messages?${query}`, { headers: { 'x-api-key': process.env.TEXTBEE_API_KEY!.trim() }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new AppError('SMS reply history could not be reconciled.', 503);
      const result = z.object({ data: z.array(z.object({ _id: z.string(), sender: z.string(), message: z.string(), receivedAt: z.string(), device: z.object({ _id: z.string() }) })), meta: z.object({ nextCursor: z.string().nullable().optional(), hasMore: z.boolean() }) }).parse(await response.json());
      for (const row of result.data) if (row.device._id === route.deviceId) await processSmsReply({ webhookEvent: 'MESSAGE_RECEIVED', smsId: row._id, deviceId: row.device._id, sender: row.sender, message: row.message, receivedAt: row.receivedAt });
      more = result.meta.hasMore && !!result.meta.nextCursor;
      cursor = result.meta.nextCursor ?? undefined;
      if (!more) break;
    }
    const value = more ? { from, cursor } : { from: new Date(Date.now() - 30 * 86400000).toISOString() };
    await prisma.tenantPreference.upsert({ where: { tenantId_module_key: key }, create: { ...key, value }, update: { value } });
  });

}

export function startSmsReplyScheduler() {
  let pending: Promise<void> | undefined, stopped = false;
  const tick = () => { if (!stopped && !pending) pending = reconcileSmsReplies().catch(() => console.error('[SMS replies] Reconciliation failed; receiving configuration or provider access requires review.')).finally(() => { pending = undefined; }); };
  const timer = setInterval(tick, 300000); timer.unref(); tick();
  return async () => { stopped = true; clearInterval(timer); await pending; };
}
