import { createHash } from 'node:crypto';
import { Prisma, type EmailAccount, type MailboxSendReceipt } from '@prisma/client';
import { z } from 'zod';
import { MAILBOX_FORWARD_RECIPIENT_ERROR, type MailboxAttachment } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { privateObjectStorage } from '../../shared/services/private-object-storage';
import { salesTransaction } from '../../modules/crm/leads/lead-automation.service';
import { crmActor } from '../../modules/crm/access/crm-record-access.service';
import { requireEmployeeAccount } from '../../core/auth/account-access';
import { normalizeEmail, ENGAGEMENT_RULE_VERSION } from './engagement-rules';
import { validateOutgoingAttachments, type OutgoingMailboxAttachment } from './mailbox-upload-attachments';
import { MAILBOX_PARTICIPANT_POLICY_VERSION } from './mailbox-scope';

const snapshotSchema = z.object({
  version: z.literal(1), tenantId: z.string(), senderUserId: z.string(), sender: z.string().email(),
  recipients: z.array(z.object({ userId: z.string(), email: z.string().email() })).min(1).max(50),
  subject: z.string(), body: z.string(), sentAt: z.string().datetime(),
  rfcInReplyTo: z.string().optional(), rfcReferences: z.array(z.string()).optional(),
  attachments: z.array(z.object({ id: z.string(), filename: z.string(), mimeType: z.string(), size: z.number().int().nonnegative(), key: z.string(), sha256: z.string() })).max(10),
});
export type ForwardDeliverySnapshot = z.infer<typeof snapshotSchema>;
export const localForwardId = (receiptId: string) => `internal_${receiptId}`;
export const isLocalForwardId = (id: string) => id.startsWith('internal_');
export function assertProviderMessageIds(ids: string[]) {
  if (ids.some(isLocalForwardId)) throw new AppError('This internal copy is available to read and download. Gmail actions become available after mailbox synchronization.', 409, 'MAILBOX_PROVIDER_PENDING');
}
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export function forwardDeliverySnapshot(value: unknown): ForwardDeliverySnapshot | undefined {
  const parsed = z.object({ forwardDelivery: snapshotSchema }).safeParse(value);
  return parsed.success ? parsed.data.forwardDelivery : undefined;
}
export function forwardAttachmentMetadata(snapshot: ForwardDeliverySnapshot): MailboxAttachment[] {
  return snapshot.attachments.map(({ id, filename, mimeType, size }) => ({ id, filename, mimeType, size, disposition: 'attachment' }));
}

/** Stage the exact delivery before Gmail accepts it, including bytes needed by non-OAuth recipients. */
export async function stageForwardDelivery(account: EmailAccount, receiptId: string, input: {
  recipients: string[]; subject: string; body: string; attachments: OutgoingMailboxAttachment[]; sentAt?: string; rfcInReplyTo?: string; rfcReferences?: string[];
}) {
  const receipt = await prisma.mailboxSendReceipt.findFirstOrThrow({ where: { id: receiptId, tenantId: account.tenantId, accountId: account.id } });
  const prior = forwardDeliverySnapshot(receipt.authorizationContext);
  validateOutgoingAttachments(input.attachments);
  const emails = [...new Set(input.recipients.map(normalizeEmail))].sort();
  const readUsers = () => prisma.user.findMany({ where: { tenantId: account.tenantId, status: 'ACTIVE', email: { in: emails, mode: 'insensitive' } },
    select: { id: true, tenantId: true, email: true, role: true } });
  const actor = crmActor.getStore();
  const users = actor ? await crmActor.run({ ...actor, readRecords: false }, readUsers) : await readUsers();
  if (users.length !== emails.length) throw new AppError(MAILBOX_FORWARD_RECIPIENT_ERROR, 403, 'MAILBOX_RECIPIENT_REJECTED');
  for (const user of users) {
    try { await requireEmployeeAccount(user); }
    catch (error) { if (error instanceof AppError && error.statusCode === 403) throw new AppError(MAILBOX_FORWARD_RECIPIENT_ERROR, 403, 'MAILBOX_RECIPIENT_REJECTED'); throw error; }
  }
  const recipients = emails.map(email => ({ userId: users.find(user => normalizeEmail(user.email) === email)!.id, email }));
  for (const recipient of recipients) {
    const existing = await prisma.emailAccount.findUnique({ where: { tenantId_userId_provider: { tenantId: account.tenantId, userId: recipient.userId, provider: 'gmail' } } });
    if (existing && normalizeEmail(existing.email) !== recipient.email) throw new AppError('The recipient mailbox does not match their registered employee address.', 409, 'MAILBOX_SCOPE_CHANGED');
  }
  if (prior) {
    if (prior.tenantId !== account.tenantId || prior.senderUserId !== account.userId || prior.sender !== normalizeEmail(account.email) || prior.subject !== input.subject || prior.body !== input.body ||
      JSON.stringify(prior.recipients) !== JSON.stringify(recipients) || JSON.stringify(prior.attachments.map(file => [file.filename, file.mimeType, file.sha256])) !== JSON.stringify(input.attachments.map(file => [file.filename, file.mimeType, digest(file.data)]))) {
      throw new AppError('The staged forward no longer matches this delivery.', 409, 'MAILBOX_INTENT_CHANGED');
    }
  }
  const attachments: ForwardDeliverySnapshot['attachments'] = [];
  for (const [index, file] of input.attachments.entries()) {
    const sha256 = digest(file.data), key = `${account.tenantId}/${receipt.id}/${index}-${sha256}`;
    const storage = privateObjectStorage('mailbox-attachments');
    try { await storage.read(key); }
    catch (error) {
      if (!(error instanceof AppError) || error.statusCode !== 404) throw error;
      // Concurrent staging may publish the same immutable object first.
      try { await storage.put(key, file.data); }
      catch (writeError) { if (digest(await storage.read(key).catch(() => { throw writeError; })) !== sha256) throw writeError; }
    }
    if (digest(await storage.read(key)) !== sha256) throw new AppError('Forward attachment verification failed.', 502);
    attachments.push({ id: `forward_${receipt.id}_${index}`, filename: file.filename, mimeType: file.mimeType, size: file.data.length, key, sha256 });
  }
  const snapshot: ForwardDeliverySnapshot = { version: 1, tenantId: account.tenantId, senderUserId: account.userId, sender: normalizeEmail(account.email),
    recipients, subject: input.subject, body: input.body, sentAt: input.sentAt ?? new Date().toISOString(), attachments,
    ...(input.rfcInReplyTo ? { rfcInReplyTo: input.rfcInReplyTo, rfcReferences: input.rfcReferences ?? [] } : {}) };
  await salesTransaction(async tx => {
    const current = await tx.mailboxSendReceipt.findUniqueOrThrow({ where: { id: receipt.id } });
    await tx.mailboxSendReceipt.update({ where: { id: receipt.id }, data: { authorizationContext: { ...current.authorizationContext as Prisma.JsonObject, forwardDelivery: snapshot } } });
  });
  return snapshot;
}

