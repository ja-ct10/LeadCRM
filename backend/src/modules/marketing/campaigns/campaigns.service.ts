import { randomUUID } from 'node:crypto';
import { sortedPageIds, orderPage } from '../../../shared/helpers/sorted-page';
import { Prisma, CampaignStatus, CampaignType } from '@prisma/client';
import { z } from 'zod';
import { CreateCampaignDraftSchema, CampaignDraftSchema, CampaignSendSchema, buildFinalSms, SMS_MAX_LENGTH, type CampaignSendResult } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { AppError } from '../../../shared/errors/app-error';
import { getPaginationParams, paginate } from '../../../shared/helpers/pagination';
import { sendMail, assertBrevoConfigured, EmailSubmissionError } from '../../../shared/services/email.service';
import { sendSms, assertSmsConfigured, getSmsSenderEmail, SmsSubmissionError } from '../../../shared/services/sms.service';
import { audienceDefinition, campaignScope, resolveAudience } from './audiences.service';
import { sanitizeCampaignHtml, renderCampaignMessage } from './campaign-content';
import { findCampaignReport } from './campaigns.repository';
import { recalculateCampaignDelivery, recipientDeliveryFailed } from './campaign-delivery-status';
import type { CampaignRecipient, CampaignClickedLink } from '@leadcrm/shared';

export async function getCampaignReport(id: string, tenantId: string) {
  const report = await findCampaignReport(id, tenantId);
  if (!report) throw new AppError('Campaign not found.', 404);
  const { campaignContacts, emailDeliveryLogs, ...campaign } = report;
  const latestByEmail = new Map<string, number>();
  const confirmedSentIds = new Set(emailDeliveryLogs.filter(log => log.EmailEvent.some(event => event.eventType === 'request')).map(log => log.brevoMessageId));
  const links = new Map<string, { emails: Set<string>; total: number; last: number }>();
  for (const log of emailDeliveryLogs) {
    const email = log.toEmail.toLowerCase();
    for (const event of log.EmailEvent) {
      const time = event.createdAt.getTime();
      latestByEmail.set(email, Math.max(latestByEmail.get(email) ?? 0, time));
      if (event.eventType !== 'click' || !event.url) continue;
      try { if (!['http:', 'https:'].includes(new URL(event.url).protocol)) continue; } catch { continue; }
      const link = links.get(event.url) ?? { emails: new Set<string>(), total: 0, last: 0 };
      link.emails.add(email); link.total++; link.last = Math.max(link.last, time);
      links.set(event.url, link);
    }
  }
  const recipients: CampaignRecipient[] = campaignContacts.map(recipient => {
    const person = recipient.contact ?? recipient.lead;
    const snapshot = recipient.personalization as Record<string, unknown> | null;
    const name = person?.tenantId === tenantId ? `${person.firstName} ${person.lastName}`.trim()
      : [snapshot?.first_name, snapshot?.last_name].filter(value => typeof value === 'string').join(' ').trim();
    const last = Math.max(latestByEmail.get((recipient.email ?? '').toLowerCase()) ?? 0,
      ...[recipient.submittedAt, recipient.providerUpdatedAt, recipient.sentAt, recipient.deliveredAt, recipient.openedAt, recipient.clickedAt, recipient.bouncedAt].map(at => at?.getTime() ?? 0));
    return {
      id: recipient.id, name: name || recipient.email || recipient.phone || 'Unknown recipient', email: recipient.email, phone: recipient.phone,
      deliveryStatus: recipient.status === 'excluded' ? 'Excluded'
        : recipientDeliveryFailed(recipient) ? (campaign.type === 'EMAIL' && recipient.bouncedAt ? 'Bounced' : 'Failed')
        : recipient.deliveredAt ? 'Delivered'
        : campaign.type === 'SMS' && (recipient.status === 'unknown' || ['PROVIDER_SUBMISSION_UNCONFIRMED', 'TEXTBEE_UNKNOWN_STATE'].includes(recipient.failureReason ?? '')) ? 'Pending'
        : recipient.sentAt && (campaign.type !== 'EMAIL' || recipient.submittedAt || confirmedSentIds.has(recipient.messageId)) ? 'Sent'
        : recipient.submittedAt || (campaign.type === 'EMAIL' && recipient.sentAt) ? 'Submitted' : 'Pending',
      opened: campaign.type !== 'SMS' && !!recipient.openedAt, clicked: campaign.type !== 'SMS' && !!recipient.clickedAt,
      lastActivity: last ? new Date(last).toISOString() : null, failureReason: recipient.failureReason,
    };
  });
  const topLinks: CampaignClickedLink[] = [...links].map(([url, link]) => ({
    url, uniqueClicks: link.emails.size, totalClicks: link.total,
    clickRate: campaign.recipientCount ? link.emails.size / campaign.recipientCount * 100 : 0,
    lastClicked: new Date(link.last).toISOString(),
  })).sort((a, b) => b.uniqueClicks - a.uniqueClicks || b.totalClicks - a.totalClicks || a.url.localeCompare(b.url));
  return { ...campaign, recipients, topLinks, sendResult: campaignSendResult(campaign),
    deliveredCount: recipients.filter(row => row.deliveryStatus === 'Delivered').length,
    bouncedCount: recipients.filter(row => row.deliveryStatus === 'Bounced').length,
    openedCount: recipients.filter(row => row.opened).length, clickedCount: recipients.filter(row => row.clicked).length,
  };
}

