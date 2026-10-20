import { createHash, randomUUID } from 'node:crypto';
import type { EmailAccount, MailboxSendReceipt, Prisma } from '@prisma/client';
import { z } from 'zod';
import type { MailboxComposeMode, MailboxRecordContext, QuotationDocument, QuotationDraft } from '@leadcrm/shared';
import { customerDealWhere } from '../../modules/crm/engagement.service';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { authorizedMailbox } from './mailbox-store';
import { assertStoredMessages, mailboxAddress } from './mailbox-scope';
import { assertMailboxRecipients } from './mailbox-recipient-access';

export type MailboxOperation = 'send' | 'draft' | 'schedule' | 'delete';
export interface MailboxQuotationContext { draft: QuotationDraft; document: QuotationDocument; fingerprint: string; subject: string; body: string }
export interface MailboxOperationContext {
  dealId?: string;
  recipients: string[];
  replyToMessageId?: string;
  forwardSourceMessageId?: string;
  draftId?: string;
  threadId?: string;
  composeMode?: MailboxComposeMode;
  quotation?: MailboxQuotationContext;
  recordContext?: MailboxRecordContext;
}
export interface MailboxOperationClaim {
  receipt: MailboxSendReceipt;
  leaseId: string;
  recover: boolean;
  terminal: boolean;
}
const terminalStatuses = ['sent', 'saved', 'queued', 'deleted', 'cancelled'];
export const operationMessageId = (operation: MailboxOperation, requestId: string) => `<leadcrm-${operation}-${requestId}@leadcrm.invalid>`;
export function mailboxIntentHash(operation: MailboxOperation, intent: unknown) {
  return createHash('sha256').update(JSON.stringify([operation, intent])).digest('hex');
}
export function normalizedRecipients(recipients: string[]) {
  const parsed = recipients.map(mailboxAddress);
  if (parsed.some(address => !address) || recipients.length > 50) throw new AppError('Enter valid recipient addresses (at most 50).', 400);
  return [...new Set(parsed as string[])].sort();
}

/** Receipt replays are protected by current recipient/source access, not possession of an operation UUID. */
export async function authorizeMailboxOperation(account: Pick<EmailAccount, 'id' | 'tenantId' | 'userId'>, context: MailboxOperationContext) {
  const current = await authorizedMailbox(account.tenantId, account.userId);
  if (current.account.id !== account.id) throw new AppError('Mailbox changed. Refresh your Inbox.', 409, 'MAILBOX_SCOPE_CHANGED');
  if (context.recordContext) {
    const { recordModule, recordId } = context.recordContext;
    const where = { tenantId: account.tenantId, id: recordId, assignedUserId: account.userId, isArchived: false, deletedAt: null };
    const record = recordModule === 'leads' && current.permissions.leadsView ? await prisma.lead.findFirst({ where: { ...where, convertedAt: null }, select: { email: true } })
      : recordModule === 'contacts' && current.permissions.contactsView ? await prisma.contact.findFirst({ where, select: { email: true } }) : null;
    if (!record || !context.recipients.includes(mailboxAddress(record.email ?? '') ?? '')) throw new AppError('This email must include the selected record while it is assigned to you.', 403, 'MAILBOX_SCOPE_CHANGED');
    if (context.dealId && (!current.permissions.dealsView || !await prisma.deal.findFirst({ where: {
      ...customerDealWhere(account.tenantId, recordModule === 'leads' ? { leadId: recordId } : { contactId: recordId }), id: context.dealId,
    }, select: { id: true } }))) throw new AppError('Select a Deal associated with this record.', 400);
  }
  if (context.quotation) {
    const { recipientId, recipientType } = context.quotation.draft;
    const where = { id: recipientId, tenantId: account.tenantId, isArchived: false, deletedAt: null };
    const select = { assignedUserId: true, email: true };
    const recipient = recipientType === 'Lead' ? await prisma.lead.findFirst({ where, select }) : await prisma.contact.findFirst({ where, select });
    if (!recipient || recipient.assignedUserId !== account.userId || context.recipients.length !== 1 || mailboxAddress(recipient.email ?? '') !== context.recipients[0]) {
      throw new AppError('You can only send quotations to the selected CRM record while it is assigned to you.', 403, 'CRM_ASSIGNMENT_REQUIRED');
    }
  }
  const sources = [context.replyToMessageId, context.forwardSourceMessageId].filter((id): id is string => !!id);
  if (sources.length) await assertStoredMessages(current.account, current.scope, sources, true);
  let threadId = context.threadId ?? '';
  if (!threadId && context.replyToMessageId) {
    const source = await prisma.mailboxMessage.findUnique({ where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: context.replyToMessageId } }, select: { threadId: true } });
    threadId = source?.threadId ?? '';
  }
  await assertMailboxRecipients(current.account, current.scope, current.permissions, context.recipients, threadId);
  if (context.dealId) {
    if (!current.permissions.dealsView) throw new AppError('Deal view permission is required.', 403);
    const deal = await prisma.deal.findFirst({ where: { tenantId: account.tenantId, id: context.dealId, isArchived: false, deletedAt: null, assignedUserId: account.userId },
      include: { leadDeals: { where: { tenantId: account.tenantId }, include: { lead: { select: { email: true } } } },
        contactDeals: { where: { tenantId: account.tenantId }, include: { contact: { select: { email: true } } } } } });
    const addresses = deal ? [...deal.leadDeals.map(link => mailboxAddress(link.lead.email ?? '')), ...deal.contactDeals.map(link => mailboxAddress(link.contact.email ?? ''))] : [];
    if (!deal || !context.recipients.length || context.recipients.some(recipient => !addresses.includes(recipient))) throw new AppError('Choose authorized recipients linked to your Deal.', 403, 'CRM_ASSIGNMENT_REQUIRED');
  }
  return current;
}