/** Also called from ingestion inside its serializable transaction. Never touch CRM records. */
export async function materializeForwardCopies(tx: Prisma.TransactionClient, account: EmailAccount, receipt: MailboxSendReceipt,
  result: { messageId: string; threadId: string }, snapshot: ForwardDeliverySnapshot) {
  if (snapshot.tenantId !== account.tenantId || snapshot.senderUserId !== account.userId || snapshot.sender !== normalizeEmail(account.email) || !receipt.rfcMessageId) throw new AppError('Forward delivery identity changed.', 409, 'MAILBOX_SCOPE_CHANGED');
  const targets = [account];
  for (const recipient of snapshot.recipients) {
    if (recipient.userId === account.userId) continue;
    const user = await tx.user.findFirst({ where: { id: recipient.userId, tenantId: account.tenantId }, select: { email: true } });
    // A later employee email edit must never transfer a historical delivery.
    if (!user || normalizeEmail(user.email) !== recipient.email) continue;
    const target = await tx.emailAccount.upsert({ where: { tenantId_userId_provider: { tenantId: account.tenantId, userId: recipient.userId, provider: 'gmail' } }, update: {},
      create: { tenantId: account.tenantId, userId: recipient.userId, provider: 'gmail', email: recipient.email, isActive: false, accessToken: '', scopes: [] } });
    if (normalizeEmail(target.email) === recipient.email) targets.push(target);
  }
  const recipients = snapshot.recipients.map(person => person.email).sort(), participants = [...new Set([snapshot.sender, ...recipients])].sort();
  for (const target of targets) {
    const sender = target.id === account.id;
    const existing = await tx.mailboxMessage.findFirst({ where: { tenantId: account.tenantId, accountId: target.id,
      rfcMessageId: receipt.rfcMessageId, fromAddress: snapshot.sender, recipientAddresses: { equals: recipients },
      authorizationParticipants: { equals: participants }, NOT: { labels: { has: 'DRAFT' } } }, orderBy: { createdAt: 'asc' } });
    if (existing) continue; // Replays never reset read/archive state or recreate a reconciled copy.
    await tx.mailboxMessage.create({ data: { tenantId: account.tenantId, accountId: target.id,
      providerMessageId: sender ? result.messageId : localForwardId(receipt.id), threadId: sender ? result.threadId : localForwardId(receipt.id),
      direction: sender ? 'outbound' : 'inbound', from: snapshot.sender, fromAddress: snapshot.sender,
      recipients, recipientAddresses: recipients, authorizationParticipants: participants, participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION,
      subject: snapshot.subject, body: snapshot.body, snippet: snapshot.body.replace(/<[^>]*>/g, '').slice(0, 200),
      labels: sender ? ['SENT'] : ['INBOX', 'UNREAD'], sentAt: new Date(snapshot.sentAt), rfcMessageId: receipt.rfcMessageId,
      rfcInReplyTo: snapshot.rfcInReplyTo, rfcReferences: snapshot.rfcReferences ?? [],
      attachments: forwardAttachmentMetadata(snapshot) as unknown as Prisma.InputJsonValue,
      leadId: null, contactId: null, dealId: null, meaningful: false, readyToClose: false, needsDealAssociation: false, engagementRuleVersion: ENGAGEMENT_RULE_VERSION } });
    await tx.emailAccount.update({ where: { id: target.id }, data: { mailboxVersion: { increment: 1 } } });
  }
}

