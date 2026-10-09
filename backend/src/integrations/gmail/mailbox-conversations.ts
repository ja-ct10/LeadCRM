import { createHash } from 'node:crypto';
import { EmailAccount, Prisma } from '@prisma/client';
import { MailboxListSchema } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { mailboxAddress, MailboxScope, scopedMessagesSql } from './mailbox-scope';
import type { GmailEmail } from './gmail.types';
import { tenantContext } from '../../core/tenant/tenant-context';

type Options = ReturnType<typeof MailboxListSchema.parse>;
type Summary = {
  threadId: string; date: Date; unread: boolean; messageCount: number; authors: string[];
  id: string; from: string; to: string[]; cc: string[]; subject: string; snippet: string;
  labels: string[]; direction: GmailEmail['direction']; replyToAddress: string | null;
  leadId: string | null; contactId: string | null; dealId: string | null; needsDealAssociation: boolean;
};

function incomingUnread(account: EmailAccount) {
  const mailbox = mailboxAddress(account.email) ?? '';
  return Prisma.sql`'UNREAD' = ANY(m.labels) AND m."fromAddress" <> ${mailbox} AND ${mailbox} = ANY(m."recipientAddresses")`;
}

// Same explicit scoped-aggregation pattern as dashboard.service. The default
// client's raw-query guard stays intact; every query carries the owner, active
// account, tenant and current per-message scope before aggregating.
function mailboxReadQuery<T>(account: EmailAccount, sql: Prisma.Sql): Promise<T> {
  const tenant = tenantContext.getStore()?.tenantId;
  if (tenant && tenant !== account.tenantId) throw new AppError('Mailbox is outside this workspace.', 403);
  return tenantContext.exit(async () => await prisma.$queryRaw<T>(sql));
}

export async function countUnreadConversations(account: EmailAccount, scope: MailboxScope) {
  const [row] = await mailboxReadQuery<{ count: number }[]>(account, Prisma.sql`
    SELECT count(DISTINCT m."threadId")::int AS count FROM "MailboxMessage" m
    WHERE ${scopedMessagesSql(account, scope)} AND NOT ('DRAFT' = ANY(m.labels)) AND (${incomingUnread(account)})`);
  return row.count;
}

/** Aggregate only eligible messages before search, sorting or pagination. Never
 * fetch bodies to render rows, or expand access through a provider thread ID. */
