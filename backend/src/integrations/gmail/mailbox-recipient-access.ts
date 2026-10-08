import type { EmailAccount } from '@prisma/client';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { mailboxAddress, messageInScope, scopedMessagesWhere, type MailboxScope } from './mailbox-scope';
import type { MailboxPermissions } from './mailbox-ingestion.service';

/** Read scope is insufficient for delivery. Every recipient needs current mutation access. */
export async function assertMailboxRecipients(account: EmailAccount, scope: MailboxScope, permissions: MailboxPermissions, values: string[], threadId = '') {
  if (values.length > 50) throw new AppError('Use at most 50 recipients.', 400);
  const recipients = values.map(value => mailboxAddress(value));
  if (recipients.some(address => !address)) throw new AppError('Enter valid recipient addresses.', 400);
  if (!permissions.leadsEdit && !permissions.contactsEdit) throw new AppError('Lead or Contact edit permission is required to compose customer email.', 403);
  const [leads, contacts, continuation] = await Promise.all([
    prisma.lead.findMany({ where: { tenantId: account.tenantId, id: { in: scope.leadIds } }, select: { email: true } }),
    prisma.contact.findMany({ where: { tenantId: account.tenantId, id: { in: scope.contactIds } }, select: { email: true } }),
    threadId ? prisma.mailboxMessage.findMany({ where: { AND: [scopedMessagesWhere(account, scope), { threadId }] }, select: { leadId: true, contactId: true } }) : [],
  ]);
  for (const address of recipients as string[]) {
    if (!messageInScope({ from: account.email, to: [address], threadId }, account.email, scope)) {
      throw new AppError('A recipient or Reply-To address is outside your current assigned CRM mailbox scope. Review the recipient or ask an administrator to check its assignment.', 403);
    }
    const isLead = leads.some(row => mailboxAddress(row.email ?? '') === address);
    const isContact = contacts.some(row => mailboxAddress(row.email ?? '') === address);
    const linkedLead = !isLead && !isContact && continuation.some(row => row.leadId && scope.leadIds.includes(row.leadId));
    const linkedContact = !isLead && !isContact && continuation.some(row => row.contactId && scope.contactIds.includes(row.contactId));
    if ((isLead || linkedLead) && !permissions.leadsEdit || (isContact || linkedContact) && !permissions.contactsEdit) {
      throw new AppError('Edit permission for the recipient’s CRM record is required to compose customer email.', 403);
    }
  }
}