export async function getCampaigns(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const where: Prisma.CampaignWhereInput = { ...campaignScope(tenantId), isArchived: query.archived === 'true',
    ...(query.status ? { status: { in: z.array(z.nativeEnum(CampaignStatus)).parse(String(query.status).split(',')) } } : {}),
    ...(query.type ? { type: { in: z.array(z.nativeEnum(CampaignType)).parse(String(query.type).split(',')) } } : {}),
    ...(query.search ? { OR: ['name', 'subject'].map(field => ({ [field]: { contains: String(query.search).slice(0, 150), mode: 'insensitive' as const } })) } : {}) };
  const ids = await sortedPageIds(query.sort === 'createdAt:desc' ? undefined : query.sort, ['name', 'type', 'status', 'createdAt'], (page - 1) * limit, limit,
    () => prisma.campaign.findMany({ where, select: { id: true, name: true, type: true, status: true, createdAt: true } }));
  const [data, total] = await Promise.all([
    prisma.campaign.findMany({ where: ids ? { ...where, id: { in: ids } } : where, skip: ids ? 0 : (page - 1) * limit, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { targetAudience: { select: { name: true } } } }),
    prisma.campaign.count({ where }),
  ]);
  return paginate(orderPage(data, ids), total, { page, limit });
}
export async function getCampaignById(id: string, tenantId: string) {
  const c = await prisma.campaign.findFirst({ where: { id, ...campaignScope(tenantId) } });
  if (!c) throw new AppError('Campaign not found.', 404);
  const where = { ...campaignScope(tenantId), campaignId: id };
  const [deliveredCount, bouncedCount] = await Promise.all([
    prisma.campaignContact.count({ where: { ...where, deliveredAt: { not: null } } }),
    prisma.campaignContact.count({ where: { ...where, bouncedAt: { not: null } } }),
  ]);
  return { ...c, deliveredCount, bouncedCount, sendResult: campaignSendResult(c) };
}
function campaignSendResult(campaign: { id: string; recipientCount: number; sentCount: number; failedCount: number; status: CampaignStatus; submissionFinishedAt: Date | null }): CampaignSendResult {
  return { campaignId: campaign.id, eligibleRecipients: campaign.recipientCount, submittedRecipients: campaign.sentCount, failedRecipients: campaign.failedCount, status: campaign.status, submissionComplete: !!campaign.submissionFinishedAt };
}
async function validateReferences(tenantId: string, dto: ReturnType<typeof CampaignDraftSchema.parse>) {
  if (dto.targetAudienceId) await audienceDefinition(tenantId, dto.targetAudienceId);
  for (const [id, type] of [[dto.emailTemplateId, 'Email'], [dto.smsTemplateId, 'SMS']] as const) {
    if (id && !await prisma.template.findFirst({ where: { ...campaignScope(tenantId), id, type, isArchived: false } })) throw new AppError('Template not found.', 404);
  }
  if (dto.targetAudienceId && dto.audienceSource) throw new AppError('Select a saved audience or a source, not both.', 400);
}
export async function createCampaign(tenantId: string, userId: string, input: unknown) {
  const dto = CreateCampaignDraftSchema.parse(input);
  await validateReferences(tenantId, dto);
  const campaign = await prisma.campaign.create({ data: { ...dto, body: dto.body === undefined ? undefined : dto.type === 'SMS' ? dto.body : sanitizeCampaignHtml(dto.body), ...campaignScope(tenantId), createdById: userId } });
  await writeAuditLog({ tenantId, userId, action: 'campaign.created', entityType: 'Campaign', entityId: campaign.id });
  return campaign;
}
export async function updateCampaign(id: string, tenantId: string, userId: string, input: unknown) {
  const dto = CampaignDraftSchema.partial().parse(input);
  const existing = await getCampaignById(id, tenantId);
  await validateReferences(tenantId, CampaignDraftSchema.parse({ name: existing.name, type: existing.type, audienceSource: existing.audienceSource, targetAudienceId: existing.targetAudienceId, emailTemplateId: existing.emailTemplateId, smsTemplateId: existing.smsTemplateId, ...dto }));
  const changed = await prisma.campaign.updateMany({ where: { id, ...campaignScope(tenantId), status: 'DRAFT', isArchived: false }, data: { ...dto, body: dto.body === undefined ? undefined : (dto.type ?? existing.type) === 'SMS' ? dto.body : sanitizeCampaignHtml(dto.body) } });
  if (!changed.count) throw new AppError('Only draft campaigns can be edited.', 409);
  await writeAuditLog({ tenantId, userId, action: 'campaign.updated', entityType: 'Campaign', entityId: id });
  return getCampaignById(id, tenantId);
}
export async function getCampaignMetrics(tenantId: string) {
  const where = { ...campaignScope(tenantId), isArchived: false };
  const [sum, active, email] = await Promise.all([
    prisma.campaign.aggregate({ where, _sum: { sentCount: true, openedCount: true, clickedCount: true } }),
    prisma.campaign.count({ where: { ...where, status: 'SENDING' } }),
    prisma.campaign.aggregate({ where: { ...where, type: 'EMAIL' }, _sum: { sentCount: true } }),
  ]);
  return { activeCampaigns: active, sent: sum._sum.sentCount || 0, emailSent: email._sum.sentCount || 0, opened: sum._sum.openedCount || 0, clicked: sum._sum.clickedCount || 0 };
}

