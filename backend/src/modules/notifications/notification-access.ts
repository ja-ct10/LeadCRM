import type { Notification, Prisma } from '@prisma/client';
import { DEFAULT_CLOSING_FIELDS, isClosedWonField, type ClosingValues, type NotificationType } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { formatAssignmentChange } from '@leadcrm/shared';
import { assignmentEventFacts, resolveAssignmentNames } from './assignment-presentation';
import { findUserEffectivePermissions } from '../administration/roles/roles.repository';
import { mailboxPermissions } from '../../integrations/gmail/mailbox-sync.service';
import { resolveMailboxScope, scopedMessagesWhere } from '../../integrations/gmail/mailbox-scope';
import { AppError } from '../../shared/errors/app-error';
import { requireEmployeeAccount } from '../../core/auth/account-access';
import { adminNotifications, staffNotifications, notificationEntities, assignmentNotifications } from './notification-policy';
import { readConfiguredFields, validateValues } from '../crm/closing-requirements/closing-requirements.repository';

export const activeAdminWhere = (tenantId: string) => ({
  tenantId, status: 'ACTIVE' as const, role: 'Client Admin',
  userRoles: { some: { tenantId, role: { tenantId, name: 'Client Admin', isArchived: false } } },
});
const modules: Record<string, string> = { Lead: 'leads', Contact: 'contacts', Account: 'accounts', Deal: 'deals',
  Task: 'tasks', Campaign: 'campaigns', Workflow: 'workflows', User: 'users', RoleDefinition: 'roles', Form: 'forms' };

/** Current role and ownership checks are shared by delivery, presentation and navigation. */
export async function notificationAccess(tenantId: string, userId: string, db: Prisma.TransactionClient = prisma) {
  const user = await db.user.findFirst({ where: { tenantId, id: userId, status: 'ACTIVE', tenant: { status: { in: ['ACTIVE', 'SANDBOX'] } } } });
  let active = !!user;
  if (user) {
    try { await requireEmployeeAccount(user, db); } catch (error) { if (error instanceof AppError) active = false; else throw error; }
  }
  const admin = active && !!await db.user.findFirst({ where: { ...activeAdminWhere(tenantId), id: userId }, select: { id: true } });
  const permissions = active && !admin ? await findUserEffectivePermissions(userId, tenantId, db) : {};
  // Apply before pagination/counting. Stored operational history remains untouched.
  const visibilityWhere: Prisma.NotificationWhereInput = admin ? { OR: [
    { type: { in: [...adminNotifications].filter(type => type !== 'password_expiring_soon') } },
    { type: 'password_expiring_soon', entityType: 'PasswordSecurity', entityId: userId },
  ] } : {};
  const can = (module: string) => active && (admin || permissions[module]?.canView === true);
  const cache = new Map<string, Promise<{ entityType: string; entityId: string; destination: string } | null>>();
  const resolve = async (entityType?: string | null, entityId?: string | null): Promise<{ entityType: string; entityId: string; destination: string } | null> => {
    if (!active || !entityType || !entityId) return null;
    const key = entityType + ':' + entityId;
    if (cache.has(key)) return cache.get(key)!;
    const load = async (): Promise<{ entityType: string; entityId: string; destination: string } | null> => {
      const id = encodeURIComponent(entityId);
      const scope = { tenantId, id: entityId };
      if (entityType === 'PasswordSecurity') return entityId === userId ? { entityType, entityId, destination: '/settings?tab=profile&changePassword=1' } : null;
      if (entityType === 'MailboxMessage') {
        try {
          const message = await db.mailboxMessage.findFirst({ where: { ...scope, account: { tenantId, userId, isActive: true }, direction: 'inbound',
            NOT: { labels: { hasSome: ['SPAM', 'TRASH', 'DELETED', 'DRAFT'] } } }, include: { account: true } });
          if (!message) return null;
          const mailbox = await mailboxPermissions(tenantId, userId, true, db);
          const mailboxScope = await resolveMailboxScope(message.account, mailbox, db);
          if (!await db.mailboxMessage.findFirst({ where: { AND: [scopedMessagesWhere(message.account, mailboxScope), { id: entityId }] }, select: { id: true } })) return null;
          // Customer-reply events also require current CRM association, not just an approved sender.
          const linked = message.contactId
            ? can('contacts') && await db.contact.findFirst({ where: { tenantId, id: message.contactId, assignedUserId: userId, isArchived: false, deletedAt: null }, select: { id: true } })
            : message.leadId && can('leads') && await db.lead.findFirst({ where: { tenantId, id: message.leadId, assignedUserId: userId, isArchived: false, deletedAt: null, convertedAt: null }, select: { id: true } });
          if (!linked) return null;
          return { entityType, entityId, destination: '/inbox?threadId=' + encodeURIComponent(message.threadId) };
        } catch (error) { if (error instanceof AppError && [403, 404].includes(error.statusCode)) return null; throw error; }
      }
      if (entityType === 'Mailbox') {
        const account = await db.emailAccount.findFirst({ where: scope, select: { userId: true } });
        if (!account || !admin && account.userId !== userId) return null;
        if (!admin) {
          try { await mailboxPermissions(tenantId, userId, true, db); }
          catch (error) { if (error instanceof AppError && [403, 404].includes(error.statusCode)) return null; throw error; }
        }
        return { entityType, entityId, destination: account.userId === userId ? '/inbox' : '/settings?tab=users' };
      }
      if (!can(modules[entityType])) return null;
      // CRM View permission permits eligible same-tenant records after reassignment.
      // Current ownership is checked separately for prospective delivery below.
      const visible = { ...scope, isArchived: false, deletedAt: null };
      let exists: unknown = false;
      let destination = '';
      if (entityType === 'Lead') {
        const lead = await db.lead.findFirst({ where: visible, select: { contactId: true, convertedAt: true } });
        if (lead?.convertedAt) return lead.contactId ? resolve('Contact', lead.contactId) : null;
        exists = lead; destination = '/crm/leads/' + id;
      } else if (entityType === 'Contact') { exists = await db.contact.findFirst({ where: visible, select: { id: true } }); destination = '/crm/contacts/' + id; }
      else if (entityType === 'Account') { exists = await db.account.findFirst({ where: visible, select: { id: true } }); destination = '/crm/accounts/' + id; }
      else if (entityType === 'Deal') { exists = await db.deal.findFirst({ where: visible, select: { id: true } }); destination = '/crm/deals/' + id; }
      else if (entityType === 'Task') { exists = await db.task.findFirst({ where: { ...scope, isArchived: false, ...(!admin ? { assignedUserId: userId } : {}) }, select: { id: true } }); destination = '/operations/taskboard?taskId=' + id; }
      else if (entityType === 'Campaign') { exists = await db.campaign.findFirst({ where: { ...scope, isArchived: false, ...(!admin ? { OR: [{ createdById: userId }, { type: 'SMS', submittedById: userId }] } : {}) }, select: { id: true } }); destination = '/marketing/campaigns?campaignId=' + id; }
      else if (entityType === 'Workflow') { exists = admin && await db.workflow.findFirst({ where: { ...scope, isArchived: false }, select: { id: true } }); destination = '/automation/workflows?workflowId=' + id; }
      else if (entityType === 'User') { exists = admin && await db.user.findFirst({ where: scope, select: { id: true } }); destination = '/settings?tab=users'; }
      else if (entityType === 'RoleDefinition') { exists = admin && await db.roleDefinition.findFirst({ where: scope, select: { id: true } }); destination = '/settings?tab=roles'; }
      else if (entityType === 'Form') { exists = admin && await db.marketingForm.findFirst({ where: { ...scope, isArchived: false }, select: { id: true } }); destination = '/marketing/forms?formId=' + id; }
      return exists ? { entityType, entityId, destination } : null;
    };
    const result = load(); cache.set(key, result); return result;
  };
  const eligible = async (type: NotificationType, entityType?: string | null, entityId?: string | null) => {
    if (!active || !entityType || !entityId || !notificationEntities[type]?.includes(entityType) || !await resolve(entityType, entityId)) return false;
    if (type === 'password_expiring_soon') return entityType === 'PasswordSecurity' && entityId === userId;
    if (admin) return adminNotifications.has(type);
    if (!staffNotifications.has(type)) return false;
    const owned = { tenantId, id: entityId, assignedUserId: userId, isArchived: false, deletedAt: null };
    if (entityType === 'Lead') return !!await db.lead.findFirst({ where: { ...owned, convertedAt: null }, select: { id: true } });
    if (entityType === 'Contact') return !!await db.contact.findFirst({ where: owned, select: { id: true } });
    if (entityType === 'Account') return !!await db.account.findFirst({ where: owned, select: { id: true } });
    if (entityType === 'Deal') {
      const deal = await db.deal.findFirst({ where: owned, include: { stage: true } });
      if (!deal) return false;
      if (type === 'closing_requirements_needed') {
        if (deal.stage.isWon || deal.stage.isLost || deal.stage.name.trim().toLowerCase() !== 'qualified') return false;
        const configured = await readConfiguredFields(db, tenantId);
        const fields = (configured.length ? configured : DEFAULT_CLOSING_FIELDS).filter(isClosedWonField);
        return Object.keys(await validateValues(db, tenantId, deal.id, fields, deal.closingValues as ClosingValues)).length > 0;
      }
      return true;
    }
    // Task/Campaign/Mailbox/Message resolve already verifies the specific owner.
    return ['Task', 'Campaign', 'Mailbox', 'MailboxMessage'].includes(entityType);
  };
  return { active, admin, resolve, eligible, visibilityWhere };
}

