import { MailboxComposeContextSchema, type MailboxEmail, type MailboxComposeMode, type MailboxRecordContext } from '@leadcrm/shared';
import type { EmailAccount, MailboxMessage, Prisma } from '@prisma/client';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { assertStoredMessages, type MailboxScope } from './mailbox-scope';

type DraftContext = { composeMode: MailboxComposeMode; replyToMessageId?: string; forwardSourceMessageId?: string; recordContext?: MailboxRecordContext; dealId?: string };
type RestoredDraftContext = Pick<MailboxEmail, 'composeMode' | 'replyToMessageId' | 'forwardSourceMessageId' | 'draftContextRequired' | 'recordContext' | 'dealId'>;
export function receiptComposeContext(value: Prisma.JsonValue | null): DraftContext | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('composeMode' in value)) return;
  const parsed = MailboxComposeContextSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** Only an exact acknowledged provider draft/message pair supplies restoration intent. */
export async function draftComposeContext(account: Pick<EmailAccount, 'id' | 'tenantId'>, row: MailboxMessage): Promise<RestoredDraftContext> {
  const receipt = row.draftId ? await prisma.mailboxSendReceipt.findFirst({ where: { tenantId: account.tenantId, accountId: account.id,
    providerDraftId: row.draftId, providerMessageId: row.providerMessageId, operation: { in: ['draft', 'schedule'] }, status: { in: ['saved', 'queued', 'cancelled'] } },
    orderBy: { createdAt: 'desc' }, select: { authorizationContext: true } }) : null;
  const context = receiptComposeContext(receipt?.authorizationContext ?? null);
  if (context) return context;
  // A source-free header does not prove Compose: old Forward drafts also omit
  // In-Reply-To. Only acknowledged operation evidence can restore an action.
  return { draftContextRequired: true };
}

/** One bounded receipt lookup per authorized draft page, rather than one query per row. */
export async function draftComposeContexts(account: Pick<EmailAccount, 'id' | 'tenantId'>, rows: MailboxMessage[]): Promise<Map<string, RestoredDraftContext>> {
  const pairs = rows.filter(row => row.draftId).map(row => ({ providerDraftId: row.draftId!, providerMessageId: row.providerMessageId }));
  const receipts = pairs.length ? await prisma.mailboxSendReceipt.findMany({ where: { tenantId: account.tenantId, accountId: account.id,
    operation: { in: ['draft', 'schedule'] }, status: { in: ['saved', 'queued', 'cancelled'] }, OR: pairs },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { providerDraftId: true, providerMessageId: true, authorizationContext: true } }) : [];
  return new Map(rows.map(row => {
    const receipt = receipts.find(item => item.providerDraftId === row.draftId && item.providerMessageId === row.providerMessageId);
    return [row.id, receiptComposeContext(receipt?.authorizationContext ?? null) ?? { draftContextRequired: true }];
  }));
}

/** Missing action/source can inherit this operation or an exact saved draft, never the latest message in its thread. */
export async function resolveDraftOperationContext(account: Pick<EmailAccount, 'id' | 'tenantId'>, input: {
  requestId: string; draftId?: string; composeMode?: MailboxComposeMode; replyToMessageId?: string; forwardSourceMessageId?: string;
  recordContext?: MailboxRecordContext; dealId?: string;
}, scope?: { account: EmailAccount; scope: MailboxScope }): Promise<DraftContext> {
  if (input.replyToMessageId || input.forwardSourceMessageId || !input.draftId) return MailboxComposeContextSchema.parse(input);
  const previous = await prisma.mailboxSendReceipt.findUnique({ where: { accountId_requestId: { accountId: account.id, requestId: input.requestId } }, select: { authorizationContext: true } });
  const savedOperation = receiptComposeContext(previous?.authorizationContext ?? null);
  if (savedOperation) return MailboxComposeContextSchema.parse(input.composeMode ? input : savedOperation);
  const row = await prisma.mailboxMessage.findFirst({ where: { accountId: account.id, tenantId: account.tenantId, draftId: input.draftId, labels: { has: 'DRAFT' } } });
  if (!row) throw new AppError('Draft is no longer available.', 404);
  if (scope) await assertStoredMessages(scope.account, scope.scope, [row.providerMessageId]);
  const context = await draftComposeContext(account, row);
  if (context.draftContextRequired) throw new AppError('Choose the original authorized message and Reply, Reply All or Forward before using this older draft.', 409, 'MAILBOX_DRAFT_CONTEXT_REQUIRED');
  return MailboxComposeContextSchema.parse(input.composeMode ? input : context);
}
