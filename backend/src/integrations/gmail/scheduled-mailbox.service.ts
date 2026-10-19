import { randomUUID } from 'node:crypto';
import { ScheduleMailboxEmailSchema, type ScheduledMailboxEmailDetail } from '@leadcrm/shared';
import { z } from 'zod';
import prisma from '../../config/database.config';
import { tenantContext } from '../../core/tenant/tenant-context';
import { AppError } from '../../shared/errors/app-error';
import { authorizedMailbox, mailboxChanged } from './mailbox-store';
import { assertStoredMessages, mailboxAddress, messageInScope, resolveMailboxScope } from './mailbox-scope';
import { assertMailboxRecipients } from './mailbox-recipient-access';
import { fetchMessageDetail, getValidAccessToken, saveDraft, parseGmailMessage, GmailApiMessage } from './gmail.service';
import { readGmailJson, writeGmailJson, withMailboxWorkerReadBudget } from './gmail-read';
import { ingestMailboxMessages } from './mailbox-ingestion.service';
import { authorizeMailboxOperation, normalizedRecipients, mailboxIntentHash, reserveMailboxOperation, markMailboxOperationAttempt, failMailboxOperation, type MailboxOperationContext } from './mailbox-operations';
import { recoverMailboxProviderResult, persistRecoveredDraft } from './mailbox-recovery';
import { MAILBOX_METADATA_HEADERS } from './mailbox-scope';
import { receiptComposeContext, resolveDraftOperationContext } from './mailbox-draft-context';
import { decodeOutgoingAttachments } from './mailbox-upload-attachments';

export const scheduleMessageId = (id: string) => `<leadcrm-schedule-${id}@leadcrm.invalid>`;

export async function getScheduledMailboxEmail(tenantId: string, userId: string, id: string): Promise<ScheduledMailboxEmailDetail> {
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  const item = await prisma.scheduledMailboxEmail.findFirst({ where: { id, tenantId, accountId: account.id, createdById: userId } });
  if (!item) throw new AppError('Scheduled email not found.', 404);
  const draft = await prisma.mailboxMessage.findFirst({ where: { tenantId, accountId: account.id, draftId: item.draftId } });
  if (!draft) throw new AppError('Scheduled draft is no longer available. Review Gmail before resending.', 404);
  await assertStoredMessages(account, scope, [draft.providerMessageId]);
  const current = await authorizedMailbox(tenantId, userId);
  if (current.account.id !== account.id || current.scope.hash !== scope.hash) throw new AppError('Mailbox access changed.', 409, 'MAILBOX_SCOPE_CHANGED');
  return { id: item.id, status: item.status, scheduledAt: item.scheduledAt.toISOString(), recipients: item.recipients, subject: item.subject,
    body: draft.body, lastError: item.lastError, canCancel: ['pending', 'claimed'].includes(item.status) };
}

/** Cancelling competes atomically with the worker's transition to sending. */
export async function cancelScheduledMailboxEmail(tenantId: string, userId: string, id: string) {
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  const item = await prisma.scheduledMailboxEmail.findFirst({ where: { id, tenantId, accountId: account.id, createdById: userId } });
  if (!item) throw new AppError('Scheduled email not found.', 404);
  const draft = await prisma.mailboxMessage.findFirst({ where: { tenantId, accountId: account.id, draftId: item.draftId }, select: { providerMessageId: true } });
  if (!draft) throw new AppError('Scheduled email is not available.', 404);
  await assertStoredMessages(account, scope, [draft.providerMessageId]);
  if (item.status === 'cancelled') return { id, status: 'cancelled' };
  const currentPermissions = (await authorizedMailbox(tenantId, userId)).permissions;
  await prisma.$transaction(async tx => {
    const currentScope = await resolveMailboxScope(account, currentPermissions, tx);
    await assertStoredMessages(account, currentScope, [draft.providerMessageId], false, tx);
    const cancelled = await tx.scheduledMailboxEmail.updateMany({ where: { id, tenantId, accountId: account.id, createdById: userId, status: { in: ['pending', 'claimed'] } },
      data: { status: 'cancelled', leaseId: null, leaseUntil: null, retryAt: null } });
    if (!cancelled.count) throw new AppError('Delivery has already started or needs verification. Check Gmail Sent before resending.', 409);
    await tx.mailboxSendReceipt.updateMany({ where: { accountId: account.id, requestId: item.requestId, operation: 'schedule', status: 'queued' }, data: { status: 'cancelled', leaseId: null, leaseUntil: null } });
  });
  // Keep the Gmail draft so the employee can edit it through the existing Drafts screen.
  await mailboxChanged(account.id);
  return { id, status: 'cancelled' };
}

