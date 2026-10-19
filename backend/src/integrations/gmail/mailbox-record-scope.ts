import type { RecordEmailAttachmentContext } from '@leadcrm/shared';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/database.config';
import { assertPermissions } from '../../core/permissions/permission.service';
import { AppError } from '../../shared/errors/app-error';
import { authorizedMailbox } from './mailbox-store';
import { scopedMessagesWhere } from './mailbox-scope';
import { conversationContext, mailboxDealMessageIds } from './mailbox-conversations';

/** Share the stored association boundary between listing and contextual byte reads. */
export async function recordMailboxScope(tenantId: string, userId: string, context: RecordEmailAttachmentContext) {
  const user = await prisma.user.findFirst({ where: { tenantId, id: userId }, select: { role: true } });
  if (!user) throw new AppError('Access denied', 403);
  await assertPermissions({ tenantId, userId, role: user.role }, [`${context.recordModule}.view`]);
  const recordWhere = { tenantId, id: context.recordId, isArchived: false, deletedAt: null };
  const record = context.recordModule === 'leads' ? await prisma.lead.findFirst({ where: recordWhere, select: { id: true } })
    : context.recordModule === 'contacts' ? await prisma.contact.findFirst({ where: recordWhere, select: { id: true } })
    : await prisma.deal.findFirst({ where: recordWhere, select: { id: true } });
  if (!record) throw new AppError('Record not found.', 404);
  const access = await authorizedMailbox(tenantId, userId);
  if (context.accountId && context.accountId !== access.account.id) throw new AppError('Mailbox changed. Reload files.', 409, 'MAILBOX_SCOPE_CHANGED');
  let association: Prisma.MailboxMessageWhereInput;
  if (context.recordModule === 'leads') association = { leadId: record.id };
  else if (context.recordModule === 'contacts') {
    const sources = await prisma.lead.findMany({ where: { tenantId, contactId: record.id, convertedAt: { not: null } }, select: { id: true } });
    association = { OR: [{ contactId: record.id }, { leadId: { in: sources.map(row => row.id).sort() } }] };
  } else {
    association = { id: { in: await mailboxDealMessageIds(access.account, access.scope, record.id) } };
  }
  const where: Prisma.MailboxMessageWhereInput = { AND: [scopedMessagesWhere(access.account, access.scope), { NOT: { labels: { has: 'DRAFT' } } }, association] };
  return { ...access, where, contextHash: conversationContext(access.account, access.scope, [context.recordModule, record.id, association]) };
}

export async function assertRecordMailboxMessage(tenantId: string, userId: string, messageId: string, context: RecordEmailAttachmentContext) {
  const access = await recordMailboxScope(tenantId, userId, context);
  if (!await prisma.mailboxMessage.findFirst({ where: { AND: [access.where, { providerMessageId: messageId }] }, select: { id: true } })) {
    throw new AppError('Attachment is not linked to this record.', 404);
  }
}
