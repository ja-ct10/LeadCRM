import { createHash } from 'node:crypto';
import { Prisma, EmailAccount, type MailboxMessage } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { normalizeEmail } from './engagement-rules';
import type { MailboxPermissions } from './mailbox-ingestion.service';
import type { GmailEmail } from './gmail.types';
import { crmActor } from '../../modules/crm/access/crm-record-access.service';
import { mailboxForwardEmployees, mailboxForwardProofs, type MailboxForwardProof } from './mailbox-forward-access';

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
  internalOnly?: boolean;
  dealsView?: boolean;
  employeeEmails?: string[];
  forwardRecipientEmails?: string[];
  forwardProofs?: MailboxForwardProof[];
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
  return identity.available && (permissions.clientAdmin === true || identity.assignedUserId === userId) && (identity.type === 'lead' ? permissions.leadsView : permissions.contactsView);
}

function deriveScope(scope: MailboxScope, permissions: MailboxPermissions): MailboxScope {
  const identities = [...scope.identities].sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id) || a.address.localeCompare(b.address));
  const deniedAddresses = [...new Set(identities.filter(identity => identity.address !== scope.mailboxAddress && !identityAllowed(identity, scope.userId, permissions)).map(identity => identity.address))].sort();
  const permitted = identities.filter(identity => identity.address !== scope.mailboxAddress && identityAllowed(identity, scope.userId, permissions) && !deniedAddresses.includes(identity.address));
  const addresses = [...new Set(permitted.map(identity => identity.address))].sort();
  const leadIds = permitted.filter(identity => identity.type === 'lead').map(identity => identity.id).sort();
  const contactIds = permitted.filter(identity => identity.type === 'contact').map(identity => identity.id).sort();
  const flags = Object.entries({ ...permissions, clientAdmin: permissions.clientAdmin === true }).sort(([a], [b]) => a.localeCompare(b));
  const hash = createHash('sha256').update(JSON.stringify([MAILBOX_PARTICIPANT_POLICY_VERSION, 'employee-forward-v2', scope.internalOnly, scope.userId, scope.mailboxAddress, flags, identities, addresses, deniedAddresses,
    scope.employeeEmails, scope.forwardRecipientEmails, scope.forwardProofs])).digest('hex');
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

/** Read all same-tenant matches. Archived or unavailable duplicate identities still veto access. */
export async function resolveMailboxScope(account: EmailAccount, permissions: MailboxPermissions, db: Prisma.TransactionClient = prisma): Promise<MailboxScope> {
  const readIdentities = () => Promise.all([
    db.lead.findMany({ where: { tenantId: account.tenantId }, select: { id: true, email: true, assignedUserId: true, isArchived: true, deletedAt: true, convertedAt: true, contactId: true } }),
    db.contact.findMany({ where: { tenantId: account.tenantId }, select: { id: true, email: true, assignedUserId: true, isArchived: true, deletedAt: true } }),
  ]);
  // Assignment-scoped CRM reads must not hide a participant that vetoes mail access.
  // Keep tenant filters and mutation guards; only this internal metadata lookup reads all identities.
  const actor = crmActor.getStore();
  const [leads, contacts] = actor ? await crmActor.run({ ...actor, readRecords: false }, readIdentities) : await readIdentities();
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
  // This tenant-only identity lookup must also see inactive staff for existing
  // copies; ordinary User archive permissions must not erase mailbox history.
  const readEmployees = () => mailboxForwardEmployees(db, account.tenantId, [...leads, ...contacts].flatMap(row => row.email ?? []));
  const { forwardHistoryRecipientEmails, ...employees } = actor ? await crmActor.run({ ...actor, readRecords: false }, readEmployees) : await readEmployees();
  const forwardProofs = await mailboxForwardProofs(db, account, employees.employeeEmails, forwardHistoryRecipientEmails);
  const scope = deriveScope({ internalOnly: account.isActive === false, userId: account.userId, mailboxAddress: mailboxAddress(account.email), identities, ...employees, forwardProofs, addresses: [], deniedAddresses: [], leadIds: [], contactIds: [], fixedThreadIds: [], threadRecipients: {}, draftSourceIds: [], hash: '' }, permissions);
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
    const ids = drafts.flatMap(row => row.sourceMessageId ?? []);
    const sources = await db.mailboxMessage.findMany({ where: { AND: [scopedMessagesWhere(account, scope), { OR: ids.map(id => mailboxMessageIdentity(scope, id)) }, { NOT: { labels: { has: 'DRAFT' } } }] }, select: { providerMessageId: true, rfcMessageId: true } });
    scope.draftSourceIds = ids.filter(id => sources.some(row => row.providerMessageId === id || scope.forwardProofs?.some(proof => id === `internal_${proof.receiptId}` && !!proof.rfcMessageId && proof.rfcMessageId === row.rfcMessageId)));
  }
  return scope;
}

