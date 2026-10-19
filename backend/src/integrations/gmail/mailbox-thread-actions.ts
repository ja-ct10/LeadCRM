import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { authorizedMailbox, mailboxChanged } from './mailbox-store';
import { mailboxAddress, scopedMessagesWhere } from './mailbox-scope';
import { getValidAccessToken } from './gmail.service';
import { writeGmailJson } from './gmail-read';
import { Prisma } from '@prisma/client';
import { correspondentCte, mailboxReadQuery } from './mailbox-conversations';
import { assertStoredMessages } from './mailbox-scope';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { MailboxConversationReadStateSchema, type MailboxConversationReadState, type MailboxBulkActionResult } from '@leadcrm/shared';
import { countUnreadConversations } from './mailbox-conversations';

type Action = 'read' | 'unread' | 'archive' | 'trash' | 'restore';

const readStatePending = new Map<string, Promise<MailboxConversationReadState>>();
const readCursorSchema = z.object({ context: z.string(), cutoff: z.string().datetime(), after: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/) }).strict();

/** Independent of history pagination, with a fixed opening-time boundary. */
export async function mutateMailboxConversationReadState(tenantId: string, userId: string, conversationId: string, input: unknown): Promise<MailboxConversationReadState> {
  const options = MailboxConversationReadStateSchema.parse(input);
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  const key = JSON.stringify([tenantId, userId, account.id, scope.hash, conversationId, options]);
  const existing = readStatePending.get(key);
  if (existing) return existing;
  const work = (async () => {
    const started = Date.now();
    let cutoff = new Date(started).toISOString(), after = '';
    const context = (boundary: string) => createHash('sha256').update(JSON.stringify([
      tenantId, userId, account.id, account.email, scope.hash, conversationId, options.isRead, boundary,
    ])).digest('hex');
    if (options.pageToken) {
      let cursor: z.infer<typeof readCursorSchema>;
      try { cursor = readCursorSchema.parse(JSON.parse(Buffer.from(options.pageToken, 'base64url').toString())); }
      catch { throw new AppError('Invalid conversation read-state page.', 400); }
      if (cursor.context !== context(cursor.cutoff)) throw new AppError('Mailbox access changed. Reopen the conversation.', 409, 'MAILBOX_SCOPE_CHANGED');
      cutoff = cursor.cutoff; after = cursor.after;
    }
    const [available] = await mailboxReadQuery<{ found: boolean }[]>(account, Prisma.sql`
      WITH ${correspondentCte(account, scope)} SELECT EXISTS(SELECT 1 FROM eligible WHERE "conversationId" = ${conversationId}) AS found`);
    if (!available.found) throw new AppError('Conversation is outside your assigned CRM mailbox scope.', 404);
    const mailbox = mailboxAddress(account.email)!;
    const targets = await mailboxReadQuery<{ id: string; providerMessageId: string; labels: string[]; fromAddress: string }[]>(account, Prisma.sql`
      WITH ${correspondentCte(account, scope)} SELECT id, "providerMessageId", labels, "fromAddress" FROM eligible
      WHERE "conversationId" = ${conversationId} AND "fromAddress" <> ${mailbox} AND ${mailbox} = ANY("recipientAddresses")
        AND ('UNREAD' = ANY(labels)) = ${options.isRead}
        AND "createdAt" <= (${cutoff}::timestamptz AT TIME ZONE 'UTC') AND "providerMessageId" > ${after}
      ORDER BY "providerMessageId" LIMIT 26`);
    const completedMessageIds: string[] = [];
    let count = 0, examined = 0;
    try {
      for (const row of targets.slice(0, 25)) {
        if (examined && Date.now() - started >= 5000) break;
        const result = await applyMessageAction(tenantId, userId, account.id, account.email, [row], options.isRead ? 'read' : 'unread', scope.hash);
        count += result.count; completedMessageIds.push(row.providerMessageId); after = row.providerMessageId; examined++;
      }
    } finally {
      if (count) await mailboxChanged(account.id);
    }
    const current = await authorizedMailbox(tenantId, userId);
    if (current.account.id !== account.id || current.scope.hash !== scope.hash) throw new AppError('Mailbox access changed. Reopen the conversation.', 409, 'MAILBOX_SCOPE_CHANGED');
    const [state] = await mailboxReadQuery<{ unread: boolean }[]>(current.account, Prisma.sql`
      WITH ${correspondentCte(current.account, current.scope)} SELECT EXISTS(SELECT 1 FROM eligible WHERE "conversationId" = ${conversationId} AND unread) AS unread`);
    return { count, completedMessageIds, isRead: !state.unread, unreadCount: await countUnreadConversations(current.account, current.scope),
      nextPageToken: targets.length > examined ? Buffer.from(JSON.stringify({ context: context(cutoff), cutoff, after })).toString('base64url') : undefined };
  })().finally(() => { readStatePending.delete(key); });
  readStatePending.set(key, work);
  return work;
}