/** One durable claim is shared by every action targeting a draft, across tabs and backend replicas. */
export async function reserveMailboxOperation(account: EmailAccount, requestId: string, operation: MailboxOperation, intent: unknown, context: MailboxOperationContext): Promise<MailboxOperationClaim> {
  z.string().uuid().parse(requestId);
  const payloadHash = mailboxIntentHash(operation, intent), leaseId = randomUUID();
  const key = { accountId: account.id, requestId };
  const leaseUntil = new Date(Date.now() + 120000);
  const created = await prisma.mailboxSendReceipt.createMany({ data: [{ ...key, tenantId: account.tenantId, payloadHash, operation,
    status: 'reserved', targetDraftId: context.draftId ?? null, leaseId, leaseUntil,
    rfcMessageId: operationMessageId(operation, requestId), authorizationContext: context as unknown as Prisma.InputJsonValue }], skipDuplicates: true });
  if (created.count) return { receipt: await prisma.mailboxSendReceipt.findUniqueOrThrow({ where: { accountId_requestId: key } }), leaseId, recover: false, terminal: false };
  const previous = await prisma.mailboxSendReceipt.findUnique({ where: { accountId_requestId: key } });
  if (!previous) throw new AppError('This draft has another pending or unconfirmed operation. Refresh before changing it.', 409, 'MAILBOX_DRAFT_BUSY');
  if (previous.payloadHash !== payloadHash || previous.operation !== operation) throw new AppError('This request ID belongs to different content. Start a new operation.', 409, 'MAILBOX_INTENT_CHANGED');
  if (terminalStatuses.includes(previous.status)) return { receipt: previous, leaseId: '', recover: false, terminal: true };
  if (previous.leaseUntil && previous.leaseUntil > new Date()) throw new AppError('This operation is still in progress. Retry with the same request ID.', 409, 'MAILBOX_OPERATION_PENDING');
  const recover = ['sending', 'uncertain'].includes(previous.status) || !!previous.attemptedAt && previous.status !== 'failed';
  if (recover && previous.recoveryCount >= 4) throw new AppError('The provider outcome remains unconfirmed. Automatic retries are paused; review Gmail before starting another operation.', 409, 'GMAIL_OUTCOME_UNKNOWN');
  let claimed;
  try {
    claimed = await prisma.mailboxSendReceipt.updateMany({ where: { id: previous.id, status: previous.status,
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }] }, data: { status: recover ? 'uncertain' : 'reserved', leaseId, leaseUntil,
      ...(recover ? { recoveryCount: { increment: 1 } } : { attemptedAt: null }), lastError: null } });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') throw new AppError('This draft has another pending operation.', 409, 'MAILBOX_DRAFT_BUSY');
    throw error;
  }
  if (!claimed.count) throw new AppError('This operation is already being processed. Retry with the same request ID.', 409, 'MAILBOX_OPERATION_PENDING');
  return { receipt: await prisma.mailboxSendReceipt.findUniqueOrThrow({ where: { accountId_requestId: key } }), leaseId, recover, terminal: false };
}

export async function markMailboxOperationAttempt(claim: MailboxOperationClaim) {
  const updated = await prisma.mailboxSendReceipt.updateMany({ where: { id: claim.receipt.id, leaseId: claim.leaseId, status: 'reserved', leaseUntil: { gt: new Date() } },
    data: { status: 'sending', attemptedAt: new Date() } });
  if (!updated.count) throw new AppError('Mailbox operation claim changed. Retry with the same request ID.', 409, 'MAILBOX_OPERATION_CLAIM_LOST');
}

export async function finishMailboxOperation(claim: MailboxOperationClaim, data: Prisma.MailboxSendReceiptUpdateManyMutationInput) {
  const updated = await prisma.mailboxSendReceipt.updateMany({ where: { id: claim.receipt.id, leaseId: claim.leaseId },
    data: { ...data, leaseId: null, leaseUntil: null, lastError: null } });
  if (!updated.count) throw new AppError('The provider result requires verification. Retry with the same request ID.', 409, 'GMAIL_OUTCOME_UNKNOWN');
}

export async function failMailboxOperation(claim: MailboxOperationClaim, error: unknown, attempted: boolean) {
  const unknown = claim.recover || attempted && (!(error instanceof AppError) || ['GMAIL_OUTCOME_UNKNOWN', 'MAILBOX_OPERATION_CLAIM_LOST'].includes(error.code ?? ''));
  await prisma.mailboxSendReceipt.updateMany({ where: { id: claim.receipt.id, leaseId: claim.leaseId }, data: {
    status: unknown ? 'uncertain' : 'failed', leaseId: null, leaseUntil: null,
    lastError: unknown ? 'Provider outcome unconfirmed. Retry only this operation to verify it; no automatic resend.' : 'Operation rejected before completion. Review authorization or provider availability.',
  } }).catch(() => undefined);
}
