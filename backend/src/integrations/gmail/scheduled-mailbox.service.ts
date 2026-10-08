import { randomUUID } from 'node:crypto';
import { ScheduleMailboxEmailSchema } from '@leadcrm/shared';
import { z } from 'zod';
import prisma from '../../config/database.config';
import { tenantContext } from '../../core/tenant/tenant-context';
import { AppError } from '../../shared/errors/app-error';
import { authorizedMailbox, mailboxChanged } from './mailbox-store';
import { messageInScope } from './mailbox-scope';
import { fetchMessageDetail, getValidAccessToken, saveDraft, parseGmailMessage, GmailApiMessage } from './gmail.service';
import { readGmailJson, writeGmailJson } from './gmail-read';
import { ingestMailboxMessages } from './mailbox-ingestion.service';

export const scheduleMessageId = (id: string) => `<leadcrm-schedule-${id}@leadcrm.invalid>`;

export async function scheduleMailboxEmail(tenantId: string, userId: string, input: z.infer<typeof ScheduleMailboxEmailSchema>) {
  const data = ScheduleMailboxEmailSchema.parse(input);
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  const existing = await prisma.scheduledMailboxEmail.findUnique({ where: { accountId_requestId: { accountId: account.id, requestId: data.requestId } } });
  if (existing) {
    if (existing.status === 'preparing') throw new AppError('This schedule is still being saved.', 409);
    if (existing.status === 'failed') throw new AppError(existing.lastError ?? 'Schedule could not be saved.', 409);
    return { id: existing.id, status: existing.status };
  }
  const recipients = Array.isArray(data.to) ? data.to : [data.to];
  const reply = data.replyToMessageId ? await prisma.mailboxMessage.findUnique({ where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: data.replyToMessageId } } }) : null;
  if (!messageInScope({ from: account.email, to: recipients, threadId: reply?.threadId ?? '' }, account.email, scope)) throw new AppError('Choose a recipient in your assigned CRM mailbox scope.', 403);
  // Reserve idempotency before touching Gmail. An interrupted draft creation is
  // visible as failed and is never silently retried as a second scheduled send.
  const scheduled = await prisma.scheduledMailboxEmail.create({ data: { tenantId, accountId: account.id, createdById: userId,
    requestId: data.requestId, draftId: 'preparing-' + data.requestId, recipients, subject: data.subject,
    scheduledAt: new Date(data.scheduledAt), status: 'preparing' } });
  try {
    const draft = await saveDraft(tenantId, userId, recipients.join(', '), data.subject, data.body, data.draftId, { replyToMessageId: data.replyToMessageId, messageId: scheduleMessageId(scheduled.id) });
    await prisma.scheduledMailboxEmail.update({ where: { id: scheduled.id }, data: { draftId: draft.draftId, status: 'pending' } });
    await mailboxChanged(account.id);
    return { id: scheduled.id, status: 'pending' };
  } catch (error) {
    await prisma.scheduledMailboxEmail.update({ where: { id: scheduled.id }, data: { status: 'failed', lastError: 'The Gmail draft could not be queued. Review your drafts before scheduling again.' } });
    throw error;
  }
}