async function prepareCampaign(id: string, tenantId: string) {
  const scope = campaignScope(tenantId);
  return prisma.$transaction(async tx => {
    // The row lock also serializes draft edits and simultaneous Send Now requests.
    const claim = await tx.campaign.updateMany({ where: { id, ...scope, status: 'DRAFT', submissionStartedAt: null, isArchived: false }, data: { status: 'SENDING', submissionStartedAt: new Date() } });
    if (!claim.count) {
      if (!await tx.campaign.findFirst({ where: { id, ...scope } })) throw new AppError('Campaign not found.', 404);
      throw new AppError('Campaign has already started or is not sendable.', 409);
    }
    const campaign = await tx.campaign.findFirstOrThrow({ where: { id, ...scope } });
    if (campaign.type === 'EMAIL') assertBrevoConfigured();
    else if (campaign.type === 'SMS') assertSmsConfigured();
    else throw new AppError('Send Now supports Email or SMS. Save Multi-Channel campaigns as drafts.', 400);
    const organizationEmail = campaign.type === 'SMS' ? await getSmsSenderEmail(tenantId, tx) : undefined;
    CampaignSendSchema.parse({ name: campaign.name, type: campaign.type, subject: campaign.subject || '', body: campaign.body || '', targetAudienceId: campaign.targetAudienceId, audienceSource: campaign.audienceSource });
    const definition = await audienceDefinition(tenantId, campaign.targetAudienceId, campaign.audienceSource, tx);
    const resolved = await resolveAudience(tenantId, definition, tx, campaign.type);
    const eligible = resolved.records.filter(r => !r.reason);
    if (!eligible.length) throw new AppError('No eligible recipients. Check audience exclusions.', 400);
    if (campaign.type === 'EMAIL') {
    const limit = Number(process.env.BREVO_DAILY_EMAIL_LIMIT || 300);
    if (!Number.isSafeInteger(limit) || limit < 1) throw new AppError('Campaign daily limit is not configured correctly.', 503);
    const day = new Date().toISOString().slice(0, 10);
    await tx.campaignEmailQuota.upsert({ where: { day }, create: { day }, update: {} });
    const reserved = await tx.campaignEmailQuota.updateMany({ where: { day, reserved: { lte: limit - eligible.length } }, data: { reserved: { increment: eligible.length } } });
    if (!reserved.count) throw new AppError(`This campaign has ${eligible.length} eligible recipients, exceeding the available campaign allowance under the configured ${limit}/day limit. Reduce the audience or try another day.`, 409);
    }
    const sender = { sender_name: campaign.type === 'SMS' ? 'Camxian Technologies' : process.env.BREVO_FROM_NAME || 'LeadCRM', sender_email: campaign.type === 'EMAIL' ? process.env.BREVO_FROM_EMAIL! : organizationEmail ?? '' };
    const sends = eligible.map(r => ({ ...r, id: randomUUID(), logId: randomUUID(), channel: campaign.type,
      ...(campaign.type === 'SMS' ? { subject: '', html: '', sms: buildFinalSms({ body: campaign.body!, variables: { ...r.personalization, ...sender } }) }
        : { ...renderCampaignMessage(campaign.subject!, campaign.body!, { ...r.personalization, ...sender }), sms: '' }) }));
    const tooLong = sends.filter(r => r.channel === 'SMS' && r.sms.length > SMS_MAX_LENGTH).length;
    if (tooLong) throw new AppError(`${tooLong} recipient message${tooLong === 1 ? '' : 's'} exceeds the ${SMS_MAX_LENGTH}-character SMS limit after personalization.`, 400);
    await tx.campaignContact.createMany({ data: [
      ...sends.map(r => ({ id: r.id, ...scope, campaignId: id, leadId: r.leadId, contactId: r.contactId, email: r.email, phone: r.phone, personalization: r.personalization, status: 'pending' })),
      ...resolved.records.filter(r => r.reason).map(r => ({ ...scope, campaignId: id, leadId: r.leadId, contactId: r.contactId, email: r.email, phone: r.phone, status: 'excluded', failureReason: r.reason })),
    ] });
    if (campaign.type === 'EMAIL') await tx.emailDeliveryLog.createMany({ data: sends.map(r => ({ id: r.logId, ...scope, campaignId: id, leadId: r.leadId, contactId: r.contactId, fromEmail: sender.sender_email, toEmail: r.email!, subject: r.subject, status: 'pending' })) });
    await tx.campaign.update({ where: { id, ...scope }, data: { recipientCount: eligible.length } });
    return sends;
  }, { timeout: 30000 });

}