const localStateSchema = z.object({ accountId: z.string(), userId: z.string(), version: z.number().int().positive(), pending: z.boolean(),
  unread: z.boolean().optional(), inbox: z.boolean().optional(), trash: z.literal(true).optional() });
export type InternalMailboxState = z.infer<typeof localStateSchema>;
export function internalMailboxStates(context: unknown): Record<string, InternalMailboxState> {
  const parsed = z.object({ mailboxActions: z.record(localStateSchema) }).safeParse(context);
  return parsed.success ? parsed.data.mailboxActions : {};
}
export function overlayInternalLabels(labels: string[], state?: InternalMailboxState) {
  const result = new Set(labels);
  if (!state?.pending) return [...result];
  for (const [label, present] of [['UNREAD', state.unread], ['INBOX', state.inbox], ['TRASH', state.trash]] as const) {
    if (present === true) result.add(label); else if (present === false) result.delete(label);
  }
  if (state.trash) result.delete('INBOX');
  return [...result];
}
export function nextInternalMailboxState(previous: InternalMailboxState | undefined, account: EmailAccount, action: 'read' | 'unread' | 'archive' | 'trash' | 'restore'): InternalMailboxState {
  return { ...(previous?.pending ? previous : {}), accountId: account.id, userId: account.userId, version: (previous?.version ?? 0) + 1, pending: true,
    ...(action === 'read' || action === 'unread' ? { unread: action === 'unread' } : action === 'archive' || action === 'restore' ? { inbox: action === 'restore' } : { trash: true, inbox: false }) };
}

export async function completeForwardDelivery(account: EmailAccount, receiptId: string, result: { messageId: string; threadId: string }, scheduled?: { id: string; leaseId: string }) {
  return salesTransaction(async tx => {
    const receipt = await tx.mailboxSendReceipt.findFirstOrThrow({ where: { id: receiptId, accountId: account.id, tenantId: account.tenantId } });
    const snapshot = forwardDeliverySnapshot(receipt.authorizationContext);
    if (!snapshot) return false;
    if (!['sending', 'uncertain', 'queued', 'sent'].includes(receipt.status) || receipt.status === 'sent' && (receipt.providerMessageId !== result.messageId || receipt.providerThreadId !== result.threadId)) throw new AppError('Forward delivery receipt changed.', 409, 'GMAIL_OUTCOME_UNKNOWN');
    await tx.mailboxSendReceipt.update({ where: { id: receipt.id }, data: { status: 'sent', providerMessageId: result.messageId, providerThreadId: result.threadId, leaseId: null, leaseUntil: null, lastError: null } });
    await materializeForwardCopies(tx, account, receipt, result, snapshot);
    if (scheduled && !(await tx.scheduledMailboxEmail.updateMany({ where: { id: scheduled.id, accountId: account.id, tenantId: account.tenantId, leaseId: scheduled.leaseId },
      data: { status: 'sent', sentAt: new Date(snapshot.sentAt), providerMessageId: result.messageId, providerThreadId: result.threadId, lastError: null } })).count) throw new AppError('Scheduled forward claim changed.', 409, 'GMAIL_OUTCOME_UNKNOWN');
    return true;
  });
}

export async function storedForwardSnapshot(account: EmailAccount, rfcMessageId: string | null) {
  if (!rfcMessageId) return;
  const receipts = await prisma.mailboxSendReceipt.findMany({ where: { tenantId: account.tenantId, rfcMessageId, status: 'sent', operation: { in: ['send', 'schedule'] } } });
  for (const receipt of receipts) {
    const snapshot = forwardDeliverySnapshot(receipt.authorizationContext);
    if (snapshot?.tenantId === account.tenantId && (receipt.accountId === account.id && snapshot.senderUserId === account.userId || snapshot.recipients.some(person => person.userId === account.userId && person.email === normalizeEmail(account.email)))) return snapshot;
  }
}

export async function readForwardAttachment(snapshot: ForwardDeliverySnapshot, attachmentId: string) {
  const file = snapshot.attachments.find(file => file.id === attachmentId);
  if (!file) throw new AppError('Attachment is not available for this message.', 404, 'MAILBOX_ATTACHMENT_UNAVAILABLE');
  const data = await privateObjectStorage('mailbox-attachments').read(file.key);
  if (data.length !== file.size || digest(data) !== file.sha256) throw new AppError('Forward attachment verification failed.', 502);
  return { data, filename: file.filename, mimeType: file.mimeType };
}