type ScopedEmail = Pick<GmailEmail, 'from' | 'to' | 'cc' | 'threadId' | 'bcc' | 'replyToAddress' | 'replyToAddresses' | 'authorizationHeadersValid' | 'rfcMessageId'> & { id?: string; labels?: string[]; crmDraft?: boolean };

export function matchingMailboxForward(email: ScopedEmail, scope: MailboxScope): MailboxForwardProof | undefined {
  const participants = mailboxParticipants(email);
  if (!participants) return;
  const recipients = [...new Set([...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])].flatMap(value => mailboxAddress(value) ?? []))].sort();
  return scope.forwardProofs?.find(proof => (proof.rfcMessageId && proof.rfcMessageId === email.rfcMessageId || proof.providerMessageId && proof.providerMessageId === email.id)
    && proof.sender === mailboxAddress(email.from) && JSON.stringify(proof.recipients) === JSON.stringify(recipients)
    && JSON.stringify(proof.participants) === JSON.stringify(participants) && (recipients.length > 0 || email.labels?.includes('DRAFT')));
}

export function storedInternalProof(row: Pick<MailboxMessage, 'providerMessageId' | 'rfcMessageId' | 'fromAddress' | 'recipientAddresses' | 'authorizationParticipants' | 'labels'>, scope: MailboxScope) {
  return scope.forwardProofs?.find(proof => (proof.rfcMessageId && proof.rfcMessageId === row.rfcMessageId || proof.providerMessageId && proof.providerMessageId === row.providerMessageId)
    && proof.sender === row.fromAddress && JSON.stringify(proof.recipients) === JSON.stringify(row.recipientAddresses)
    && JSON.stringify(proof.participants) === JSON.stringify(row.authorizationParticipants));
}

/** A local receipt identity remains a valid source after its provider identity arrives. */
export function mailboxMessageIdentity(scope: MailboxScope, id: string): Prisma.MailboxMessageWhereInput {
  const proof = scope.forwardProofs?.find(proof => proof.completed && id === `internal_${proof.receiptId}` && proof.rfcMessageId);
  return proof ? { OR: [{ providerMessageId: id }, { rfcMessageId: proof.rfcMessageId }] } : { providerMessageId: id };
}

export async function resolveMailboxMessage(account: EmailAccount, scope: MailboxScope, id: string, excludeDrafts = true, db: Prisma.TransactionClient = prisma) {
  const row = await db.mailboxMessage.findFirst({ where: { AND: [scopedMessagesWhere(account, scope), mailboxMessageIdentity(scope, id), ...(excludeDrafts ? [{ NOT: { labels: { has: 'DRAFT' } } }] : [])] } });
  if (!row) throw new AppError('Email is outside your assigned CRM mailbox scope.', 404);
  return row;
}