export async function scheduleMailboxEmail(tenantId: string, userId: string, input: z.infer<typeof ScheduleMailboxEmailSchema>) {
  // A replay of an accepted schedule remains valid after its original due time.
  const data = ScheduleMailboxEmailSchema.extend({ scheduledAt: z.string().datetime() }).parse(input);
  const attachments = decodeOutgoingAttachments(data.attachments);
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  const recipients = normalizedRecipients(Array.isArray(data.to) ? data.to : [data.to]);
  const source = await resolveDraftOperationContext(account, data, { account, scope });
  const context = { recipients, ...source, draftId: data.draftId };
  await authorizeMailboxOperation(account, context);
  const intent = { ...context, subject: data.subject, body: data.body, attachments: data.attachments, scheduledAt: new Date(data.scheduledAt).toISOString() };
  const payloadHash = mailboxIntentHash('schedule', intent);
  const existing = await prisma.scheduledMailboxEmail.findUnique({ where: { accountId_requestId: { accountId: account.id, requestId: data.requestId } } });
  if (existing && existing.payloadHash !== payloadHash) throw new AppError('This request ID belongs to different scheduled content.', 409, 'MAILBOX_INTENT_CHANGED');
  if (existing && existing.status !== 'preparing') {
    const draft = await prisma.mailboxMessage.findFirst({ where: { accountId: account.id, draftId: existing.draftId }, select: { providerMessageId: true } });
    const current = await authorizeMailboxOperation(account, context);
    if (draft && !['sent', 'uncertain'].includes(existing.status)) await assertStoredMessages(current.account, current.scope, [draft.providerMessageId]);
    return { id: existing.id, status: existing.status };
  }
  const claim = await reserveMailboxOperation(account, data.requestId, 'schedule', intent, context);
  let attempted = false;
  let scheduled = existing;
  try {
    if (!claim.recover && Date.parse(data.scheduledAt) <= Date.now()) throw new AppError('Choose a future date and time.', 400);
    if (!scheduled) scheduled = await prisma.scheduledMailboxEmail.create({ data: { tenantId, accountId: account.id, createdById: userId,
      requestId: data.requestId, payloadHash, draftId: data.draftId ?? 'preparing-' + data.requestId, recipients, subject: data.subject,
      scheduledAt: new Date(data.scheduledAt), status: 'preparing' } });
    if (!claim.receipt.attemptedAt) {
      const rfcMessageId = scheduleMessageId(scheduled.id);
      await prisma.mailboxSendReceipt.updateMany({ where: { id: claim.receipt.id, leaseId: claim.leaseId, status: 'reserved' }, data: { rfcMessageId } });
      claim.receipt.rfcMessageId = rfcMessageId;
    }
    let draft: { draftId: string; messageId: string };
    if (claim.recover) {
      const recovered = await recoverMailboxProviderResult(account, claim.receipt, context, 'draft');
      if (!recovered.draftId) throw new AppError('Scheduled draft remains unconfirmed.', 409, 'GMAIL_OUTCOME_UNKNOWN');
      await persistRecoveredDraft(account, { ...recovered, draftId: recovered.draftId }, context);
      draft = { draftId: recovered.draftId, messageId: recovered.messageId };
    } else draft = await saveDraft(tenantId, userId, recipients.join(', '), data.subject, data.body, data.draftId,
      { attachments, recordContext: source.recordContext, dealId: source.dealId, replyToMessageId: source.replyToMessageId, forwardSourceMessageId: source.forwardSourceMessageId, messageId: claim.receipt.rfcMessageId!, operationReceiptId: claim.receipt.id, scheduledId: scheduled.id,
        beforeProviderWrite: async () => { await markMailboxOperationAttempt(claim); attempted = true; } });
    await prisma.$transaction(async tx => {
      await tx.scheduledMailboxEmail.update({ where: { id: scheduled!.id }, data: { draftId: draft.draftId, status: 'pending' } });
      const updated = await tx.mailboxSendReceipt.updateMany({ where: { id: claim.receipt.id, leaseId: claim.leaseId }, data: { status: 'queued', targetDraftId: draft.draftId, providerDraftId: draft.draftId, providerMessageId: draft.messageId, leaseId: null, leaseUntil: null } });
      if (!updated.count) throw new AppError('Schedule result needs verification.', 409, 'GMAIL_OUTCOME_UNKNOWN');
    });
    await mailboxChanged(account.id);
    return { id: scheduled.id, status: 'pending' };
  } catch (error) {
    await failMailboxOperation(claim, error, attempted);
    if (scheduled) await prisma.scheduledMailboxEmail.updateMany({ where: { id: scheduled.id, status: 'preparing' }, data: { lastError: 'Scheduling was interrupted. Retry the same operation to verify its Gmail draft.' } }).catch(() => undefined);
    throw error;
  }
}

