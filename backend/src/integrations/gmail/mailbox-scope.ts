import { createHash } from 'node:crypto';
import { Prisma, EmailAccount } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { normalizeEmail } from './engagement-rules';
import type { MailboxPermissions } from './mailbox-ingestion.service';
import type { GmailEmail } from './gmail.types';

export const FIXED_MAILBOX_SENDERS = ['reymarkjpanes@12066156.brevosend.com', 'info@camxian.com'];
export const MAILBOX_PARTICIPANT_POLICY_VERSION = 1;
export const MAILBOX_METADATA_HEADERS = 'metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Reply-To&metadataHeaders=Message-ID';
export function mailboxAddress(value: string): string | undefined {
  if (/[\r\n]/.test(value)) return;
  const address = normalizeEmail(value);
  return z.string().email().max(254).safeParse(address).success && !/[\s"(){}<>\\:]/.test(address) ? address : undefined;
}

export interface MailboxIdentity {
  type: 'lead' | 'contact'; id: string; address: string; assignedUserId: string | null; available: boolean;
}
export interface MailboxScope {
  addresses: string[];
  deniedAddresses: string[];
  identities: MailboxIdentity[];
  userId: string;
  mailboxAddress?: string;
  leadIds: string[];
  contactIds: string[];
  fixedThreadIds: string[];
  threadRecipients: Record<string, string[]>;
  draftSourceIds: string[];
  hash: string;
  dealsView?: boolean;
}

/** Only actual provider address headers establish participants. Never inspect body text or infer aliases. */
export function mailboxParticipants(email: Pick<GmailEmail, 'from' | 'to' | 'cc' | 'bcc' | 'replyToAddress' | 'replyToAddresses' | 'authorizationHeadersValid'>): string[] | undefined {
  if (email.authorizationHeadersValid === false) return;
  const values = [email.from, ...email.to, ...(email.cc ?? []), ...(email.bcc ?? []), ...(email.replyToAddresses ?? (email.replyToAddress ? [email.replyToAddress] : []))];
  if (values.length > 500) return;
  const addresses = values.map(mailboxAddress);
  if (addresses.some(address => !address)) return;
  return [...new Set(addresses as string[])].sort();
}

function identityAllowed(identity: MailboxIdentity, userId: string, permissions: MailboxPermissions) {
  return identity.available && identity.assignedUserId === userId && (identity.type === 'lead' ? permissions.leadsView : permissions.contactsView);
}

function deriveScope(scope: MailboxScope, permissions: MailboxPermissions): MailboxScope {
  const identities = [...scope.identities].sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id) || a.address.localeCompare(b.address));
  const deniedAddresses = [...new Set(identities.filter(identity => identity.address !== scope.mailboxAddress && !identityAllowed(identity, scope.userId, permissions)).map(identity => identity.address))].sort();
  const permitted = identities.filter(identity => identity.address !== scope.mailboxAddress && identityAllowed(identity, scope.userId, permissions) && !deniedAddresses.includes(identity.address));
  const addresses = [...new Set(permitted.map(identity => identity.address))].sort();
  const leadIds = permitted.filter(identity => identity.type === 'lead').map(identity => identity.id).sort();
  const contactIds = permitted.filter(identity => identity.type === 'contact').map(identity => identity.id).sort();
  const hash = createHash('sha256').update(JSON.stringify([MAILBOX_PARTICIPANT_POLICY_VERSION, scope.userId, scope.mailboxAddress, permissions, identities, addresses, deniedAddresses])).digest('hex');
  return { ...scope, identities, addresses, deniedAddresses, leadIds, contactIds, hash, dealsView: permissions.dealsView };
}

/** Run Check may project a validated earlier CRM assignment; independent duplicate identities still veto. */
export function projectMailboxScope(scope: MailboxScope, permissions: MailboxPermissions, projection: { type: 'lead' | 'contact'; id: string; email: string; assignedUserId: string | null }): MailboxScope {
  const address = mailboxAddress(projection.email);
  if (!address) throw new AppError('Enter a valid CRM email address.', 400);
  const identities = scope.identities.filter(identity => identity.type !== projection.type || identity.id !== projection.id);
  identities.push({ type: projection.type, id: projection.id, address, assignedUserId: projection.assignedUserId, available: true });
  return deriveScope({ ...scope, identities }, permissions);
}