export async function listMailboxConversations(account: EmailAccount, scope: MailboxScope, options: Options) {
  const context = createHash('sha256').update(JSON.stringify([account.id, scope.hash, options.filter, options.sort, options.query ?? ''])).digest('hex');
  let cursor: { context: string; threadId: string; date: string; unread: boolean } | undefined;
  if (options.pageToken) {
    try {
      cursor = JSON.parse(Buffer.from(options.pageToken, 'base64url').toString('utf8'));
      if (!cursor || typeof cursor.threadId !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(cursor.threadId) || typeof cursor.unread !== 'boolean' || typeof cursor.date !== 'string' || !Number.isFinite(Date.parse(cursor.date))) throw new Error();
    } catch { throw new AppError('Invalid conversation page. Refresh your Inbox.', 400); }
    if (cursor.context !== context) throw new AppError('Mailbox page changed. Reloading the first page is required.', 400, 'MAILBOX_PAGE_CHANGED');
  }
  const ascending = options.sort === 'oldest';
  const order = ascending ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const cursorDate = cursor ? Prisma.sql`(${cursor.date}::timestamptz AT TIME ZONE 'UTC')` : Prisma.sql`NULL`;
  const dateCursor = cursor ? ascending ? Prisma.sql`s.date > ${cursorDate}` : Prisma.sql`s.date < ${cursorDate}` : Prisma.sql`TRUE`;
  const activityCursor = cursor ? Prisma.sql`(${dateCursor} OR (s.date = ${cursorDate} AND s."threadId" > ${cursor.threadId}))` : Prisma.sql`TRUE`;
  const after = cursor && options.sort === 'unread'
    ? Prisma.sql`((s.unread = ${cursor.unread} AND ${activityCursor}) OR (${cursor.unread} AND NOT s.unread))`
    : activityCursor;
  const filter = options.filter === 'unread' ? Prisma.sql`s.unread` : options.filter === 'sent' ? Prisma.sql`s.sent` : Prisma.sql`TRUE`;
  // Literal text search, including recipients and any eligible message's body.
  const search = options.query ? Prisma.sql`(
    strpos(lower(m.subject), lower(${options.query})) > 0 OR strpos(lower(m.snippet), lower(${options.query})) > 0
    OR strpos(lower(m."from"), lower(${options.query})) > 0 OR strpos(lower(m.body), lower(${options.query})) > 0
    OR strpos(lower(array_to_string(m.recipients || m."ccRecipients", ' ')), lower(${options.query})) > 0)` : Prisma.sql`TRUE`;
  const rows = await mailboxReadQuery<Summary[]>(account, Prisma.sql`
    WITH eligible AS (
      SELECT m.id, m."providerMessageId", m."threadId", m."from", m.recipients, m."ccRecipients", m.subject, m.snippet,
        m."sentAt", m.labels, m.direction, m."replyToAddress", m."leadId", m."contactId", m."dealId", m."needsDealAssociation",
        (${incomingUnread(account)}) AS unread, (${search}) AS matched
      FROM "MailboxMessage" m WHERE ${scopedMessagesSql(account, scope)} AND NOT ('DRAFT' = ANY(m.labels))
    ), summaries AS (
      SELECT "threadId", max("sentAt") AS date, count(*)::int AS "messageCount", bool_or(unread) AS unread,
        bool_or(direction = 'outbound' AND 'SENT' = ANY(labels)) AS sent, bool_or(matched) AS matched,
        array_agg(DISTINCT "from" ORDER BY "from") AS authors
      FROM eligible GROUP BY "threadId"
    ), page AS (
      SELECT s.* FROM summaries s WHERE ${filter} AND s.matched AND ${after}
      ORDER BY ${options.sort === 'unread' ? Prisma.sql`s.unread DESC,` : Prisma.empty} s.date ${order}, s."threadId" ASC
      LIMIT ${options.maxResults + 1}
    )
    SELECT p.*, latest."providerMessageId" AS id, latest."from", latest.recipients AS "to", latest."ccRecipients" AS cc,
      latest.subject, latest.snippet, latest.labels, latest.direction, latest."replyToAddress", latest."leadId", latest."contactId", latest."dealId", latest."needsDealAssociation"
    FROM page p CROSS JOIN LATERAL (
      SELECT e.* FROM eligible e WHERE e."threadId" = p."threadId" ORDER BY e."sentAt" DESC, e."providerMessageId" DESC LIMIT 1
    ) latest
    ORDER BY ${options.sort === 'unread' ? Prisma.sql`p.unread DESC,` : Prisma.empty} p.date ${order}, p."threadId" ASC`);
  const visible = rows.slice(0, options.maxResults);
  const mailbox = mailboxAddress(account.email);
  const emails: GmailEmail[] = visible.map(row => {
    const names = new Map<string, string>();
    for (const author of row.authors) {
      const address = mailboxAddress(author) ?? author;
      const name = address === mailbox ? 'You' : (author.match(/^(.+?)\s*<[^<>]+>$/)?.[1] ?? author.split('@')[0]).replace(/^"|"$/g, '').trim();
      names.set(address, name);
    }
    if (names.size === 1 && names.has(mailbox ?? '')) for (const recipient of [...row.to, ...row.cc]) {
      const address = mailboxAddress(recipient);
      if (address && address !== mailbox) names.set(address, (recipient.match(/^(.+?)\s*<[^<>]+>$/)?.[1] ?? recipient.split('@')[0]).replace(/^"|"$/g, '').trim());
    }
    return { id: row.id, threadId: row.threadId, from: row.from, to: row.to, cc: row.cc, subject: row.subject, snippet: row.snippet,
      body: '', date: row.date.toISOString(), isRead: !row.unread, labels: row.labels, direction: row.direction,
      replyToAddress: row.replyToAddress, leadId: row.leadId, contactId: row.contactId, dealId: row.dealId,
      needsDealAssociation: row.needsDealAssociation, messageCount: row.messageCount, participants: [...names.values()] };
  });
  const last = visible[visible.length - 1];
  return { emails, nextPageToken: rows.length > options.maxResults && last ? Buffer.from(JSON.stringify({ context, threadId: last.threadId, date: last.date.toISOString(), unread: last.unread })).toString('base64url') : undefined };
}