export function messageInScope(email: ScopedEmail, mailbox: string, scope: MailboxScope): boolean {
  const participants = mailboxParticipants(email);
  if (!participants || participants.some(address => address !== mailboxAddress(mailbox) && scope.deniedAddresses.includes(address))) return false;
  const from = mailboxAddress(email.from)!;
  if (email.labels?.includes('DRAFT') && from !== mailboxAddress(mailbox)) return false;
  if (matchingMailboxForward(email, scope)) return true;
  if (scope.internalOnly) return false;
  if (from !== mailboxAddress(mailbox)) return FIXED_MAILBOX_SENDERS.includes(from) || scope.addresses.includes(from);
  const recipients = [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])].flatMap(value => mailboxAddress(value) ?? []);
  return recipients.some(address => scope.addresses.includes(address)) ||
    recipients.some(address => scope.threadRecipients[email.threadId]?.includes(address)) ||
    scope.fixedThreadIds.includes(email.threadId) && recipients.some(address => FIXED_MAILBOX_SENDERS.includes(address)) ||
    !!email.labels?.includes('DRAFT') && email.crmDraft === true && recipients.length === 0;
}

export function scopedMessagesWhere(account: EmailAccount, scope: MailboxScope, includeTrashedActivity = false): Prisma.MailboxMessageWhereInput {
  const deniedAddresses = scope.deniedAddresses.filter(address => address !== mailboxAddress(account.email));
  const result: Prisma.MailboxMessageWhereInput = { tenantId: account.tenantId, accountId: account.id, account: { tenantId: account.tenantId, userId: account.userId, ...(scope.internalOnly ? {} : { isActive: true }) }, participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION,
    NOT: [{ labels: { hasSome: includeTrashedActivity ? ['SPAM', 'DELETED'] : ['SPAM', 'TRASH', 'DELETED'] } }, { authorizationParticipants: { hasSome: deniedAddresses } }],
    AND: [{ OR: [{ NOT: { labels: { has: 'DRAFT' } } }, { sourceMessageId: null }, { sourceMessageId: { in: scope.draftSourceIds } }] }],
    OR: [
      ...(scope.forwardProofs ?? []).map(proof => ({ fromAddress: proof.sender, recipientAddresses: { equals: proof.recipients }, authorizationParticipants: { equals: proof.participants },
        ...(proof.recipients.length ? {} : { labels: { has: 'DRAFT' } }),
        ...(proof.sender === mailboxAddress(account.email) ? {} : { NOT: { labels: { has: 'DRAFT' } } }),
        OR: [...(proof.rfcMessageId ? [{ rfcMessageId: proof.rfcMessageId }] : []), ...(proof.providerMessageId ? [{ providerMessageId: proof.providerMessageId }] : [])] })),
      { fromAddress: { in: [...FIXED_MAILBOX_SENDERS, ...scope.addresses], not: mailboxAddress(account.email) }, NOT: { labels: { has: 'DRAFT' } } },
      { fromAddress: mailboxAddress(account.email), OR: [
        { recipientAddresses: { hasSome: scope.addresses } },
        ...Object.entries(scope.threadRecipients).map(([threadId, addresses]) => ({ threadId, recipientAddresses: { hasSome: addresses } })),
        { threadId: { in: scope.fixedThreadIds }, recipientAddresses: { hasSome: FIXED_MAILBOX_SENDERS } },
        { labels: { has: 'DRAFT' }, crmDraft: true, recipientAddresses: { isEmpty: true } },
      ] },
    ] };
  if (scope.internalOnly) result.OR = scope.forwardProofs?.length ? result.OR!.slice(0, scope.forwardProofs.length) : [{ id: { in: [] } }];
  return result;
}

