import type { NotificationType } from '@leadcrm/shared';
import { NotificationTypes } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import * as repo from './notifications.repository';
import { notificationAccess } from './notification-access';
import { getNotificationPreferences, mandatoryNotification } from './notification-preferences.service';
import { tenantContext } from '../../core/tenant/tenant-context';
import { Prisma } from '@prisma/client';
import { assignmentNotifications } from './notification-policy';
import { isPasswordExpiryWarningDue } from '../../core/auth/password-expiration';

export interface CreateNotificationParams {
  tenantId: string; userId: string; type: NotificationType; title: string; body?: string;
  entityType?: string; entityId?: string; eventKey: string; occurredAt?: Date;
  taskVersion?: number; eligibilityAt?: Date;
  actorId?: string | null;
  incidentId?: string;
  securityLockedAt?: string;
}

/** Internal compatibility entrypoint. Business producers use the transactional outbox. */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  await deliverNotification(params);
}

/** Ledger claim and visible delivery commit together. Retry is safe even after deletion. */
export async function deliverNotification(params: CreateNotificationParams): Promise<void> {
  if (!NotificationTypes.includes(params.type) || !params.eventKey) throw new Error('INVALID_NOTIFICATION_EVENT');
  const scope = tenantContext.getStore();
  if (scope && scope.tenantId !== params.tenantId) throw new Error('NOTIFICATION_TENANT_MISMATCH');
  await prisma.$transaction(async tx => {
    // Serialize eligibility against source reassignment and account deactivation.
    // Identifiers come only from this fixed allow-list; tenant/IDs are parameters.
    const tables: Record<string, string> = { Lead: 'Lead', Contact: 'Contact', Account: 'Account', Deal: 'Deal', Task: 'Task',
      Campaign: 'Campaign', Mailbox: 'EmailAccount', MailboxMessage: 'MailboxMessage', User: 'User', PasswordSecurity: 'User', RoleDefinition: 'RoleDefinition', Form: 'MarketingForm', Workflow: 'Workflow' };
    const table = tables[params.entityType ?? ''];
    await tenantContext.exit(async () => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE "tenantId"=${params.tenantId} AND id=${params.userId} FOR SHARE`;
      await tx.$queryRaw`SELECT ur.id FROM "UserRole" ur JOIN "RoleDefinition" r ON r.id=ur."roleId" AND r."tenantId"=ur."tenantId"
        WHERE ur."tenantId"=${params.tenantId} AND ur."userId"=${params.userId} FOR SHARE OF ur,r`;
      await tx.$queryRaw`SELECT p.id FROM "RolePermission" p JOIN "UserRole" ur ON ur."roleId"=p."roleId" AND ur."tenantId"=p."tenantId"
        WHERE ur."tenantId"=${params.tenantId} AND ur."userId"=${params.userId} FOR SHARE OF p`;
      if (table && params.entityId) await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw('"' + table + '"')}
        WHERE "tenantId"=${params.tenantId} AND id=${params.entityId} FOR SHARE`);
      if (params.entityType === 'MailboxMessage') {
        await tx.$queryRaw`SELECT a.id FROM "EmailAccount" a JOIN "MailboxMessage" m ON m."accountId"=a.id AND m."tenantId"=a."tenantId"
          WHERE m."tenantId"=${params.tenantId} AND m.id=${params.entityId ?? ''} FOR SHARE OF a`;
        await tx.$queryRaw`SELECT c.id FROM "Contact" c JOIN "MailboxMessage" m ON m."contactId"=c.id AND m."tenantId"=c."tenantId"
          WHERE m."tenantId"=${params.tenantId} AND m.id=${params.entityId ?? ''} FOR SHARE OF c`;
        await tx.$queryRaw`SELECT l.id FROM "Lead" l JOIN "MailboxMessage" m ON m."leadId"=l.id AND m."tenantId"=l."tenantId"
          WHERE m."tenantId"=${params.tenantId} AND m.id=${params.entityId ?? ''} FOR SHARE OF l`;
      }
    });
    const access = await notificationAccess(params.tenantId, params.userId, tx);
    if (!access.active) return;
    let authorized = !(assignmentNotifications.has(params.type) && params.actorId === params.userId)
      && await access.eligible(params.type, params.entityType, params.entityId);
    if (params.securityLockedAt !== undefined) {
      authorized = authorized && params.type === 'user_status_changed' && params.entityType === 'User'
        && Number.isFinite(Date.parse(params.securityLockedAt)) && !!await tx.user.findFirst({ where: {
          tenantId: params.tenantId, id: params.entityId, securityLockedAt: new Date(params.securityLockedAt),
        }, select: { id: true } });
    }
    if (params.type === 'mailbox_disconnected' || params.type === 'mailbox_sync_failed') {
      authorized = authorized && !!params.incidentId && !!await tx.emailAccount.findFirst({ where: {
        tenantId: params.tenantId, id: params.entityId, notificationIncidentId: params.incidentId,
        ...(params.type === 'mailbox_disconnected' ? { isActive: false } : { isActive: true, syncError: { not: null },
          notificationFailedAt: { lte: new Date(+(params.eligibilityAt ?? new Date()) - 15 * 60000) } }),
      }, select: { id: true } });
    }
    const preferences = await getNotificationPreferences(params.tenantId, params.userId, tx);
    if (params.type === 'password_expiring_soon') {
      const event = await tx.notificationEvent.findUnique({ where: { tenantId_eventKey: { tenantId: params.tenantId, eventKey: params.eventKey } } });
      const changed = (event?.payload as { passwordChangedAt?: string } | undefined)?.passwordChangedAt;
      const user = await tx.user.findFirst({ where: { tenantId: params.tenantId, id: params.userId }, select: { passwordChangedAt: true, passwordHash: true, mustChangePassword: true } });
      const stamp = user?.passwordChangedAt?.getTime();
      authorized = authorized && !!user?.passwordHash && !user.mustChangePassword && stamp !== undefined && Date.parse(changed ?? '') === stamp
        && isPasswordExpiryWarningDue(user?.passwordChangedAt, params.eligibilityAt);
    }
    const enabled = mandatoryNotification(params.type) || preferences.data.inAppGeneral;
    let currentTask = true;
    if (params.type === 'task_due' || params.type === 'task_overdue') {
      const scope = tenantContext.getStore();
      if (scope && scope.tenantId !== params.tenantId) throw new Error('NOTIFICATION_TENANT_MISMATCH');
      const at = params.eligibilityAt ?? new Date();
      const utcAt = at.toISOString();
      // Hold a read lock through delivery, so completion/reassignment cannot commit
      // between the final eligibility check and the reminder insert.
      const eligible = await tenantContext.exit(async () => await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Task" WHERE "tenantId"=${params.tenantId} AND id=${params.entityId ?? ''}
          AND "assignedUserId"=${params.userId} AND "notificationVersion"=${params.taskVersion ?? -1}
          AND NOT "isArchived" AND status NOT IN ('completed','cancelled')
          AND ((${params.type}='task_due' AND "dueDate">${utcAt}::timestamp
            AND coalesce("reminderAt","dueDate"-interval '24 hours')<=${utcAt}::timestamp)
            OR (${params.type}='task_overdue' AND "dueDate"<=${utcAt}::timestamp))
        FOR SHARE`);
      currentTask = eligible.length > 0;
    }
    const claim = await tx.notificationDelivery.createMany({ data: [{
      tenantId: params.tenantId, userId: params.userId, eventKey: params.eventKey,
      outcome: !authorized || !currentTask ? 'ineligible' : !enabled ? 'disabled' : 'delivered',
    }], skipDuplicates: true });
    const { taskVersion: _version, eligibilityAt: _at, actorId: _actor, incidentId: _incident, securityLockedAt: _lock, ...data } = params;
    if (claim.count && authorized && currentTask && enabled) await tx.notification.create({ data });
  });
}

export const getNotifications = repo.findNotifications;
export const markRead = repo.markNotificationRead;
export const markAllRead = repo.markAllNotificationsRead;
export const deleteNotifications = repo.deleteNotifications;
