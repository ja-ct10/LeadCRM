import type { EmailAccount, Prisma } from '@prisma/client';
import { MailboxComposeContextSchema } from '@leadcrm/shared';
import { z } from 'zod';
import { requireEmployeeAccount } from '../../core/auth/account-access';
import { AppError } from '../../shared/errors/app-error';
import { normalizeEmail } from './engagement-rules';

export interface MailboxForwardProof {
  rfcMessageId: string | null; providerMessageId: string | null;
  sender: string; recipients: string[]; participants: string[]; sourceMessageId: string;
}

/** Provisioned staff identity is independent of CRM assignment and Gmail connection. */
export async function mailboxForwardEmployees(db: Prisma.TransactionClient, tenantId: string, customerEmails: string[]) {
  const users = await db.user.findMany({ where: { tenantId }, select: { id: true, tenantId: true, email: true, role: true, status: true } });
  const eligible = await Promise.all(users.map(async user => {
    if (user.tenantId !== tenantId) return;
    try { await requireEmployeeAccount(user, db); return { email: normalizeEmail(user.email), active: user.status === 'ACTIVE' }; }
    catch (error) {
      if (error instanceof AppError && ['EMPLOYEE_ACCOUNT_REQUIRED', 'ROLE_RETIRED'].includes(error.code ?? '')) return;
      throw error;
    }
  }));
  const employeeEmails = [...new Set(eligible.flatMap(user => user ? [user.email] : []))].sort();
  const activeEmails = new Set(eligible.flatMap(user => user?.active ? [user.email] : []));
  const customers = new Set(customerEmails.map(normalizeEmail));
  const forwardHistoryRecipientEmails = employeeEmails.filter(email => !customers.has(email));
  // Deactivation prevents new delivery, while the owner can still review Sent and fix saved drafts.
  return { employeeEmails, forwardHistoryRecipientEmails, forwardRecipientEmails: forwardHistoryRecipientEmails.filter(email => activeEmails.has(email)) };
}

/** A same-tenant receipt proves an exact copy, never general access to employee mail. */
export async function mailboxForwardProofs(db: Prisma.TransactionClient, account: EmailAccount, employees: string[], recipients: string[]): Promise<MailboxForwardProof[]> {
  const mailbox = normalizeEmail(account.email);
  const receipts = await db.mailboxSendReceipt.findMany({ where: {
    tenantId: account.tenantId, account: { tenantId: account.tenantId }, operation: { in: ['draft', 'send', 'schedule'] },
    OR: [{ status: { in: ['sending', 'uncertain', 'saved', 'queued', 'sent', 'cancelled'] } },
      { status: 'failed', operation: { in: ['draft', 'schedule'] }, providerDraftId: { not: null } }],
    AND: [
      { OR: [{ accountId: account.id }, { authorizationContext: { path: ['recipients'], array_contains: [mailbox] } }] },
      { OR: [{ authorizationContext: { path: ['composeMode'], equals: 'forward' } }, { authorizationContext: { path: ['forwardSourceMessageId'], string_starts_with: '' } }] },
    ],
  }, orderBy: { id: 'asc' }, select: { accountId: true, account: { select: { email: true } }, authorizationContext: true, rfcMessageId: true, providerMessageId: true } });
  return receipts.flatMap(receipt => {
    const context = MailboxComposeContextSchema.safeParse(receipt.authorizationContext);
    const values = z.object({ recipients: z.array(z.string().email()).max(50) }).safeParse(receipt.authorizationContext);
    if (!context.success || context.data.composeMode !== 'forward' || !values.success) return [];
    if (!receipt.rfcMessageId && (receipt.accountId !== account.id || !receipt.providerMessageId)) return [];
    const sender = normalizeEmail(receipt.account.email), targets = [...new Set(values.data.recipients.map(normalizeEmail))].sort();
    if (!employees.includes(sender) || targets.some(email => !recipients.includes(email)) || receipt.accountId !== account.id && !targets.includes(mailbox)) return [];
    return [{ sender, recipients: targets, participants: [...new Set([sender, ...targets])].sort(), sourceMessageId: context.data.forwardSourceMessageId!,
      rfcMessageId: receipt.rfcMessageId, providerMessageId: receipt.accountId === account.id ? receipt.providerMessageId : null }];
  });
}
