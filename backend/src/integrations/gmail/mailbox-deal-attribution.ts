import { Prisma } from '@prisma/client';
import { mailboxAddress } from './mailbox-scope';

async function hasLinkedParticipant(tx: Prisma.TransactionClient, tenantId: string, message: { dealId: string | null; accountId: string; from: string; recipients: string[]; ccRecipients: string[] }) {
  if (!message.dealId) return false;
  const [account, deal] = await Promise.all([
    tx.emailAccount.findFirst({ where: { tenantId, id: message.accountId }, select: { email: true } }),
    tx.deal.findFirst({ where: { tenantId, id: message.dealId }, select: {
      leadDeals: { where: { tenantId }, select: { lead: { select: { email: true } } } },
      contactDeals: { where: { tenantId }, select: { contact: { select: { email: true } } } },
    } }),
  ]);
  if (!account || !deal) return false;
  const people = [...deal.leadDeals.map(link => mailboxAddress(link.lead.email ?? '')), ...deal.contactDeals.map(link => mailboxAddress(link.contact.email ?? ''))].filter(Boolean);
  const from = mailboxAddress(message.from);
  return from === mailboxAddress(account.email)
    ? [...message.recipients, ...message.ccRecipients].some(recipient => people.includes(mailboxAddress(recipient))) : people.includes(from);
}

/** Reconcile only saved links with persisted proof. Never assign an unassociated email. */
export async function backfillDealAttribution(tx: Prisma.TransactionClient, tenantId: string) {
  const messages = await tx.mailboxMessage.findMany({ where: { tenantId, dealId: { not: null }, dealAttribution: { equals: Prisma.DbNull },
    engagementRuleVersion: 2, participantPolicyVersion: 1 }, orderBy: [{ sentAt: 'asc' }, { id: 'asc' }] });
  const receipts = await tx.mailboxSendReceipt.findMany({ where: { tenantId, status: 'sent', operation: { in: ['send', 'schedule'] } },
    select: { id: true, accountId: true, providerMessageId: true, authorizationContext: true } });
  const associations = await tx.mailboxThreadAssociation.findMany({ where: { tenantId } });
  let verified = 0;
  for (const message of messages) {
    if (message.labels.some(label => ['DRAFT', 'SPAM', 'TRASH', 'DELETED'].includes(label))) continue;
    if (!await hasLinkedParticipant(tx, tenantId, message)) continue;
    const receipt = receipts.find(receipt => receipt.accountId === message.accountId && receipt.providerMessageId === message.providerMessageId);
    const context = receipt?.authorizationContext;
    const saved = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
    const quotation = saved.quotation && typeof saved.quotation === 'object' && !Array.isArray(saved.quotation) ? saved.quotation : {};
    const draft = quotation.draft && typeof quotation.draft === 'object' && !Array.isArray(quotation.draft) ? quotation.draft : {};
    let proof: Prisma.InputJsonObject | undefined;
    if (receipt && (saved.dealId === message.dealId || draft.dealId === message.dealId)) proof = { kind: 'explicit_send', receiptId: receipt.id };
    const manual = associations.find(link => link.accountId === message.accountId && link.threadId === message.threadId && link.dealId === message.dealId);
    if (!proof && manual) {
      const activity = await tx.activity.findFirst({ where: { tenantId, dealId: message.dealId, type: 'note', title: 'Email conversation associated with this Deal',
        AND: [{ metadata: { path: ['threadId'], equals: message.threadId } }, { metadata: { path: ['mailboxOwnerId'], equals: (await tx.emailAccount.findFirstOrThrow({ where: { tenantId, id: message.accountId } })).userId } }] }, select: { id: true } });
      const conflicting = await tx.mailboxMessage.count({ where: { tenantId, accountId: message.accountId, threadId: message.threadId,
        OR: [{ dealId: null }, { dealId: { not: message.dealId } }] } });
      if (activity && !conflicting) proof = { kind: 'manual', activityId: activity.id };
    }
    if (proof) { await tx.mailboxMessage.update({ where: { id: message.id, tenantId }, data: { dealAttribution: proof } }); verified++; }
  }
  // Fixed-point traversal also supports delayed/out-of-order historical ingestion.
  let changed = true;
  while (changed) {
    changed = false;
    const pending = await tx.mailboxMessage.findMany({ where: { tenantId, dealId: { not: null }, dealAttribution: { equals: Prisma.DbNull }, rfcInReplyTo: { not: null },
      engagementRuleVersion: 2, participantPolicyVersion: 1, NOT: { labels: { hasSome: ['DRAFT', 'SPAM', 'TRASH', 'DELETED'] } } } });
    for (const message of pending) {
      const parents = await tx.mailboxMessage.findMany({ where: { tenantId, accountId: message.accountId, threadId: message.threadId,
        rfcMessageId: message.rfcInReplyTo, dealId: { not: null }, NOT: { dealAttribution: { equals: Prisma.DbNull } } },
        distinct: ['dealId'], take: 2, select: { id: true, dealId: true } });
      if (parents.length !== 1 || parents[0].dealId !== message.dealId || !await hasLinkedParticipant(tx, tenantId, message)) continue;
      await tx.mailboxMessage.update({ where: { tenantId, id: message.id }, data: { dealAttribution: { kind: 'reply', parentId: parents[0].id } } });
      verified++; changed = true;
    }
  }
  return { inspected: messages.length, verified };
}