/** Group toolbar/bulk actions cover all currently authorized non-draft messages
 * across its topics. No provider thread-wide mutation is ever issued. */
export async function mutateMailboxCorrespondents(tenantId: string, userId: string, conversationIds: string[], action: Action) {
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  const rows = await mailboxReadQuery<{ conversationId: string; providerMessageId: string; dealId: string | null }[]>(account, Prisma.sql`
    WITH ${correspondentCte(account, scope)} SELECT "conversationId", "providerMessageId", "dealId" FROM eligible
    WHERE "conversationId" IN (${Prisma.join(conversationIds)}) LIMIT 1001`);
  if (rows.length > 1000) throw new AppError('This selection exceeds 1,000 messages. Open a topic and act on that Gmail conversation.', 400);
  if (new Set(rows.map(row => row.conversationId)).size !== new Set(conversationIds).size) throw new AppError('Conversation is no longer available in your assigned CRM mailbox scope.', 404);
  const result = await mutateMailboxMessages(tenantId, userId, rows.map(row => row.providerMessageId), action, new Map(rows.map(row => [row.providerMessageId, { dealId: row.dealId, conversationId: row.conversationId }])));
  const completed = new Set(result.completedMessageIds);
  return { ...result, completedConversationIds: conversationIds.filter(id => rows.filter(row => row.conversationId === id).every(row => completed.has(row.providerMessageId))) };
}

export async function mutateMailboxMessages(tenantId: string, userId: string, messageIds: string[], action: Action, expectedGroups?: Map<string, { dealId: string | null; conversationId: string }>) {
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  await assertStoredMessages(account, scope, messageIds, true);
  const rows = await prisma.mailboxMessage.findMany({ where: { AND: [scopedMessagesWhere(account, scope), { providerMessageId: { in: messageIds }, NOT: { labels: { has: 'DRAFT' } } }] }, select: { id: true, providerMessageId: true, labels: true, fromAddress: true, recipientAddresses: true, dealId: true } });
  if (expectedGroups && rows.some(row => row.dealId !== expectedGroups.get(row.providerMessageId)?.dealId)) throw new AppError('Deal association changed. Refresh your Inbox.', 409, 'MAILBOX_SCOPE_CHANGED');
  return applyMessageAction(tenantId, userId, account.id, account.email, rows.map(row => ({ ...row, conversationId: expectedGroups?.get(row.providerMessageId)?.conversationId })), action);
}

/** Resolve message IDs server-side. Never mutate the provider thread wholesale:
 * it can also contain drafts or correspondence outside current CRM scope. */
export async function mutateMailboxThread(tenantId: string, userId: string, threadId: string, action: Action) {
  return mutateMailboxThreads(tenantId, userId, [threadId], action);
}

export async function mutateMailboxThreads(tenantId: string, userId: string, threadIds: string[], action: Action) {
  const { account, scope } = await authorizedMailbox(tenantId, userId);
  const rows = await prisma.mailboxMessage.findMany({ where: { AND: [scopedMessagesWhere(account, scope), { threadId: { in: threadIds }, NOT: { labels: { has: 'DRAFT' } } }] }, select: { id: true, threadId: true, providerMessageId: true, labels: true, fromAddress: true, recipientAddresses: true, dealId: true } });
  if (new Set(rows.map(row => row.threadId)).size !== new Set(threadIds).size) throw new AppError('Conversation is no longer available in your assigned CRM mailbox scope.', 404);
  return applyMessageAction(tenantId, userId, account.id, account.email, rows, action);
}