export async function runScheduledMailboxEmails() {
  const now = new Date();
  await prisma.scheduledMailboxEmail.updateMany({ where: { status: 'preparing', updatedAt: { lt: new Date(+now - 300000) } }, data: { status: 'failed', lastError: 'Scheduling was interrupted before the draft was confirmed. Review Gmail drafts before scheduling again.' } });
  const due = await prisma.scheduledMailboxEmail.findMany({ where: { scheduledAt: { lte: now },
    status: { in: ['pending', 'claimed', 'sending', 'uncertain'] },
    AND: [{ OR: [{ retryAt: null }, { retryAt: { lte: now } }] }, { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }] }, orderBy: { scheduledAt: 'asc' }, take: 10 });
  for (const item of due) await tenantContext.run({ tenantId: item.tenantId }, async () => {
    const leaseId = randomUUID(), uncertain = ['sending', 'uncertain'].includes(item.status);
    const claim = await prisma.scheduledMailboxEmail.updateMany({ where: { id: item.id, status: item.status,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: { status: uncertain ? 'uncertain' : 'claimed', leaseId, leaseUntil: new Date(Date.now() + 120000), attemptCount: { increment: 1 } } });
    if (!claim.count) return;
    const update = async (data: Parameters<typeof prisma.scheduledMailboxEmail.updateMany>[0]['data']) => {
      if (!(await prisma.scheduledMailboxEmail.updateMany({ where: { id: item.id, leaseId }, data })).count) throw new AppError('Scheduled email claim lost.', 409);
    };
    let deliveryStarted = uncertain, accepted = false, committed = false;
    try {
      const { account, scope, permissions } = await authorizedMailbox(item.tenantId, item.createdById);
      if (account.id !== item.accountId) throw new AppError('Mailbox changed.', 403);
      const token = await getValidAccessToken(item.tenantId, item.createdById);
      let result: { id: string; threadId: string };
      if (uncertain) {
        const query = new URLSearchParams({ q: 'in:sent rfc822msgid:' + scheduleMessageId(item.id), maxResults: '2' });
        const found = await readGmailJson<{ messages?: { id: string; threadId: string }[] }>(token, 'messages?' + query);
        if (!found.messages?.length) {
          await update({ status: item.attemptCount >= 4 ? 'failed' : 'uncertain', retryAt: new Date(Date.now() + 60000),
            lastError: 'Delivery could not be confirmed. Check Gmail Sent before resending; automatic resend is paused to prevent duplicates.' });
          return;
        }
        result = found.messages[0];
      } else {
        const draft = await readGmailJson<{ message: GmailApiMessage }>(token, 'drafts/' + encodeURIComponent(item.draftId) + '?format=full');
        const email = parseGmailMessage(draft.message);
        if (email.rfcMessageId !== scheduleMessageId(item.id) || !messageInScope(email, account.email, scope)) throw new AppError('Scheduled draft changed or recipient is no longer assigned to you.', 403);
        await update({ status: 'sending' });
        deliveryStarted = true;
        result = await writeGmailJson(token, 'drafts/send', 'POST', { id: item.draftId });
      }
      accepted = true;
      await update({ status: 'sent', sentAt: new Date(), providerMessageId: result.id, providerThreadId: result.threadId, lastError: null });
      committed = true;
      await prisma.mailboxMessage.updateMany({ where: { accountId: account.id, draftId: item.draftId }, data: { labels: ['DELETED'] } });
      await prisma.emailAccount.updateMany({ where: { id: account.id }, data: { syncRequestedAt: new Date(), mailboxVersion: { increment: 1 } } });
      // Delivery is already committed. An ingestion error never requeues the send.
      try { await ingestMailboxMessages(account, [await fetchMessageDetail(token, result.id)], permissions); await mailboxChanged(account.id); } catch { /* History worker will finish ingestion. */ }
    } catch (error) {
      if (committed) return; // Never regress a confirmed delivery because cleanup failed.
      const unknown = accepted || uncertain || deliveryStarted && (!(error instanceof AppError) || error.code === 'GMAIL_OUTCOME_UNKNOWN');
      const transient = error instanceof AppError && error.code === 'GMAIL_RATE_LIMITED';
      await update({ status: unknown && item.attemptCount < 4 ? 'uncertain' : transient && item.attemptCount < 3 ? 'pending' : 'failed',
        retryAt: error instanceof AppError && error.retryAt ? new Date(error.retryAt) : new Date(Date.now() + 60000 * 2 ** Math.min(item.attemptCount, 4)),
        lastError: unknown ? 'Delivery needs verification. Automatic resend is paused.' : error instanceof AppError && error.statusCode === 403 ? 'Mailbox authorization or CRM assignment changed. Email was not sent.' : 'Gmail could not send this scheduled email. Reconnect or review the draft.' });
    } finally {
      await prisma.scheduledMailboxEmail.updateMany({ where: { id: item.id, leaseId }, data: { leaseId: null, leaseUntil: null } });
      await mailboxChanged(item.accountId);
    }
  });
}
