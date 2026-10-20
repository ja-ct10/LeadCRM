import type { MailboxAttachment, MailboxMessageContent, RecordEmailAttachmentContext } from '@leadcrm/shared';
import { assertRecordMailboxMessage } from './mailbox-record-scope';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { authorizedMailbox } from './mailbox-store';
import { assertStoredMessages, messageInScope, resolveMailboxScope } from './mailbox-scope';
import { getValidAccessToken, fetchMessageDetail, gmailParts, decodeGmailBody, MAX_MAILBOX_ATTACHMENT_BYTES, type GmailApiMessage } from './gmail.service';
import { readGmailJson } from './gmail-read';
import { mailboxPermissions } from './mailbox-sync.service';
import { salesTransaction } from '../../modules/crm/leads/lead-automation.service';

/** Read only a currently authorized message; repairing display fields never replays CRM effects. */
export async function readMailboxContent(tenantId: string, userId: string, messageId: string): Promise<MailboxMessageContent> {
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  await assertStoredMessages(account, scope, [messageId]);
  const stored = await prisma.mailboxMessage.findUniqueOrThrow({ where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: messageId } }, select: { id: true, threadId: true } });
  const email = await fetchMessageDetail(await getValidAccessToken(tenantId, userId), messageId);
  if (email.threadId !== stored.threadId || !messageInScope(email, account.email, scope) || email.labels.some(label => ['SPAM', 'TRASH', 'DELETED'].includes(label))) throw new AppError('Message access changed. Refresh your Inbox.', 404, 'MAILBOX_SCOPE_CHANGED');
  const content = { body: email.body, attachments: email.attachments ?? [] };
  await salesTransaction(async tx => {
    const permissions = await mailboxPermissions(tenantId, userId, true, tx);
    const currentScope = await resolveMailboxScope(account, permissions, tx);
    await assertStoredMessages(account, currentScope, [messageId], false, tx);
    if (!messageInScope(email, account.email, currentScope)) throw new AppError('Message access changed.', 404, 'MAILBOX_SCOPE_CHANGED');
    await tx.mailboxMessage.update({ where: { id: stored.id }, data: { body: content.body, attachments: JSON.parse(JSON.stringify(content.attachments)) } });
  });
  return content;
}

/** Only inert browser preview types are returned as such. Other bytes stay download-only. */
function previewContentType(data: Buffer, mimeType: string) {
  const type = mimeType.toLowerCase().split(';')[0].trim();
  if (type === 'application/pdf' && data.subarray(0, 5).toString() === '%PDF-') return type;
  if (type === 'image/png' && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return type;
  if (type === 'image/jpeg' && data[0] === 255 && data[1] === 216 && data[2] === 255) return type;
  if (type === 'image/gif' && /^GIF8[79]a$/.test(data.subarray(0, 6).toString())) return type;
  if (type === 'image/webp' && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return type;
  return 'application/octet-stream';
}

export async function readMailboxAttachment(tenantId: string, userId: string, messageId: string, attachmentId: string, recordContext?: RecordEmailAttachmentContext) {
  if (recordContext) await assertRecordMailboxMessage(tenantId, userId, messageId, recordContext);
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  await assertStoredMessages(account, scope, [messageId]);
  const row = await prisma.mailboxMessage.findUniqueOrThrow({ where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: messageId } }, select: { attachments: true, threadId: true } });
  const attachment = (Array.isArray(row.attachments) ? row.attachments as unknown as MailboxAttachment[] : []).find(file => file.id === attachmentId);
  if (!attachment) throw new AppError('Attachment is not available for this message.', 404);
  if (attachment.size !== undefined && (!Number.isSafeInteger(attachment.size) || attachment.size < 0) || typeof attachment.filename !== 'string' || typeof attachment.mimeType !== 'string') throw new AppError('Invalid attachment metadata.', 502);
  if (attachment.size !== undefined && attachment.size > MAX_MAILBOX_ATTACHMENT_BYTES) throw new AppError('This attachment exceeds the download limit.', 413);
  const token = await getValidAccessToken(tenantId, userId);
  let result: { data?: string; size?: number };
  if (attachmentId.startsWith('part:')) {
    const message = await readGmailJson<GmailApiMessage>(token, `messages/${encodeURIComponent(messageId)}?format=full`);
    if (message.id !== messageId || message.threadId !== row.threadId) throw new AppError('Message changed during download.', 409);
    const part = gmailParts(message.payload).find(part => part.partId === attachment.partId && `part:${part.partId}` === attachmentId);
    if (!part?.body || part.body.attachmentId) throw new AppError('Attachment is no longer available.', 404);
    result = part.body;
  } else result = await readGmailJson<{ data: string; size: number }>(token, `messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);
  const data = decodeGmailBody(result);
  if (attachment.size !== undefined && data.length !== attachment.size) throw new AppError('Gmail returned an incomplete attachment.', 502);
  // Recheck after the network request so a reassignment during download revokes it.
  const current = await authorizedMailbox(tenantId, userId);
  if (current.account.id !== account.id) throw new AppError('Mailbox changed during download.', 409);
  await assertStoredMessages(current.account, current.scope, [messageId]);
  if (recordContext) await assertRecordMailboxMessage(tenantId, userId, messageId, recordContext);
  return { data, filename: attachment.filename, mimeType: previewContentType(data, attachment.mimeType) };
}
