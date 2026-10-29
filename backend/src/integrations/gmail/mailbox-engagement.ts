import type { Prisma } from '@prisma/client';

/** Only saved CRM intent proves a forward. Subject/body wording is not engagement evidence. */
export function isMailboxForward(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const context = value as { composeMode?: unknown; forwardSourceMessageId?: unknown };
  return context.composeMode === 'forward' || typeof context.forwardSourceMessageId === 'string' && !!context.forwardSourceMessageId;
}

/** Keep sent history readable while excluding proven forwards from customer engagement reads. */
export async function withoutMailboxForwards(tx: Prisma.TransactionClient, account: { id: string; tenantId: string }): Promise<Prisma.MailboxMessageWhereInput> {
  const receipts = await tx.mailboxSendReceipt.findMany({ where: { tenantId: account.tenantId, accountId: account.id,
    operation: { in: ['send', 'schedule'] },
    OR: [{ authorizationContext: { path: ['composeMode'], equals: 'forward' } }, { authorizationContext: { path: ['forwardSourceMessageId'], string_starts_with: '' } }],
  }, select: { rfcMessageId: true, providerMessageId: true } });
  if (!receipts.length) return {};
  return { NOT: { accountId: account.id, OR: [
    { rfcMessageId: { not: null, in: receipts.flatMap(receipt => receipt.rfcMessageId ?? []) } },
    { providerMessageId: { in: receipts.flatMap(receipt => receipt.providerMessageId ?? []) } },
  ] } };
}