async function applyMessageAction(tenantId: string, userId: string, accountId: string, mailbox: string, rows: { id: string; providerMessageId: string; labels: string[]; fromAddress: string; recipientAddresses?: string[]; dealId?: string | null; conversationId?: string }[], action: Action, scopeHash?: string): Promise<MailboxBulkActionResult> {
  // Trash outbound replies before their approved fixed-sender source disappears
  // from scope. Current authorization is still rechecked before every write.
  const eligible = (row: typeof rows[number]) => action === 'read' ? row.labels.includes('UNREAD') : action === 'unread' ? !row.labels.includes('UNREAD') : action === 'archive' ? row.labels.includes('INBOX')
    : action === 'restore' ? !row.labels.includes('INBOX') && !row.labels.includes('SENT') && row.fromAddress !== mailboxAddress(mailbox) && !!row.recipientAddresses?.includes(mailboxAddress(mailbox)!) : true;
  const changed = rows.filter(eligible)
    .sort((a, b) => Number(!!a.dealId) - Number(!!b.dealId) || Number(b.fromAddress === mailboxAddress(mailbox)) - Number(a.fromAddress === mailboxAddress(mailbox)) || a.providerMessageId.localeCompare(b.providerMessageId));
  const completedMessageIds = rows.filter(row => !eligible(row)).map(row => row.providerMessageId);
  if (!changed.length) return { success: true, count: 0, completedMessageIds };
  const token = await getValidAccessToken(tenantId, userId);
  let count = 0;
  try {
    for (const row of changed) {
      // Reassignment/revocation during a long bulk operation stops later writes.
      const current = await authorizedMailbox(tenantId, userId);
      if (current.account.id !== accountId) throw new AppError('Mailbox changed. Refresh your Inbox.', 409);
      if (scopeHash && current.scope.hash !== scopeHash) throw new AppError('Mailbox access changed. Reopen the conversation.', 409, 'MAILBOX_SCOPE_CHANGED');
      await assertStoredMessages(current.account, current.scope, [row.providerMessageId], true);
      if (row.conversationId) {
        const [membership] = await mailboxReadQuery<{ found: boolean }[]>(current.account, Prisma.sql`
          WITH ${correspondentCte(current.account, current.scope)} SELECT EXISTS (
            SELECT 1 FROM eligible WHERE "providerMessageId" = ${row.providerMessageId} AND "conversationId" = ${row.conversationId}
          ) AS found`);
        if (!membership.found) throw new AppError('Deal association changed. Refresh your Inbox.', 409, 'MAILBOX_SCOPE_CHANGED');
      }
      const saved = await prisma.mailboxMessage.findUniqueOrThrow({ where: { id: row.id }, select: { labels: true, dealId: true } });
      if (row.dealId !== undefined && row.dealId !== saved.dealId) throw new AppError('Deal association changed. Refresh your Inbox.', 409, 'MAILBOX_SCOPE_CHANGED');
      if (action === 'read' && !saved.labels.includes('UNREAD') || action === 'unread' && saved.labels.includes('UNREAD')) continue;
      const removeLabelIds = action === 'read' ? ['UNREAD'] : action === 'archive' ? ['INBOX'] : [];
      const addLabelIds = action === 'unread' ? ['UNREAD'] : action === 'trash' ? ['TRASH'] : action === 'restore' ? ['INBOX'] : [];
      const provider = await writeGmailJson<{ labelIds?: string[] }>(token, `messages/${encodeURIComponent(row.providerMessageId)}/${action === 'trash' ? 'trash' : 'modify'}`, 'POST', action === 'trash' ? undefined : { removeLabelIds, addLabelIds });
      // Commit only after provider success, without creating/changing CRM activities.
      if (action === 'read' || action === 'unread') {
        await mailboxReadQuery(current.account, Prisma.sql`UPDATE "MailboxMessage" SET labels = ${action === 'read' ? Prisma.sql`array_remove(labels, 'UNREAD')` : Prisma.sql`ARRAY(SELECT DISTINCT unnest(labels || ARRAY['UNREAD']::text[]))`}
          WHERE id = ${row.id} AND "tenantId" = ${tenantId} AND "accountId" = ${accountId}`);
      } else {
        await prisma.mailboxMessage.update({ where: { id: row.id }, data: { labels: Array.isArray(provider.labelIds) ? provider.labelIds : [...new Set([...saved.labels.filter(label => !removeLabelIds.includes(label) && !(action === 'trash' && label === 'INBOX')), ...addLabelIds])] } });
      }
      count++;
      completedMessageIds.push(row.providerMessageId);
    }
  } catch (error) {
    if (!count || action === 'read' || action === 'unread') throw error;
    return { success: false, count, completedMessageIds, error: error instanceof AppError && [401, 403, 404, 409].includes(error.statusCode)
      ? 'Mailbox access or Deal association changed. Confirmed updates were saved; refresh before retrying.'
      : 'Some messages could not be updated. Refresh and retry the remaining selection.' };
  } finally {
    // Successful partial progress must also reach other tabs if a later write fails.
    if (count && !scopeHash) await mailboxChanged(accountId);
  }
  return { success: true, count, completedMessageIds };
}
