import type { EmailAccount, MailboxSendReceipt } from '@prisma/client';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { readGmailJson } from './gmail-read';
import { getValidAccessToken, parseGmailMessage, fetchMessageDetail, type GmailApiMessage } from './gmail.service';
import { authorizeMailboxOperation, normalizedRecipients, type MailboxOperationContext } from './mailbox-operations';
import { MAILBOX_METADATA_HEADERS, MAILBOX_PARTICIPANT_POLICY_VERSION, mailboxAddress, mailboxParticipants, messageInScope } from './mailbox-scope';
import { mailboxChanged } from './mailbox-store';

/** Recover by our immutable RFC identity, never subject/recipient guesses or another provider write. */
export async function recoverMailboxProviderResult(account: EmailAccount, receipt: MailboxSendReceipt, context: MailboxOperationContext, kind: 'sent' | 'draft') {
  if (!receipt.rfcMessageId) throw new AppError('This older operation has no recovery identity. Review Gmail before starting another send.', 409, 'GMAIL_OUTCOME_UNKNOWN');
  const token = await getValidAccessToken(account.tenantId, account.userId);
  const q = (kind === 'sent' ? 'in:sent ' : '') + 'rfc822msgid:' + receipt.rfcMessageId;
  const candidates = kind === 'sent'
    ? (await readGmailJson<{ messages?: { id: string; threadId: string }[] }>(token, 'messages?' + new URLSearchParams({ q, maxResults: '2' }))).messages?.map(row => ({ messageId: row.id, draftId: undefined as string | undefined })) ?? []
    : (await readGmailJson<{ drafts?: { id: string; message: { id: string } }[] }>(token, 'drafts?' + new URLSearchParams({ q, maxResults: '2' }))).drafts?.map(row => ({ messageId: row.message.id, draftId: row.id })) ?? [];
  if (candidates.length !== 1) throw new AppError('The provider outcome remains unconfirmed. Retry only this operation to verify it; no automatic resend.', 409, 'GMAIL_OUTCOME_UNKNOWN');
  const candidate = candidates[0];
  const email = parseGmailMessage(await readGmailJson<GmailApiMessage>(token, `messages/${encodeURIComponent(candidate.messageId)}?format=metadata&${MAILBOX_METADATA_HEADERS}`));
  if (kind === 'draft') email.crmDraft = true;
  const current = await authorizeMailboxOperation(account, context);
  if (email.rfcMessageId !== receipt.rfcMessageId || mailboxAddress(email.from) !== mailboxAddress(account.email) ||
    !messageInScope(email, account.email, current.scope) || !email.labels.includes(kind === 'sent' ? 'SENT' : 'DRAFT') ||
    (email.bcc?.length ?? 0) > 0 || JSON.stringify(normalizedRecipients([...email.to, ...(email.cc ?? [])])) !== JSON.stringify(normalizedRecipients(context.recipients))) {
    throw new AppError('The provider result no longer matches the authorized operation. Review Gmail.', 409, 'GMAIL_OUTCOME_UNKNOWN');
  }
  return { messageId: email.id, threadId: email.threadId, draftId: candidate.draftId, token };
}

export async function persistRecoveredDraft(account: EmailAccount, result: { messageId: string; draftId: string; token: string }, context: MailboxOperationContext) {
  const email = await fetchMessageDetail(result.token, result.messageId);
  email.crmDraft = true;
  const current = await authorizeMailboxOperation(account, context);
  if (!messageInScope(email, account.email, current.scope)) throw new AppError('Draft access changed during recovery.', 409, 'MAILBOX_SCOPE_CHANGED');
  const participants = mailboxParticipants(email)!;
  const data = { threadId: email.threadId, from: email.from, fromAddress: mailboxAddress(email.from)!, recipients: email.to,
    recipientAddresses: [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])].flatMap(value => mailboxAddress(value) ?? []), ccRecipients: email.cc ?? [],
    replyToAddress: email.replyToAddress ?? null, authorizationParticipants: participants, participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION,
    subject: email.subject, body: email.body, snippet: email.snippet, labels: email.labels, direction: 'outbound', sentAt: new Date(email.date),
    draftId: result.draftId, crmDraft: true, sourceMessageId: context.replyToMessageId ?? context.forwardSourceMessageId ?? null,
    rfcMessageId: email.rfcMessageId, rfcInReplyTo: email.rfcInReplyTo, rfcReferences: email.rfcReferences ?? [] };
  await prisma.$transaction(async tx => {
    if (context.draftId) await tx.mailboxMessage.updateMany({ where: { tenantId: account.tenantId, accountId: account.id, draftId: context.draftId, providerMessageId: { not: email.id } }, data: { labels: ['DELETED'] } });
    await tx.mailboxMessage.upsert({ where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: email.id } },
      create: { ...data, tenantId: account.tenantId, accountId: account.id, providerMessageId: email.id }, update: data });
  });
  await mailboxChanged(account.id);
  return email;
}

/** A confirmed send survives local ingestion failures and is completed later by History sync. */
export async function requestMailboxIngestion(account: EmailAccount) {
  await prisma.emailAccount.updateMany({ where: { id: account.id, tenantId: account.tenantId, isActive: true }, data: { syncRequestedAt: new Date(), mailboxVersion: { increment: 1 } } });
}
