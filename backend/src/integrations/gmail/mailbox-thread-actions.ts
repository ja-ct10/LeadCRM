import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { authorizedMailbox, mailboxChanged } from './mailbox-store';
import { scopedMessagesWhere } from './mailbox-scope';
import { getValidAccessToken } from './gmail.service';
import { writeGmailJson } from './gmail-read';

/** Resolve message IDs server-side. Never mutate the provider thread wholesale:
 * it can also contain drafts or correspondence outside current CRM scope. */
export async function mutateMailboxThread(tenantId: string, userId: string, threadId: string, action: 'read' | 'unread' | 'archive' | 'trash') {
  return mutateMailboxThreads(tenantId, userId, [threadId], action);
}

export async function mutateMailboxThreads(tenantId: string, userId: string, threadIds: string[], action: 'read' | 'unread' | 'archive' | 'trash') {
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  const rows = await prisma.mailboxMessage.findMany({ where: { AND: [scopedMessagesWhere(account, scope), { threadId: { in: threadIds }, NOT: { labels: { has: 'DRAFT' } } }] }, select: { id: true, threadId: true, providerMessageId: true, labels: true } });
  if (new Set(rows.map(row => row.threadId)).size !== new Set(threadIds).size) throw new AppError('Conversation is no longer available in your assigned CRM mailbox scope.', 404);
  const changed = rows.filter(row => action === 'read' ? row.labels.includes('UNREAD') : action === 'unread' ? !row.labels.includes('UNREAD') : action === 'archive' ? row.labels.includes('INBOX') : true);
  if (!changed.length) return { success: true, count: 0 };
  const token = await getValidAccessToken(tenantId, userId);
  let count = 0;
  try {
    for (const row of changed) {
      const removeLabelIds = action === 'read' ? ['UNREAD'] : action === 'archive' ? ['INBOX'] : [];
      const addLabelIds = action === 'unread' ? ['UNREAD'] : action === 'trash' ? ['TRASH'] : [];
      await writeGmailJson(token, `messages/${encodeURIComponent(row.providerMessageId)}/${action === 'trash' ? 'trash' : 'modify'}`, 'POST', action === 'trash' ? undefined : { removeLabelIds, addLabelIds });
      // Commit only after provider success, without creating/changing CRM activities.
      await prisma.mailboxMessage.update({ where: { id: row.id }, data: { labels: [...new Set([...row.labels.filter(label => !removeLabelIds.includes(label)), ...addLabelIds])] } });
      count++;
    }
  } finally {
    // Successful partial progress must also reach other tabs if a later write fails.
    if (count) await mailboxChanged(account.id);
  }
  return { success: true, count };
}