/** Read all same-tenant identity matches, including unauthorized/archived records. Admin access never changes assignment. */
export async function resolveMailboxScope(account: EmailAccount, permissions: MailboxPermissions, db: Prisma.TransactionClient = prisma): Promise<MailboxScope> {
  const [leads, contacts] = await Promise.all([
    db.lead.findMany({ where: { tenantId: account.tenantId }, select: { id: true, email: true, assignedUserId: true, isArchived: true, deletedAt: true, convertedAt: true, contactId: true } }),
    db.contact.findMany({ where: { tenantId: account.tenantId }, select: { id: true, email: true, assignedUserId: true, isArchived: true, deletedAt: true } }),
  ]);
  const identities: MailboxIdentity[] = contacts.flatMap(row => {
    const address = mailboxAddress(row.email ?? '');
    return address ? [{ type: 'contact' as const, id: row.id, address, assignedUserId: row.assignedUserId, available: !row.isArchived && !row.deletedAt }] : [];
  });
  for (const row of leads) {
    const address = mailboxAddress(row.email ?? '');
    if (!address) continue;
    // A converted source with the same canonical address is the Contact, not an independent duplicate.
    // An obsolete source address grants nothing; retaining its denial evidence avoids a fixed-sender bypass.
    const converted = row.convertedAt && row.contactId ? contacts.find(contact => contact.id === row.contactId) : undefined;
    if (converted && mailboxAddress(converted.email ?? '') === address) continue;
    identities.push({ type: 'lead', id: row.id, address, assignedUserId: row.assignedUserId, available: !row.convertedAt && !row.isArchived && !row.deletedAt });
  }
  const scope = deriveScope({ userId: account.userId, mailboxAddress: mailboxAddress(account.email), identities, addresses: [], deniedAddresses: [], leadIds: [], contactIds: [], fixedThreadIds: [], threadRecipients: {}, draftSourceIds: [], hash: '' }, permissions);
  const fixed = await db.mailboxMessage.findMany({ where: { tenantId: account.tenantId, accountId: account.id,
    fromAddress: { in: FIXED_MAILBOX_SENDERS }, participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION,
    NOT: [{ labels: { hasSome: ['SPAM', 'TRASH', 'DELETED', 'DRAFT'] } }, { authorizationParticipants: { hasSome: scope.deniedAddresses } }],
  }, distinct: ['threadId'], select: { threadId: true } });
  scope.fixedThreadIds = fixed.map(row => row.threadId);
  const linked = await db.mailboxMessage.findMany({ where: { tenantId: account.tenantId, accountId: account.id,
    OR: [{ leadId: { in: scope.leadIds } }, { contactId: { in: scope.contactIds } }], participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION,
    NOT: [{ labels: { hasSome: ['SPAM', 'TRASH', 'DELETED', 'DRAFT'] } }, { authorizationParticipants: { hasSome: scope.deniedAddresses } }],
  }, select: { threadId: true, fromAddress: true, recipientAddresses: true } });
  for (const row of linked) {
    const participants = row.fromAddress === mailboxAddress(account.email) ? row.recipientAddresses : [row.fromAddress];
    const permitted = participants.filter(address => scope.addresses.includes(address));
    if (permitted.length) scope.threadRecipients[row.threadId] = [...new Set([...(scope.threadRecipients[row.threadId] ?? []), ...permitted])];
  }
  const drafts = await db.mailboxMessage.findMany({ where: { tenantId: account.tenantId, accountId: account.id, draftId: { not: null }, sourceMessageId: { not: null } }, select: { sourceMessageId: true }, distinct: ['sourceMessageId'] });
  if (drafts.length) {
    const sources = await db.mailboxMessage.findMany({ where: { AND: [scopedMessagesWhere(account, scope), { providerMessageId: { in: drafts.flatMap(row => row.sourceMessageId ?? []) }, NOT: { labels: { has: 'DRAFT' } } }] }, select: { providerMessageId: true } });
    scope.draftSourceIds = sources.map(row => row.providerMessageId);
  }
  return scope;
}

export function messageInScope(email: Pick<GmailEmail, 'from' | 'to' | 'cc' | 'threadId' | 'bcc' | 'replyToAddress' | 'replyToAddresses' | 'authorizationHeadersValid'> & { labels?: string[]; crmDraft?: boolean }, mailbox: string, scope: MailboxScope): boolean {
  const participants = mailboxParticipants(email);
  if (!participants || participants.some(address => address !== mailboxAddress(mailbox) && scope.deniedAddresses.includes(address))) return false;
  const from = mailboxAddress(email.from)!;
  if (email.labels?.includes('DRAFT') && from !== mailboxAddress(mailbox)) return false;
  if (from !== mailboxAddress(mailbox)) return FIXED_MAILBOX_SENDERS.includes(from) || scope.addresses.includes(from);
  const recipients = [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])].flatMap(value => mailboxAddress(value) ?? []);
  return recipients.some(address => scope.addresses.includes(address)) ||
    recipients.some(address => scope.threadRecipients[email.threadId]?.includes(address)) ||
    scope.fixedThreadIds.includes(email.threadId) && recipients.some(address => FIXED_MAILBOX_SENDERS.includes(address)) ||
    !!email.labels?.includes('DRAFT') && email.crmDraft === true && recipients.length === 0;
}