export const runScheduledMailboxEmails = () => withMailboxWorkerReadBudget(runScheduledMailboxPass);
async function runScheduledMailboxPass() {
  const now = new Date();
  // Recover a provider-accepted draft after process death; never recreate an unconfirmed draft.
  const preparing = await prisma.scheduledMailboxEmail.findMany({ where: { status: 'preparing', updatedAt: { lt: new Date(+now - 120000) } }, orderBy: { updatedAt: 'asc' }, take: 10 });
  for (const item of preparing) await tenantContext.run({ tenantId: item.tenantId }, async () => {
    const receipt = await prisma.mailboxSendReceipt.findUnique({ where: { accountId_requestId: { accountId: item.accountId, requestId: item.requestId } } });
    if (!receipt || receipt.recoveryCount >= 4 || receipt.leaseUntil && receipt.leaseUntil > now) return;
    const leaseId = randomUUID();
    const claimed = await prisma.mailboxSendReceipt.updateMany({ where: { id: receipt.id, status: { in: ['reserved', 'sending', 'uncertain'] }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
      data: { leaseId, leaseUntil: new Date(Date.now() + 120000), status: receipt.attemptedAt ? 'uncertain' : 'reserved', recoveryCount: { increment: 1 } } });
    if (!claimed.count) return;
    const claim = { receipt, leaseId, recover: !!receipt.attemptedAt, terminal: false };
    try {
      if (!receipt.attemptedAt) {
        await prisma.$transaction(async tx => {
          await tx.scheduledMailboxEmail.updateMany({ where: { id: item.id, status: 'preparing' }, data: { status: 'failed', lastError: 'Scheduling stopped before contacting Gmail. Review the saved message before creating a new schedule.' } });
          await tx.mailboxSendReceipt.updateMany({ where: { id: receipt.id, leaseId }, data: { status: 'failed', leaseId: null, leaseUntil: null } });
        });
        return;
      }
      const context = receipt.authorizationContext as unknown as MailboxOperationContext;
      if (!context || !Array.isArray(context.recipients)) throw new AppError('Legacy schedule requires manual verification.', 409, 'GMAIL_OUTCOME_UNKNOWN');
      const { account } = await authorizeMailboxOperation({ id: item.accountId, tenantId: item.tenantId, userId: item.createdById }, context);
      const recovered = await recoverMailboxProviderResult(account, receipt, context, 'draft');
      if (!recovered.draftId) throw new AppError('Scheduled draft remains unconfirmed.', 409, 'GMAIL_OUTCOME_UNKNOWN');
      await persistRecoveredDraft(account, { ...recovered, draftId: recovered.draftId }, context);
      await prisma.$transaction(async tx => {
        const moved = await tx.mailboxSendReceipt.updateMany({ where: { id: receipt.id, leaseId }, data: { status: 'queued', targetDraftId: recovered.draftId, providerDraftId: recovered.draftId, providerMessageId: recovered.messageId, leaseId: null, leaseUntil: null } });
        if (!moved.count) throw new AppError('Schedule recovery claim changed.', 409, 'GMAIL_OUTCOME_UNKNOWN');
        await tx.scheduledMailboxEmail.updateMany({ where: { id: item.id, status: 'preparing' }, data: { draftId: recovered.draftId, status: 'pending', lastError: null } });
      });
      await mailboxChanged(item.accountId);
    } catch (error) {
      await failMailboxOperation(claim, error, !!receipt.attemptedAt);
      await prisma.scheduledMailboxEmail.updateMany({ where: { id: item.id, status: 'preparing' }, data: { lastError: 'Scheduled draft needs verification. Automatic draft creation and delivery are paused.' } });
    }
  });
  const due = await prisma.scheduledMailboxEmail.findMany({ where: { scheduledAt: { lte: now },
    status: { in: ['pending', 'claimed', 'sending', 'uncertain'] },
    AND: [{ OR: [{ status: { in: ['pending', 'claimed'] } }, { attemptCount: { lt: 4 } }] }, { OR: [{ retryAt: null }, { retryAt: { lte: now } }] }, { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }] }, orderBy: { scheduledAt: 'asc' }, take: 10 });
  for (const item of due) await tenantContext.run({ tenantId: item.tenantId }, async () => {
    const leaseId = randomUUID(), uncertain = ['sending', 'uncertain'].includes(item.status);
    const claim = await prisma.scheduledMailboxEmail.updateMany({ where: { id: item.id, status: item.status,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: { status: uncertain ? 'uncertain' : 'claimed', leaseId, leaseUntil: new Date(Date.now() + 120000), attemptCount: { increment: 1 } } });
    if (!claim.count) return;
    const update = async (data: Parameters<typeof prisma.scheduledMailboxEmail.updateMany>[0]['data']) => {
      if (!(await prisma.scheduledMailboxEmail.updateMany({ where: { id: item.id, leaseId, status: { not: 'cancelled' } }, data })).count) throw new AppError('Scheduled email claim lost.', 409);
    };
    let deliveryStarted = uncertain, accepted = false, committed = false;
    try {
      const { account, scope, permissions } = await authorizedMailbox(item.tenantId, item.createdById);
      if (account.id !== item.accountId) throw new AppError('Mailbox changed.', 403);
      const storedDraft = await prisma.mailboxMessage.findFirst({ where: { tenantId: item.tenantId, accountId: account.id, draftId: item.draftId } });
      if (!storedDraft) throw new AppError('Scheduled draft is no longer available.', 404);
      if (!uncertain) await assertStoredMessages(account, scope, [storedDraft.providerMessageId]);
      if (storedDraft?.sourceMessageId) await assertStoredMessages(account, scope, [storedDraft.sourceMessageId], true);
      await assertMailboxRecipients(account, scope, permissions, item.recipients, storedDraft?.threadId);
      const receipt = await prisma.mailboxSendReceipt.findUnique({ where: { accountId_requestId: { accountId: item.accountId, requestId: item.requestId } } });
      const source = receiptComposeContext(receipt?.authorizationContext ?? null);
      if (!source || !receipt?.rfcMessageId) throw new AppError('This scheduled draft has no verified operation context. Review it in Gmail and save a verified draft before scheduling again.', 409, 'MAILBOX_DRAFT_CONTEXT_REQUIRED');
      const rfcMessageId = receipt.rfcMessageId;
      const context = { recipients: item.recipients, draftId: item.draftId, ...source, threadId: storedDraft.threadId };
      await authorizeMailboxOperation(account, context);
      const token = await getValidAccessToken(item.tenantId, item.createdById);
      let result: { id: string; threadId: string };
      if (uncertain) {
        const query = new URLSearchParams({ q: 'in:sent rfc822msgid:' + rfcMessageId, maxResults: '2' });
        const found = await readGmailJson<{ messages?: { id: string; threadId: string }[] }>(token, 'messages?' + query);
        if (found.messages?.length !== 1) {
          await update({ status: 'uncertain', retryAt: item.attemptCount >= 3 ? null : new Date(Date.now() + 60000),
            lastError: 'Delivery could not be confirmed. Check Gmail Sent before resending; automatic resend is paused to prevent duplicates.' });
          return;
        }
        const metadata = parseGmailMessage(await readGmailJson<GmailApiMessage>(token, `messages/${encodeURIComponent(found.messages[0].id)}?format=metadata&${MAILBOX_METADATA_HEADERS}`));
        const current = await authorizeMailboxOperation(account, context);
        if (metadata.rfcMessageId !== rfcMessageId || mailboxAddress(metadata.from) !== mailboxAddress(account.email) ||
          (metadata.bcc?.length ?? 0) > 0 || !metadata.labels.includes('SENT') || !messageInScope(metadata, account.email, current.scope) ||
          JSON.stringify(normalizedRecipients([...metadata.to, ...(metadata.cc ?? [])])) !== JSON.stringify(normalizedRecipients(item.recipients))) throw new AppError('Scheduled delivery remains unconfirmed.', 409, 'GMAIL_OUTCOME_UNKNOWN');
        result = found.messages[0];
      } else {
        const draft = await readGmailJson<{ message: GmailApiMessage }>(token, 'drafts/' + encodeURIComponent(item.draftId) + '?format=metadata');
        const email = parseGmailMessage(draft.message);
        // Gmail replaces a draft's immutable message whenever its content changes.
        // The container ID alone cannot prove the scheduled mode/source/content.
        if (receipt.providerDraftId !== item.draftId || !receipt.providerMessageId || email.id !== receipt.providerMessageId) {
          throw new AppError('This draft was edited in Gmail after scheduling. Save and schedule it again with the original authorized source selected.', 409, 'MAILBOX_DRAFT_CONTEXT_REQUIRED');
        }
        // The CRM composer does not support Bcc; provider edits must not add hidden delivery targets.
        if (draft.message.payload?.headers?.some(header => header.name.toLowerCase() === 'bcc' && header.value.trim())) throw new AppError('Scheduled draft has unsupported recipients. Review it in Gmail.', 403);
        const current = await authorizeMailboxOperation(account, context);
        await assertStoredMessages(current.account, current.scope, [storedDraft.providerMessageId]);
        if (email.rfcMessageId !== rfcMessageId || mailboxAddress(email.from) !== mailboxAddress(account.email) || !messageInScope(email, account.email, current.scope) ||
          JSON.stringify(normalizedRecipients([...email.to, ...(email.cc ?? [])])) !== JSON.stringify(normalizedRecipients(item.recipients))) throw new AppError('Scheduled draft changed or recipient is no longer assigned to you.', 403);
        await assertMailboxRecipients(current.account, current.scope, current.permissions, [...email.to, ...(email.cc ?? [])], email.threadId);
        await prisma.$transaction(async tx => {
          const moved = await tx.scheduledMailboxEmail.updateMany({ where: { id: item.id, leaseId, status: 'claimed', leaseUntil: { gt: new Date() } }, data: { status: 'sending' } });
          if (!moved.count) throw new AppError('Scheduled email claim lost.', 409);
          if (receipt) await tx.mailboxSendReceipt.updateMany({ where: { id: receipt.id, status: 'queued' }, data: { status: 'sending', attemptedAt: new Date(), leaseId, leaseUntil: new Date(Date.now() + 120000) } });
        });
        deliveryStarted = true;
        result = await writeGmailJson(token, 'drafts/send', 'POST', { id: item.draftId });
      }
      accepted = true;
      if (![result?.id, result?.threadId].every(value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value))) {
        throw new AppError('Gmail returned an incomplete scheduled delivery receipt. Verify this operation before resending.', 503, 'GMAIL_OUTCOME_UNKNOWN');
      }
      await update({ status: 'sent', sentAt: new Date(), providerMessageId: result.id, providerThreadId: result.threadId, lastError: null });
      committed = true;
      await prisma.mailboxSendReceipt.updateMany({ where: { accountId: item.accountId, requestId: item.requestId, operation: 'schedule', status: { in: ['queued', 'sending', 'uncertain'] } }, data: { status: 'sent', providerMessageId: result.id, providerThreadId: result.threadId, leaseId: null, leaseUntil: null } });
      await prisma.mailboxMessage.updateMany({ where: { accountId: account.id, draftId: item.draftId }, data: { labels: ['DELETED'] } });
      await prisma.emailAccount.updateMany({ where: { id: account.id }, data: { syncRequestedAt: new Date(), mailboxVersion: { increment: 1 } } });
      // Delivery is already committed. An ingestion error never requeues the send.
      try {
        const meta = parseGmailMessage(await readGmailJson<GmailApiMessage>(token, `messages/${encodeURIComponent(result.id)}?format=metadata&${MAILBOX_METADATA_HEADERS}`));
        const current = await authorizeMailboxOperation(account, context);
        if (messageInScope(meta, account.email, current.scope) && !meta.labels.some(label => ['SPAM', 'TRASH'].includes(label))) await ingestMailboxMessages(account, [await fetchMessageDetail(token, result.id)], current.permissions, { dealId: context.dealId, sourceMessageId: context.replyToMessageId });
        await mailboxChanged(account.id);
      } catch { /* History worker will finish ingestion. */ }
    } catch (error) {
      if (committed) return; // Never regress a confirmed delivery because cleanup failed.
      const current = await prisma.scheduledMailboxEmail.findUnique({ where: { id: item.id }, select: { leaseId: true } });
      if (current?.leaseId !== leaseId) return; // Cancellation or a newer worker owns the row.
      const unknown = accepted || uncertain || deliveryStarted && (!(error instanceof AppError) || error.code === 'GMAIL_OUTCOME_UNKNOWN');
      const transient = error instanceof AppError && error.code === 'GMAIL_RATE_LIMITED';
      const status = unknown ? 'uncertain' : transient && item.attemptCount < 2 ? 'pending' : 'failed';
      await update({ status,
        retryAt: unknown && item.attemptCount >= 3 ? null : error instanceof AppError && error.retryAt ? new Date(error.retryAt) : new Date(Date.now() + 60000 * 2 ** Math.min(item.attemptCount, 4)),
        lastError: unknown ? 'Delivery needs verification. Automatic resend is paused.' : error instanceof AppError && error.code === 'MAILBOX_DRAFT_CONTEXT_REQUIRED' ? error.message : error instanceof AppError && [403, 404].includes(error.statusCode) ? 'Mailbox authorization or CRM assignment changed. Email was not sent.' : 'Gmail could not send this scheduled email. Reconnect or review the draft.' });
      await prisma.mailboxSendReceipt.updateMany({ where: { accountId: item.accountId, requestId: item.requestId, operation: 'schedule', status: { in: ['queued', 'sending', 'uncertain'] } }, data: { status: unknown ? 'uncertain' : status === 'pending' ? 'queued' : 'failed', leaseId: null, leaseUntil: null, lastError: unknown ? 'Delivery unconfirmed. No automatic resend.' : 'Scheduled delivery rejected.' } });
    } finally {
      await prisma.scheduledMailboxEmail.updateMany({ where: { id: item.id, leaseId }, data: { leaseId: null, leaseUntil: null } });
      await mailboxChanged(item.accountId);
    }
  });
}