export async function presentNotifications(tenantId: string, userId: string, rows: Notification[]) {
  const access = await notificationAccess(tenantId, userId);
  const targets = await Promise.all(rows.map(row => access.resolve(row.entityType, row.entityId)));
  const keys = rows.filter((row, i) => targets[i] && assignmentNotifications.has(row.type as NotificationType) && row.eventKey).map(row => row.eventKey!);
  const events = keys.length ? await prisma.notificationEvent.findMany({ where: { tenantId, eventKey: { in: keys }, type: { in: [...assignmentNotifications] } },
    select: { eventKey: true, ownerId: true, payload: true, entityType: true, entityId: true } }) : [];
  const candidates = rows.map((row, i) => {
    const event = targets[i] && events.find(event => event.eventKey === row.eventKey && event.entityType === row.entityType && event.entityId === row.entityId);
    return event ? assignmentEventFacts(event) : undefined;
  });
  const facts = await resolveAssignmentNames(tenantId, candidates.filter((row): row is NonNullable<typeof row> => !!row));
  let index = 0;
  return rows.map((row, i) => {
    const target = targets[i];
    const content = candidates[i] ? formatAssignmentChange(facts[index++]) : undefined;
    // Preserve management of historical notifications without exposing a former owner's data.
    return target ? { ...row, ...(content ? { title: content.title, body: content.description } : {}), entityType: target.entityType, entityId: target.entityId, available: true }
      : { ...row, title: 'Notification no longer available', body: 'The related record is unavailable or your access has changed.',
        entityType: null, entityId: null, eventKey: undefined, available: false };
  });
}