/** SQL and ORM both apply the participant veto before returning/searching/aggregating any messages. */
export function scopedMessagesSql(account: EmailAccount, scope: MailboxScope, includeTrashedActivity = false): Prisma.Sql {
  const array = (values: string[]) => values.length ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]` : Prisma.sql`ARRAY[]::text[]`;
  const mailbox = mailboxAddress(account.email) ?? '';
  const continuity = Object.entries(scope.threadRecipients).map(([threadId, addresses]) => Prisma.sql`(m."threadId" = ${threadId} AND m."recipientAddresses" && ${array(addresses)})`);
  const forwards = (scope.forwardProofs ?? []).map(proof => Prisma.sql`(m."fromAddress" = ${proof.sender}
    AND m."recipientAddresses" = ${array(proof.recipients)} AND m."authorizationParticipants" = ${array(proof.participants)}
    AND (${proof.sender === mailbox} OR NOT ('DRAFT' = ANY(m.labels)))
    AND (${proof.recipients.length > 0} OR 'DRAFT' = ANY(m.labels))
    AND ((m."rfcMessageId" IS NOT NULL AND m."rfcMessageId" = ${proof.rfcMessageId}) OR m."providerMessageId" = ${proof.providerMessageId}))`);
  return Prisma.sql`m."tenantId" = ${account.tenantId} AND m."accountId" = ${account.id}
    AND EXISTS (SELECT 1 FROM "EmailAccount" a WHERE a.id = m."accountId" AND a."tenantId" = m."tenantId" AND a."userId" = ${account.userId} AND (${!!scope.internalOnly} OR a."isActive"))
    AND m."participantPolicyVersion" = ${MAILBOX_PARTICIPANT_POLICY_VERSION}
    AND NOT (m."authorizationParticipants" && ${array(scope.deniedAddresses.filter(address => address !== mailbox))})
    AND NOT (m.labels && ${includeTrashedActivity ? Prisma.sql`ARRAY['SPAM', 'DELETED']::text[]` : Prisma.sql`ARRAY['SPAM', 'TRASH', 'DELETED']::text[]`})
    AND (NOT ('DRAFT' = ANY(m.labels)) OR m."sourceMessageId" IS NULL OR m."sourceMessageId" = ANY(${array(scope.draftSourceIds)}))
    AND ((${!scope.internalOnly} AND ((m."fromAddress" = ANY(${array([...FIXED_MAILBOX_SENDERS, ...scope.addresses])}) AND m."fromAddress" <> ${mailbox} AND NOT ('DRAFT' = ANY(m.labels)))
      OR (m."fromAddress" = ${mailbox} AND (m."recipientAddresses" && ${array(scope.addresses)}
        ${continuity.length ? Prisma.sql`OR ${Prisma.join(continuity, ' OR ')}` : Prisma.empty}
        OR (m."threadId" = ANY(${array(scope.fixedThreadIds)}) AND m."recipientAddresses" && ${array(FIXED_MAILBOX_SENDERS)})
        OR ('DRAFT' = ANY(m.labels) AND m."crmDraft" AND cardinality(m."recipientAddresses") = 0)))))
      ${forwards.length ? Prisma.sql`OR ${Prisma.join(forwards, ' OR ')}` : Prisma.empty})`;
}

export function mailboxProviderQueries(scope: MailboxScope): string[] {
  const terms = [...new Set([...FIXED_MAILBOX_SENDERS, ...scope.addresses])].map(address => `from:${address}`);
  for (const address of new Set([...scope.addresses, ...Object.values(scope.threadRecipients).flat()])) terms.push(`to:${address}`, `cc:${address}`, `bcc:${address}`);
  for (const address of FIXED_MAILBOX_SENDERS) terms.push(`to:${address}`);
  for (const id of new Set((scope.forwardProofs ?? []).flatMap(proof => proof.rfcMessageId ?? []))) terms.push(`rfc822msgid:${id}`);
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
  if (ids.some(id => id.startsWith('internal_'))) {
    for (const id of new Set(ids)) await resolveMailboxMessage(account, scope, id, excludeDrafts, db);
    return;
  }
  const found = await db.mailboxMessage.findMany({ where: { AND: [scopedMessagesWhere(account, scope), { providerMessageId: { in: ids } }, ...(excludeDrafts ? [{ NOT: { labels: { has: 'DRAFT' } } }] : [])] }, select: { providerMessageId: true } });
  if (new Set(found.map(row => row.providerMessageId)).size !== new Set(ids).size) throw new AppError('Email is outside your assigned CRM mailbox scope.', 404);
}
