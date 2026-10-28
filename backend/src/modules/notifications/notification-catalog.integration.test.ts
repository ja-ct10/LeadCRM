import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationTypes, type NotificationType } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { crmActor } from '../crm/access/crm-record-access.service';
import { tenantContext } from '../../core/tenant/tenant-context';
import { salesPipeline, salesTransaction } from '../crm/leads/lead-automation.service';
import { listFields, saveField } from '../crm/closing-requirements/closing-requirements.service';
import { MAILBOX_PARTICIPANT_POLICY_VERSION } from '../../integrations/gmail/mailbox-scope';
import { notificationAccess } from './notification-access';
import { deliverNotification } from './notifications.service';
import { dispatchTenantNotifications } from './notification-events.service';
import { deleteNotifications, markNotificationRead, notificationCounts } from './notifications.repository';
import { mandatoryNotification, saveNotificationPreferences } from './notification-preferences.service';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
describe.skipIf(url.hostname !== '127.0.0.1' || url.pathname !== '/leadcrm_forms_test_2')('Every registered notification and recipient scope', () => {
  let tenantId: string, owner: string, other: string, admin: string, denied: string, inactive: string, foreign: string;
  let sources: Record<string, { entityType: string; entityId: string }>;
  let taskVersion: number, overdueVersion: number, incidentId: string, mailboxId: string;
  const at = new Date();
  const passwordChangedAt = new Date(+at - 89.2 * 86400000);
  const staffTypes = new Set<NotificationType>(['lead_assigned', 'contact_assigned', 'deal_assigned', 'task_assigned',
    'customer_hot', 'customer_cold', 'customer_cancelled', 'deal_won', 'deal_lost', 'closing_requirements_needed',
    'task_due', 'task_overdue', 'customer_reply', 'campaign_failed', 'mailbox_disconnected', 'mailbox_sync_failed',
    'sms_campaign_sent', 'sms_campaign_delivered', 'sms_campaign_failed', 'sms_campaign_partial', 'sms_campaign_unconfirmed', 'sms_campaign_progress', 'password_expiring_soon']);
  const administrative = new Set<NotificationType>(['user_created', 'user_status_changed', 'role_created', 'role_archived', 'role_permissions_changed', 'user_role_changed']);
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Full notification catalog', slug: randomUUID() } })).id;
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Customer Care Custom', permissions: { create:
      ['leads', 'contacts', 'accounts', 'deals', 'tasks', 'campaigns', 'workflows', 'forms'].map(module => ({ module, canView: true,
        ...(['leads', 'contacts', 'accounts', 'deals'].includes(module) ? { canViewAll: true, canViewMy: true } : {}) })) } } });
    const adminRole = await prisma.roleDefinition.create({ data: { tenantId, name: 'Client Admin', isSystemRole: true } });
    const emptyRole = await prisma.roleDefinition.create({ data: { tenantId, name: 'No Access' } });
    const user = async (name: string, roleId = role.id, roleName = role.name, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE', tenant = tenantId) => {
      return prisma.user.create({ data: { tenantId: tenant, firstName: name, lastName: 'QA', role: roleName, status,
        email: randomUUID() + '@camxian.com', passwordHash: 'not-a-login-fixture', passwordChangedAt, mustChangePassword: false,
        onboardingCompletedAt: new Date(), userRoles: { create: { roleId } } } });
    };
    const ownerRow = await user('Owner'); owner = ownerRow.id;
    other = (await user('Other owner')).id; admin = (await user('Administrator', adminRole.id, 'Client Admin')).id;
    denied = (await user('Denied', emptyRole.id, 'No Access')).id; inactive = (await user('Inactive', role.id, role.name, 'INACTIVE')).id;
    const foreignTenant = await prisma.tenant.create({ data: { name: 'Foreign', slug: randomUUID() } });
    const foreignRole = await prisma.roleDefinition.create({ data: { tenantId: foreignTenant.id, name: 'Foreign Custom' } });
    foreign = (await user('Foreign', foreignRole.id, foreignRole.name, 'ACTIVE', foreignTenant.id)).id;
    const lead = await prisma.lead.create({ data: { tenantId, firstName: 'Catalog', lastName: 'Lead', assignedUserId: owner } });
    const contact = await prisma.contact.create({ data: { tenantId, firstName: 'Catalog', lastName: 'Contact', assignedUserId: owner, email: randomUUID() + '@example.test' } });
    const account = await prisma.account.create({ data: { tenantId, name: 'Unassigned Account' } });
    const pipeline = await salesTransaction(tx => salesPipeline(tx, tenantId));
    const qualified = await prisma.stage.findFirstOrThrow({ where: { tenantId, pipelineId: pipeline.pipeline.id, name: 'Qualified' } });
    const deal = await prisma.deal.create({ data: { tenantId, title: 'Catalog Deal', pipelineId: pipeline.pipeline.id, stageId: qualified.id, assignedUserId: owner } });
    await tenantContext.run({ tenantId }, async () => { await listFields(tenantId); await saveField(tenantId, admin, { required: true }, 'confirmation-type'); });
    const task = await prisma.task.create({ data: { tenantId, title: 'Catalog reminder', assignedUserId: owner, dueDate: new Date(+at + 86400000), reminderAt: new Date(+at - 60000) } }); taskVersion = task.notificationVersion;
    const overdue = await prisma.task.create({ data: { tenantId, title: 'Catalog overdue', assignedUserId: owner, dueDate: new Date(+at - 86400000) } }); overdueVersion = overdue.notificationVersion;
    const campaign = await prisma.campaign.create({ data: { tenantId, name: 'Catalog Campaign', type: 'SMS', createdById: owner, submittedById: owner } });
    const workflow = await prisma.workflow.create({ data: { tenantId, name: 'Catalog Workflow', trigger: 'lead.created', actions: [], createdById: owner } });
    const form = await prisma.marketingForm.create({ data: { tenantId, name: 'Catalog Form', createdById: owner } });
    const mailbox = await prisma.emailAccount.create({ data: { tenantId, userId: owner, email: ownerRow.email, accessToken: 'disposable', scopes: [], syncCursor: 'ready', connectedAt: new Date(+at - 60000) } }); mailboxId = mailbox.id;
    const message = await prisma.mailboxMessage.create({ data: { tenantId, accountId: mailbox.id, providerMessageId: randomUUID(), threadId: 'catalog-thread', direction: 'inbound', from: contact.email!, fromAddress: contact.email!, recipients: [ownerRow.email], recipientAddresses: [ownerRow.email],
      authorizationParticipants: [contact.email!, ownerRow.email].sort(), participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION, contactId: contact.id, subject: 'Never exposed', body: 'Never exposed', snippet: 'Never exposed', sentAt: at, labels: ['INBOX'] } });
    const target = (entityType: string, entityId: string) => ({ entityType, entityId });
    sources = { Lead: target('Lead', lead.id), Contact: target('Contact', contact.id), Account: target('Account', account.id), Deal: target('Deal', deal.id), Task: target('Task', task.id), Overdue: target('Task', overdue.id),
      Campaign: target('Campaign', campaign.id), Workflow: target('Workflow', workflow.id), Form: target('Form', form.id), User: target('User', owner), Role: target('RoleDefinition', role.id), Password: target('PasswordSecurity', owner), Mailbox: target('Mailbox', mailbox.id), Message: target('MailboxMessage', message.id) };
  });
  afterAll(async () => { await prisma.$disconnect(); });
  const sourceFor = (type: NotificationType) => sources[type === 'password_expiring_soon' ? 'Password' : type === 'customer_reply' ? 'Message'
    : type.startsWith('mailbox_') ? 'Mailbox' : type.startsWith('sms_campaign_') || type === 'campaign_failed' ? 'Campaign'
    : type.startsWith('user_') ? 'User' : type.startsWith('role_') ? 'Role' : type === 'workflow_failed' ? 'Workflow' : type === 'form_processing_failed' ? 'Form'
    : type === 'task_overdue' ? 'Overdue' : type.startsWith('task_') ? 'Task' : type === 'contact_assigned' ? 'Contact' : type === 'account_assigned' ? 'Account'
    : type === 'lead_assigned' || type.startsWith('customer_') || type === 'website_lead' ? 'Lead' : 'Deal'];

  it.each(NotificationTypes)('checks recipients, replay identity and read/unread for %s', async type => {
    const source = sourceFor(type);
    if (type.startsWith('mailbox_')) {
      await prisma.emailAccount.update({ where: { id: mailboxId }, data: { isActive: type !== 'mailbox_disconnected', syncError: 'disposable incident' } });
      const mailbox = await prisma.emailAccount.findUniqueOrThrow({ where: { id: mailboxId } }); incidentId = mailbox.notificationIncidentId!;
      if (type === 'mailbox_sync_failed') await prisma.emailAccount.update({ where: { id: mailboxId }, data: { notificationFailedAt: new Date(+at - 16 * 60000) } });
    }
    const eventKey = 'catalog:' + type;
    await prisma.notificationEvent.create({ data: { tenantId, eventKey, type, ...source, ownerId: owner, admins: true, payload: { passwordChangedAt: passwordChangedAt.toISOString() } } });
    const expected = administrative.has(type) ? [admin] : staffTypes.has(type) ? [owner] : [];
    for (const userId of [owner, other, admin, denied, inactive, foreign]) {
      const params = { tenantId, userId, eventKey, type, ...source, title: 'Catalog ' + type, eligibilityAt: at,
        taskVersion: type === 'task_overdue' ? overdueVersion : taskVersion, incidentId };
      await deliverNotification(params); await deliverNotification(params);
    }
    const rows = await prisma.notification.findMany({ where: { tenantId, eventKey } });
    expect(rows.map(row => row.userId).sort()).toEqual(expected);
    for (const row of rows) {
      expect((await notificationCounts(tenantId, row.userId)).unreadCount).toBeGreaterThan(0);
      await markNotificationRead(row.id, tenantId, row.userId);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).isRead).toBe(true);
      await deleteNotifications([row.id], tenantId, row.userId);
      await deliverNotification({ tenantId, userId: row.userId, eventKey, type, ...source, title: 'Deleted replay', eligibilityAt: at, taskVersion, incidentId });
      expect(await prisma.notification.count({ where: { tenantId, eventKey, userId: row.userId } })).toBe(0);
      const mutedKey = eventKey + ':muted';
      await prisma.notificationEvent.createMany({ data: [{ tenantId, eventKey: mutedKey, type, ...source, ownerId: row.userId,
        payload: { passwordChangedAt: passwordChangedAt.toISOString() } }], skipDuplicates: true });
      await saveNotificationPreferences(tenantId, row.userId, { ...DEFAULT_NOTIFICATION_PREFERENCES, inAppGeneral: false });
      try {
        await deliverNotification({ tenantId, userId: row.userId, eventKey: mutedKey, type, ...source, title: 'Preference check', eligibilityAt: at,
          taskVersion: type === 'task_overdue' ? overdueVersion : taskVersion, incidentId });
        expect(await prisma.notification.count({ where: { tenantId, eventKey: mutedKey, userId: row.userId } })).toBe(mandatoryNotification(type) ? 1 : 0);
      } finally { await saveNotificationPreferences(tenantId, row.userId, DEFAULT_NOTIFICATION_PREFERENCES); }
    }
  });

  it('uses identical recipient scopes in workers, GETs, mutations and a different actor context', async () => {
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Active View Only', permissions: { create: { module: 'leads', canView: true, canViewActive: true } } } });
    const user = await prisma.user.create({ data: { tenantId, role: role.name, firstName: 'Active', lastName: 'View', email: randomUUID() + '@camxian.com', userRoles: { create: { roleId: role.id } } } });
    const lead = await prisma.lead.create({ data: { tenantId, firstName: 'Cold', lastName: 'Lead', status: 'Cold', assignedUserId: user.id } });
    const check = async () => {
      const access = await notificationAccess(tenantId, user.id);
      expect(await access.resolve('Lead', lead.id)).toBeNull();
      expect(await access.eligible('customer_cold', 'Lead', lead.id)).toBe(false);
    };
    await check();
    for (const readRecords of [true, false]) await tenantContext.run({ tenantId }, () => crmActor.run({ tenantId, userId: admin, readRecords }, check));
    await dispatchTenantNotifications(tenantId, new Date(+at + 1000), 100);
    expect(await prisma.notification.count({ where: { tenantId, userId: user.id, entityId: lead.id } })).toBe(0);
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'Hot' } });
    expect(await (await notificationAccess(tenantId, user.id)).eligible('customer_hot', 'Lead', lead.id)).toBe(true);
    const second = await prisma.roleDefinition.create({ data: { tenantId, name: 'Additional My View', permissions: { create: { module: 'leads', canView: true, canViewMy: true } } } });
    await prisma.userRole.create({ data: { tenantId, userId: user.id, roleId: second.id } });
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'Cold' } });
    expect(await (await notificationAccess(tenantId, user.id)).eligible('customer_cold', 'Lead', lead.id)).toBe(true);
    await prisma.rolePermission.updateMany({ where: { tenantId, roleId: { in: [role.id, second.id] } }, data: { canViewMy: false, canViewActive: false } });
    expect(await (await notificationAccess(tenantId, user.id)).eligible('lead_assigned', 'Lead', lead.id)).toBe(false);
  });
});
