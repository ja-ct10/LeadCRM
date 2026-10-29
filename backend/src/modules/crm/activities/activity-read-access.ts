import type { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';
import { AppError } from '../../../shared/errors/app-error';
import { authorizedMailbox } from '../../../integrations/gmail/mailbox-store';
import { scopedMessagesWhere } from '../../../integrations/gmail/mailbox-scope';
import { crmActor, crmPolicyReadWhere, resolveCrmActor, taskReadWhere } from '../access/crm-record-access.service';

type Policy = Awaited<ReturnType<typeof resolveCrmActor>>;
type Revision = { kind: 'mailbox'; accountId: string; scopeHash: string }
  | { kind: 'history'; access: string; content: string; policy: string };
export type ActivityReadAccess = { where: Prisma.ActivityWhereInput; messages?: Prisma.MailboxMessageWhereInput; revision?: Revision };
const nonEmail: Prisma.ActivityWhereInput = { type: { not: 'email' } };

function managedRecordWhere(policy: Policy, module: 'leads' | 'contacts' | 'deals') {
  return { tenantId: policy.tenantId, assignedUserId: { in: policy.activityTeamUserIds ?? [] }, AND: [crmPolicyReadWhere(policy, module)] };
}

/** The requested record, rather than its author or mailbox owner, establishes team access. */
async function managedActivitiesWhere(policy: Policy, query: Record<string, unknown>): Promise<Prisma.ActivityWhereInput> {
  const lead = managedRecordWhere(policy, 'leads'), contact = managedRecordWhere(policy, 'contacts'), deal = managedRecordWhere(policy, 'deals');
  const task = { ...taskReadWhere(policy), AND: [{ assignedUserId: { in: policy.activityTeamUserIds ?? [] } }] };
  const targets = {
    lead: () => prisma.lead.findFirst({ where: { ...lead, id: String(query.leadId) }, select: { id: true } }),
    contact: () => prisma.contact.findFirst({ where: { ...contact, id: String(query.contactId) }, select: { id: true } }),
    deal: () => prisma.deal.findFirst({ where: { ...deal, id: String(query.dealId) }, select: { id: true } }),
    task: () => prisma.task.findFirst({ where: { ...task, id: String(query.taskId) }, select: { id: true } }),
  };
  for (const [kind, read] of Object.entries(targets)) {
    if (query[`${kind}Id`] && !await read()) {
      return { id: { in: [] } };
    }
  }
  return { OR: [
    { lead: { is: lead } }, { contact: { is: contact } }, { deal: { is: deal } }, { task: { is: task } },
    { lead: { is: { tenantId: policy.tenantId, convertedAt: { not: null }, convertedContact: { is: contact } } } },
  ] };
}

function policyIdentity(policy: Policy) {
  return JSON.stringify([policy.userId, policy.tenantId, policy.clientAdmin, policy.activityReadScope,
    policy.activityTeamUserIds, Object.entries(policy.permissions).sort(([a], [b]) => a.localeCompare(b))]);
}

/** One predicate for rows, search and counts; Inbox's mailbox policy remains independent. */
export async function activityReadAccess(tenantId: string, query: Record<string, unknown> = {}): Promise<ActivityReadAccess> {
  const actor = crmActor.getStore();
  if (!actor || actor.tenantId !== tenantId) return { where: nonEmail };
  const policy = await resolveCrmActor(prisma, actor);
  if (policy.clientAdmin || policy.activityReadScope === 'managed-groups') {
    const revision = await prisma.dashboardRevision.findUnique({ where: { tenantId }, select: { access: true, content: true } });
    const records = policy.clientAdmin ? {} : await managedActivitiesWhere(policy, query);
    const messages = { tenantId };
    return { where: { AND: [records, { OR: [nonEmail, { mailboxMessage: { is: messages } }] }] }, messages,
      revision: { kind: 'history', access: String(revision?.access ?? 0), content: String(revision?.content ?? 0), policy: policyIdentity(policy) } };
  }
  try {
    const { account, scope } = await authorizedMailbox(tenantId, actor.userId);
    const messages = scopedMessagesWhere(account, scope, true);
    return { where: { OR: [nonEmail, { mailboxMessage: { is: messages } }] }, messages,
      revision: { kind: 'mailbox', accountId: account.id, scopeHash: scope.hash } };
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) return { where: nonEmail };
    throw error;
  }
}

export async function recheckActivityReadAccess(tenantId: string, access: ActivityReadAccess) {
  if (!access.revision) return;
  const changed = () => new AppError('Activity access changed. Reload the activity list.', 409, 'MAILBOX_SCOPE_CHANGED');
  try {
    const current = await activityReadAccess(tenantId);
    if (JSON.stringify(current.revision) !== JSON.stringify(access.revision)) throw changed();
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) throw changed();
    throw error;
  }
}