export function scopedMessagesWhere(account: EmailAccount, scope: MailboxScope, includeTrashedActivity = false): Prisma.MailboxMessageWhereInput {
  const deniedAddresses = scope.deniedAddresses.filter(address => address !== mailboxAddress(account.email));
  return { tenantId: account.tenantId, accountId: account.id, account: { isActive: true }, participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION,
    NOT: [{ labels: { hasSome: includeTrashedActivity ? ['SPAM', 'DELETED'] : ['SPAM', 'TRASH', 'DELETED'] } }, { authorizationParticipants: { hasSome: deniedAddresses } }],
    AND: [{ OR: [{ NOT: { labels: { has: 'DRAFT' } } }, { sourceMessageId: null }, { sourceMessageId: { in: scope.draftSourceIds } }] }],
    OR: [
      { fromAddress: { in: [...FIXED_MAILBOX_SENDERS, ...scope.addresses], not: mailboxAddress(account.email) }, NOT: { labels: { has: 'DRAFT' } } },
      { fromAddress: mailboxAddress(account.email), OR: [
        { recipientAddresses: { hasSome: scope.addresses } },
        ...Object.entries(scope.threadRecipients).map(([threadId, addresses]) => ({ threadId, recipientAddresses: { hasSome: addresses } })),
        { threadId: { in: scope.fixedThreadIds }, recipientAddresses: { hasSome: FIXED_MAILBOX_SENDERS } },
        { labels: { has: 'DRAFT' }, crmDraft: true, recipientAddresses: { isEmpty: true } },
      ] },
    ] };
}

/** SQL and ORM both apply the participant veto before returning/searching/aggregating any messages. */
export function scopedMessagesSql(account: EmailAccount, scope: MailboxScope, includeTrashedActivity = false): Prisma.Sql {
  const array = (values: string[]) => values.length ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]` : Prisma.sql`ARRAY[]::text[]`;
  const mailbox = mailboxAddress(account.email) ?? '';
  const continuity = Object.entries(scope.threadRecipients).map(([threadId, addresses]) => Prisma.sql`(m."threadId" = ${threadId} AND m."recipientAddresses" && ${array(addresses)})`);
  return Prisma.sql`m."tenantId" = ${account.tenantId} AND m."accountId" = ${account.id}
    AND EXISTS (SELECT 1 FROM "EmailAccount" a WHERE a.id = m."accountId" AND a."tenantId" = m."tenantId" AND a."userId" = ${account.userId} AND a."isActive")
    AND m."participantPolicyVersion" = ${MAILBOX_PARTICIPANT_POLICY_VERSION}
    AND NOT (m."authorizationParticipants" && ${array(scope.deniedAddresses.filter(address => address !== mailbox))})
    AND NOT (m.labels && ${includeTrashedActivity ? Prisma.sql`ARRAY['SPAM', 'DELETED']::text[]` : Prisma.sql`ARRAY['SPAM', 'TRASH', 'DELETED']::text[]`})
    AND (NOT ('DRAFT' = ANY(m.labels)) OR m."sourceMessageId" IS NULL OR m."sourceMessageId" = ANY(${array(scope.draftSourceIds)}))
    AND ((m."fromAddress" = ANY(${array([...FIXED_MAILBOX_SENDERS, ...scope.addresses])}) AND m."fromAddress" <> ${mailbox} AND NOT ('DRAFT' = ANY(m.labels)))
      OR (m."fromAddress" = ${mailbox} AND (m."recipientAddresses" && ${array(scope.addresses)}
        ${continuity.length ? Prisma.sql`OR ${Prisma.join(continuity, ' OR ')}` : Prisma.empty}
        OR (m."threadId" = ANY(${array(scope.fixedThreadIds)}) AND m."recipientAddresses" && ${array(FIXED_MAILBOX_SENDERS)})
        OR ('DRAFT' = ANY(m.labels) AND m."crmDraft" AND cardinality(m."recipientAddresses") = 0))))`;
}

export function mailboxProviderQueries(scope: MailboxScope): string[] {
  const terms = [...new Set([...FIXED_MAILBOX_SENDERS, ...scope.addresses])].map(address => `from:${address}`);
  for (const address of new Set([...scope.addresses, ...Object.values(scope.threadRecipients).flat()])) terms.push(`to:${address}`, `cc:${address}`, `bcc:${address}`);
  for (const address of FIXED_MAILBOX_SENDERS) terms.push(`to:${address}`);
  const queries: string[] = [];
  let chunk: string[] = [], length = 0;
  for (const term of terms) {
    if (chunk.length >= 40 || length + term.length > 3000) { queries.push(`-in:spam -in:trash {${chunk.join(' ')}}`); chunk = []; length = 0; }
    chunk.push(term); length += term.length + 1;
  }
  if (chunk.length) queries.push(`-in:spam -in:trash {${chunk.join(' ')}}`);
  return queries;
}

export async function assertStoredMessages(account: EmailAccount, scope: MailboxScope, ids: string[], excludeDrafts = false, db: Prisma.TransactionClient = prisma) {
  const found = await db.mailboxMessage.findMany({ where: { AND: [scopedMessagesWhere(account, scope), { providerMessageId: { in: ids } }, ...(excludeDrafts ? [{ NOT: { labels: { has: 'DRAFT' } } }] : [])] }, select: { providerMessageId: true } });
  if (new Set(found.map(row => row.providerMessageId)).size !== new Set(ids).size) throw new AppError('Email is outside your assigned CRM mailbox scope.', 404);
}