async function deliverPrepared(id: string, tenantId: string, userId: string, prepared: Awaited<ReturnType<typeof prepareCampaign>>): Promise<CampaignSendResult> {
  const scope = campaignScope(tenantId);
  // No external HTTP inside a transaction. Keep at most five provider requests active.
  console.info('[Campaigns]', { event: 'submission_started', campaignId: id, tenantId, recipientCount: prepared.length });
  for (let offset = 0; offset < prepared.length; offset += 5) {
    const results = await Promise.allSettled(prepared.slice(offset, offset + 5).map(async recipient => {
      let result;
      try {
        result = recipient.channel === 'SMS'
          ? await sendSms(recipient.phone!, recipient.sms)
          : await sendMail({ to: recipient.email!, subject: recipient.subject, html: recipient.html, requireDelivery: true });
      } catch (error) {
        const rejected = (error instanceof EmailSubmissionError || error instanceof SmsSubmissionError) && error.outcome === 'rejected';
        const reason = rejected ? `${recipient.channel === 'SMS' ? 'TEXTBEE' : 'BREVO'}_HTTP_${error.httpStatus}` : 'PROVIDER_SUBMISSION_UNCONFIRMED';
        console.warn('[Campaigns]', { event: 'recipient_submission', campaignId: id, tenantId, recipientId: recipient.id, outcome: rejected ? 'rejected' : 'unconfirmed', httpStatus: error instanceof EmailSubmissionError ? error.httpStatus : undefined });
        // Unconfirmed requests may have been accepted: preserve them for review.
        await prisma.$transaction([
          prisma.campaignContact.update({ where: { id: recipient.id, ...scope }, data: { status: rejected ? 'failed' : 'pending', failureReason: reason } }),
          ...(recipient.channel === 'EMAIL' ? [prisma.emailDeliveryLog.update({ where: { id: recipient.logId, ...scope }, data: { status: rejected ? 'failed' : 'pending', errorMessage: reason } })] : []),
        ]);
        return;
      }
      const submitted = result.submitted;
      const now = new Date();
      console.info('[Campaigns]', { event: 'recipient_submission', campaignId: id, tenantId, recipientId: recipient.id, outcome: submitted ? 'accepted' : 'not_submitted', messageId: result.messageId });
      await prisma.$transaction([
        // Acquire the campaign lock first, matching webhook lock order.
        prisma.campaign.update({ where: { id, ...scope }, data: submitted ? { sentCount: { increment: 1 } } : { failedCount: { increment: 1 } } }),
        prisma.campaignContact.update({ where: { id: recipient.id, ...scope }, data: { status: submitted ? 'submitted' : 'failed', messageId: result.messageId,
          submittedAt: submitted ? now : null,
          failureReason: submitted ? null : 'TRANSPORT_NOT_SUBMITTED' } }),
        ...(recipient.channel === 'EMAIL' ? [prisma.emailDeliveryLog.update({ where: { id: recipient.logId, ...scope }, data: { status: submitted ? 'submitted' : 'failed', brevoMessageId: result.messageId } })] : []),
      ]);
    }));
    if (results.some(result => result.status === 'rejected')) throw new AppError('Campaign delivery requires review because a result could not be saved.', 503);
  }
  const result = await prisma.$transaction(async tx => {
    // Hold the same campaign lock as webhooks while taking the final snapshot.
    await tx.campaign.update({ where: { id, ...scope }, data: { engagement: { increment: 0 } } });
    const campaign = await recalculateCampaignDelivery(tx, id, tenantId);
    // sentAt on Campaign is the historical submission time, never delivery proof.
    const finished = await tx.campaign.update({ where: { id, ...scope }, data: { submissionFinishedAt: new Date(), ...(campaign.sentCount && !campaign.sentAt ? { sentAt: new Date() } : {}) } });
    return campaignSendResult(finished);
  });
  console.info('[Campaigns]', { event: 'submission_completed', tenantId, ...result });
  await writeAuditLog({ tenantId, userId, action: 'campaign.submitted', entityType: 'Campaign', entityId: id, after: { ...result } });
  return result;
}
// Service-level completion is useful to workers/tests; HTTP uses queueCampaign below.
export async function sendCampaign(id: string, tenantId: string, userId: string): Promise<CampaignSendResult> {
  return deliverPrepared(id, tenantId, userId, await prepareCampaign(id, tenantId));
}

