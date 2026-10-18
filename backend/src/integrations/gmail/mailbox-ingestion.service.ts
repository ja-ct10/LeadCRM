import { hasQualifiedDeal, recordStaffOutreach } from '../../modules/crm/customer-classification.service';
import { FIXED_MAILBOX_SENDERS, mailboxAddress, mailboxParticipants, messageInScope, resolveMailboxScope, scopedMessagesWhere, MAILBOX_PARTICIPANT_POLICY_VERSION } from './mailbox-scope';
import { EmailAccount, MailboxMessage, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { normalizeCrmStatus } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { salesTransaction } from '../../modules/crm/leads/lead-automation.service';
import { CustomerLink, changeCustomerStatus, customerDealWhere } from '../../modules/crm/engagement.service';
import { engagementStatus, engagementReason, normalizeEmail, ENGAGEMENT_RULE_VERSION, DAY_MS } from './engagement-rules';
import { GmailEmail } from './gmail.types';
import { fireLeadStatusChanged, fireContactStatusChanged } from '../../modules/automation/triggers/triggers.service';
import { mailboxPermissions } from './mailbox-sync.service';

export interface MailboxPermissions { leadsView: boolean; contactsView: boolean; leadsEdit: boolean; contactsEdit: boolean; dealsEdit: boolean; dealsView: boolean }
type Tx = Prisma.TransactionClient;

/** Persist provider history independently of permission to edit CRM engagement. */
async function persistEmailActivity(tx: Tx, account: EmailAccount, stored: MailboxMessage) {
  const link = stored.contactId ? { contactId: stored.contactId } : stored.leadId ? { leadId: stored.leadId } : undefined;
  if (!link || stored.tenantId !== account.tenantId || stored.accountId !== account.id ||
    !['inbound', 'outbound'].includes(stored.direction) || stored.labels.some(label => ['DRAFT', 'SPAM', 'TRASH', 'DELETED'].includes(label))) return;
  const hash = createHash('sha256').update([account.tenantId, link.leadId ?? link.contactId, stored.rfcMessageId || `${account.id}:${stored.providerMessageId}`, stored.direction].join(':')).digest('hex');
  // Later metadata may supply a previously missing RFC ID. Keep the original Activity identity.
  const existing = await tx.activity.findFirst({ where: { tenantId: account.tenantId, type: 'email', mailboxMessageId: stored.id }, select: { id: true } });
  const activityId = existing?.id ?? `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  const dealId = stored.dealId && await tx.deal.findFirst({ where: { id: stored.dealId, tenantId: account.tenantId }, select: { id: true } }) ? stored.dealId : undefined;
  await tx.activity.upsert({ where: { id: activityId }, update: {}, create: { id: activityId, tenantId: account.tenantId, ...link,
    mailboxMessageId: stored.id, dealId, createdById: account.userId, type: 'email',
    title: `${stored.direction === 'inbound' ? 'Received' : 'Sent'} email: ${stored.subject}`.slice(0, 500), createdAt: stored.sentAt,
    metadata: { mailboxMessageId: stored.id, providerMessageId: stored.providerMessageId, threadId: stored.threadId, mailboxOwnerId: account.userId, direction: stored.direction } } });
  // A deterministic collision from another mailbox must never transfer its history.
  if (dealId) await tx.activity.updateMany({ where: { id: activityId, tenantId: account.tenantId, type: 'email', mailboxMessageId: stored.id, dealId: null }, data: { dealId } });
}

async function matchCustomer(tx: Tx, tenantId: string, userId: string, email: string, permissions: MailboxPermissions): Promise<CustomerLink | undefined> {
  // contains narrows legacy whitespace data; equality after normalization is mandatory.
  const where = { tenantId, assignedUserId: userId, isArchived: false, deletedAt: null, email: { contains: email, mode: 'insensitive' as const } };
  const leads = permissions.leadsView ? (await tx.lead.findMany({ where })).filter(row => normalizeEmail(row.email ?? '') === email) : [];
  const contacts = permissions.contactsView ? (await tx.contact.findMany({ where })).filter(row => normalizeEmail(row.email ?? '') === email) : [];
  const convertedContacts = permissions.contactsView ? await tx.contact.findMany({ where: { tenantId, assignedUserId: userId, isArchived: false, deletedAt: null,
    id: { in: leads.filter(lead => lead.convertedAt && lead.contactId).map(lead => lead.contactId!) } } }) : [];
  // Historical conversion linkage does not grant an obsolete email alias.
  const canonicalConverted = convertedContacts.filter(contact => normalizeEmail(contact.email ?? '') === email);
  for (const contact of canonicalConverted) if (!contacts.some(row => row.id === contact.id)) contacts.push(contact);
  const activeLeads = leads.filter(lead => !lead.convertedAt && (!lead.contactId || !contacts.some(contact => contact.id === lead.contactId)));
  if (activeLeads.length + contacts.length !== 1) return;
  return activeLeads[0] ? { leadId: activeLeads[0].id } : { contactId: contacts[0].id };
}

async function historyWhere(tx: Tx, tenantId: string, link: CustomerLink): Promise<Prisma.MailboxMessageWhereInput> {
  if (link.leadId) return { tenantId, leadId: link.leadId };
  const sources = await tx.lead.findMany({ where: { tenantId, contactId: link.contactId, convertedAt: { not: null } }, select: { id: true } });
  return { tenantId, OR: [{ contactId: link.contactId }, { leadId: { in: sources.map(row => row.id) } }] };
}

/** Rebuild from verified provider messages, never the old wording-based classification. */
async function evaluateCustomer(tx: Tx, account: EmailAccount, link: CustomerLink, permissions: MailboxPermissions, now: Date, immediateReply = false) {
  const tenantId = account.tenantId;
  const customer = link.leadId
    ? await tx.lead.findFirst({ where: { tenantId, assignedUserId: account.userId, id: link.leadId, isArchived: false, deletedAt: null, convertedAt: null } })
    : await tx.contact.findFirst({ where: { tenantId, assignedUserId: account.userId, id: link.contactId, isArchived: false, deletedAt: null } });
  if (!customer) return;
  const where = await historyWhere(tx, tenantId, link);
  const scope = await resolveMailboxScope(account, permissions, tx);
  const verified = { AND: [where, scopedMessagesWhere(account, scope)], engagementRuleVersion: ENGAGEMENT_RULE_VERSION, sentAt: { lte: now } };
  const inbound = await tx.mailboxMessage.findFirst({ where: { ...verified, direction: 'inbound', meaningful: true }, orderBy: { sentAt: 'desc' } });
  const outbound = !inbound ? await tx.mailboxMessage.findFirst({ where: { ...verified, direction: 'outbound' }, orderBy: { sentAt: 'asc' } }) : null;
  // A verified CRM engagement timestamp survives reassignment; source mailbox content stays private.
  const previousReply = customer.engagementEvaluatedAt && customer.lastCustomerReplyAt && +customer.lastCustomerReplyAt <= +now ? customer.lastCustomerReplyAt : null;
  const lastCustomerReplyAt = inbound && (!previousReply || +inbound.sentAt > +previousReply) ? inbound.sentAt : previousReply;
  const previousOutbound = customer.engagementEvaluatedAt && customer.firstUnansweredOutboundAt && +customer.firstUnansweredOutboundAt <= +now ? customer.firstUnansweredOutboundAt : null;
  const firstUnansweredOutboundAt = lastCustomerReplyAt ? null : outbound && (!previousOutbound || +outbound.sentAt < +previousOutbound) ? outbound.sentAt : previousOutbound;
  const data = { lastCustomerReplyAt, firstUnansweredOutboundAt };
  const pending = await tx.mailboxMessage.findFirst({ where: { ...where, engagementRuleVersion: { lt: ENGAGEMENT_RULE_VERSION } }, select: { id: true } });
  const stale = await tx.mailboxMessage.findFirst({ where: { ...where, account: { OR: [
    { isActive: false }, { lastSyncAt: null }, { lastSyncAt: { lt: new Date(+now - DAY_MS) } }, { syncCursor: null },
    { syncPageToken: { not: null } }, { syncBaselineHistoryId: { not: null } }, { syncError: { not: null } },
  ] } }, select: { id: true } });
  // A newly observed reply can prove engagement while older history is incomplete.
  const status = engagementStatus({ ...data, status: customer.status, firstStaffOutreachAt: customer.firstStaffOutreachAt, qualified: await hasQualifiedDeal(tx, tenantId, link) }, now);
  const canEvaluate = (!pending && !stale) || (immediateReply && (status === 'Warm' || status === 'Hot'));
  const timestamps = { ...data, ...(canEvaluate ? { engagementEvaluatedAt: now } : {}) };
  if (link.leadId) await tx.lead.update({ where: { tenantId, id: link.leadId }, data: timestamps });
  else await tx.contact.update({ where: { tenantId, id: link.contactId }, data: timestamps });
  if (!canEvaluate || !status || normalizeCrmStatus(customer.status) === status) return;
  return changeCustomerStatus(tx, tenantId, account.userId, link, status, engagementReason({ ...data, status }), now);
}

async function emitStatus(account: EmailAccount, link: CustomerLink, change: Awaited<ReturnType<typeof changeCustomerStatus>>) {
  if (!change) return;
  const event = { tenantId: account.tenantId, actorId: account.userId, eventId: change.eventId, prevStatus: change.prevStatus };
  if (link.leadId) await fireLeadStatusChanged({ ...event, lead: { id: change.id, status: change.status } });
  else await fireContactStatusChanged({ ...event, contact: { id: change.id, status: change.status } });
}

export async function ingestMailboxMessages(account: EmailAccount, messages: GmailEmail[], permissions: MailboxPermissions) {
  const requestedPermissions = { ...permissions };
  const scope = await resolveMailboxScope(account, permissions);
  const staff = await prisma.user.findMany({ where: { tenantId: account.tenantId }, select: { email: true } });
  const internalEmails = new Set([...staff.map(user => normalizeEmail(user.email)), normalizeEmail(account.email)]);
  const ordered = [...messages].sort((a, b) => +new Date(a.date) - +new Date(b.date) || a.id.localeCompare(b.id));
  for (const email of ordered) {
    if (!messageInScope(email, account.email, scope)) continue;
    const currentPermissions = await mailboxPermissions(account.tenantId, account.userId);
    permissions = Object.fromEntries(Object.entries(requestedPermissions).map(([key, allowed]) => [key, allowed && currentPermissions[key as keyof MailboxPermissions]])) as unknown as MailboxPermissions;
    const now = new Date(), sentAt = new Date(email.date);
    if (!Number.isFinite(+sentAt) || +sentAt > +now) continue;
    const result = await salesTransaction(async tx => {
      if (!await tx.emailAccount.findFirst({ where: { id: account.id, tenantId: account.tenantId, userId: account.userId, isActive: true } })) return;
      // Re-read assignments inside the same serializable transaction as persistence and CRM effects.
      const currentScope = await resolveMailboxScope(account, permissions, tx);
      if (!messageInScope(email, account.email, currentScope)) return;
      const authorizationParticipants = mailboxParticipants(email)!;
      const key = { accountId: account.id, providerMessageId: email.id };
      const existing = await tx.mailboxMessage.findUnique({ where: { accountId_providerMessageId: key } });
      const previousDraft = email.labels.includes('DRAFT') && email.draftId ? await tx.mailboxMessage.findFirst({ where: { tenantId: account.tenantId, accountId: account.id, draftId: email.draftId, sourceMessageId: { not: null } }, select: { sourceMessageId: true, crmDraft: true } }) : null;
      const sourceDraft = previousDraft ?? existing;
      if (email.labels.includes('DRAFT') && sourceDraft?.sourceMessageId && !currentScope.draftSourceIds.includes(sourceDraft.sourceMessageId)) return;
      const excluded = email.labels.some(label => ['SPAM', 'TRASH', 'DELETED'].includes(label));
      if (excluded) {
        if (existing) await tx.mailboxMessage.update({ where: { id: existing.id }, data: { labels: email.labels, direction: 'unknown', meaningful: false, engagementRuleVersion: ENGAGEMENT_RULE_VERSION } });
        return;
      }
      if (existing?.engagementRuleVersion === ENGAGEMENT_RULE_VERSION && !existing.labels.includes('DRAFT') && !email.labels.includes('DRAFT')) {
        const stored = await tx.mailboxMessage.update({ where: { id: existing.id }, data: { threadId: email.threadId, labels: email.labels, authorizationParticipants, participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION, fromAddress: mailboxAddress(email.from) ?? '', recipientAddresses: [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])].flatMap(value => mailboxAddress(value) ?? []), ccRecipients: email.cc ?? [], replyToAddress: email.replyToAddress ? mailboxAddress(email.replyToAddress) ?? null : null,
          ...(email.rfcMessageId ? { rfcMessageId: email.rfcMessageId } : {}), ...(email.rfcInReplyTo ? { rfcInReplyTo: email.rfcInReplyTo } : {}),
          ...(email.rfcReferences ? { rfcReferences: email.rfcReferences } : {}), ...(email.attachments ? { attachments: email.attachments as unknown as Prisma.InputJsonValue } : {}), ...(email.draftId ? { draftId: email.draftId } : {}) } });
        await persistEmailActivity(tx, account, stored);
        return;
      }
      const from = normalizeEmail(email.from), recipients = [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])].map(normalizeEmail);
      const direction = from === normalizeEmail(account.email) ? 'outbound' : recipients.includes(normalizeEmail(account.email)) && !internalEmails.has(from) ? 'inbound' : 'unknown';
      const externals = [...new Set([from, ...recipients].filter(address => address.includes('@') && !internalEmails.has(address)))];
      const matched = direction !== 'unknown' && externals.length === 1 ? await matchCustomer(tx, account.tenantId, account.userId, externals[0], permissions) : undefined;
      const priorLink: CustomerLink | undefined = existing?.contactId ? { contactId: existing.contactId } : existing?.leadId ? { leadId: existing.leadId } : undefined;
      const link = matched ?? (priorLink && (priorLink.leadId ? currentScope.leadIds.includes(priorLink.leadId) : currentScope.contactIds.includes(priorLink.contactId!)) ? priorLink : undefined);
      const prior = link ? await tx.mailboxMessage.findMany({ where: { ...await historyWhere(tx, account.tenantId, link), accountId: account.id, threadId: email.threadId }, select: { dealId: true } }) : [];
      const association = await tx.mailboxThreadAssociation.findUnique({ where: { accountId_threadId: { accountId: account.id, threadId: email.threadId } } });
      const explicitIds = association?.dealId ? [association.dealId] : existing?.dealId ? [existing.dealId] : [...new Set(prior.map(row => row.dealId).filter((id): id is string => !!id))];
      const deals = link && permissions.dealsView ? await tx.deal.findMany({ where: { ...customerDealWhere(account.tenantId, link), stage: { isWon: false, isLost: false } }, select: { id: true } }) : [];
      const candidateDealId = explicitIds.length === 1 ? explicitIds[0] : !explicitIds.length && deals.length === 1 ? deals[0].id : undefined;
      const dealId = candidateDealId && link && await tx.deal.findFirst({ where: { ...customerDealWhere(account.tenantId, link), id: candidateDealId }, select: { id: true } }) ? candidateDealId : undefined;
      const genuineReply = direction === 'inbound' && !email.automated && !FIXED_MAILBOX_SENDERS.includes(from) && !email.labels.includes('DRAFT');
      const data = { ...key, threadId: email.threadId, direction, from: email.from, recipients: email.to, subject: email.subject,
        ccRecipients: email.cc ?? [], replyToAddress: email.replyToAddress ? mailboxAddress(email.replyToAddress) ?? null : null,
        fromAddress: mailboxAddress(email.from) ?? '', recipientAddresses: recipients.flatMap(value => mailboxAddress(value) ?? []), authorizationParticipants, participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION, draftId: email.draftId,
        ...(email.labels.includes('DRAFT') && sourceDraft ? { sourceMessageId: sourceDraft.sourceMessageId, crmDraft: sourceDraft.crmDraft } : {}),
        body: email.body, snippet: email.snippet, labels: email.labels, sentAt, rfcMessageId: email.rfcMessageId, rfcInReplyTo: email.rfcInReplyTo,
        ...(email.rfcReferences ? { rfcReferences: email.rfcReferences } : {}), ...(email.attachments ? { attachments: email.attachments as unknown as Prisma.InputJsonValue } : {}),
        leadId: link?.leadId ?? null, contactId: link?.contactId ?? null, dealId, meaningful: genuineReply,
        readyToClose: false, needsDealAssociation: !!link && !dealId && deals.length > 1, engagementRuleVersion: ENGAGEMENT_RULE_VERSION };
      const stored = existing ? await tx.mailboxMessage.update({ where: { id: existing.id }, data }) : await tx.mailboxMessage.create({ data: { ...data, tenantId: account.tenantId } });
      await persistEmailActivity(tx, account, stored);
      if (email.labels.includes('DRAFT') || !link || !(link.leadId ? permissions.leadsEdit : permissions.contactsEdit)) return;
      // Historical replay is evaluated once coverage is complete; fresh replies are immediate.
      if (direction === 'outbound' && await tx.mailboxSendReceipt.findFirst({ where: { tenantId: account.tenantId, accountId: account.id, providerMessageId: email.id, operation: 'send', status: 'sent' }, select: { id: true } })) await recordStaffOutreach(tx, account.tenantId, link, new Date(email.date));
      const change = await evaluateCustomer(tx, account, link, permissions, now, !existing && genuineReply);
      // Workflow trigger enqueueing shares the CRM transaction through salesContext.
      await emitStatus(account, link, change);
      return { link, change };
    });
    void result;
  }
}

export async function evaluateMailboxEngagement(account: EmailAccount, permissions: MailboxPermissions, now = new Date()) {
  if (!permissions.leadsEdit && !permissions.contactsEdit) return;
  const scope = await resolveMailboxScope(account, permissions);
  const messages = await prisma.mailboxMessage.findMany({ where: { tenantId: account.tenantId, accountId: account.id, OR: [{ leadId: { in: scope.leadIds } }, { contactId: { in: scope.contactIds } }] }, distinct: ['leadId', 'contactId'], select: { leadId: true, contactId: true } });
  const seen = new Set<string>();
  for (const message of messages) {
    let link: CustomerLink | undefined = message.contactId ? { contactId: message.contactId } : message.leadId ? { leadId: message.leadId } : undefined;
    if (link?.leadId) {
      const lead = await prisma.lead.findFirst({ where: { tenantId: account.tenantId, id: link.leadId }, select: { convertedAt: true, contactId: true } });
      if (lead?.convertedAt && lead.contactId) link = { contactId: lead.contactId };
    }
    if (!link || !(link.leadId ? permissions.leadsEdit : permissions.contactsEdit)) continue;
    const key = link.leadId ?? link.contactId!;
    if (seen.has(key)) continue;
    seen.add(key);
    const latestPermissions = await mailboxPermissions(account.tenantId, account.userId);
    const currentPermissions = Object.fromEntries(Object.entries(permissions).map(([key, allowed]) => [key, allowed && latestPermissions[key as keyof MailboxPermissions]])) as unknown as MailboxPermissions;
    await salesTransaction(async tx => {
      const change = await evaluateCustomer(tx, account, link!, currentPermissions, now);
      await emitStatus(account, link!, change);
    });
  }
}