export async function queueCampaign(id: string, tenantId: string, userId: string): Promise<CampaignSendResult> {
  const prepared = await prepareCampaign(id, tenantId);
  // The committed snapshot and submissionStartedAt claim
  // prevent replays even if the browser closes or the proxy request finishes.
  void deliverPrepared(id, tenantId, userId, prepared).catch(async () => {
    console.error('[Campaigns] Delivery interrupted; persisted recipient results require review.');
    try {
      await prisma.campaign.updateMany({ where: { id, ...campaignScope(tenantId), submissionFinishedAt: null }, data: { submissionFinishedAt: new Date() } });
      await writeAuditLog({ tenantId, userId, action: 'campaign.delivery_interrupted', entityType: 'Campaign', entityId: id, severity: 'WARNING' });
    } catch { console.error('[Campaigns] Could not persist the submission interruption; inspect unfinished campaigns.'); }
  });
  return { campaignId: id, eligibleRecipients: prepared.length, submittedRecipients: 0, failedRecipients: 0, status: 'SENDING', submissionComplete: false };
}

export async function archiveCampaign(id: string, tenantId: string, userId: string) {
  await getCampaignById(id, tenantId);
  const result = await prisma.campaign.updateMany({ where: { id, ...campaignScope(tenantId), OR: [{ submissionStartedAt: null }, { submissionFinishedAt: { not: null } }] }, data: { isArchived: true } });
  if (!result.count) throw new AppError('A sending campaign cannot be archived.', 409);
  await writeAuditLog({ tenantId, userId, action: 'campaign.archived', entityType: 'Campaign', entityId: id });
}

export async function duplicateCampaign(id: string, tenantId: string, userId: string) {
  const original = await getCampaignById(id, tenantId);
  return createCampaign(tenantId, userId, { name: original.name.slice(0, 140) + ' (Copy)', type: original.type, subject: original.subject ?? '', body: original.body ?? '', targetAudienceId: original.targetAudienceId, audienceSource: original.audienceSource, emailTemplateId: original.emailTemplateId, smsTemplateId: original.smsTemplateId });
}
