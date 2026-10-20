import { randomUUID } from 'node:crypto';
import type { NotificationEvent } from '@prisma/client';
import { NotificationTypes, SmsCampaignNotificationTypes, type SmsCampaignSummary, type NotificationType } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { tenantContext } from '../../core/tenant/tenant-context';
import { activeAdminWhere } from './notification-access';
import { deliverNotification, type CreateNotificationParams } from './notifications.service';
import { adminNotifications, assignmentNotifications, staffNotifications } from './notification-policy';
import { requireEmployeeAccount } from '../../core/auth/account-access';
import { AppError } from '../../shared/errors/app-error';
import { formatAssignmentChange } from '@leadcrm/shared';
import { assignmentEventFacts, resolveAssignmentNames } from './assignment-presentation';

type Event = Omit<CreateNotificationParams, 'userId'> & { ownerId?: string | null; actorId?: string | null; admins?: boolean };
export async function deliverEvent({ ownerId, actorId, admins, ...event }: Event) {
  const recipients = new Set<string>(staffNotifications.has(event.type) && ownerId
    && !(assignmentNotifications.has(event.type) && ownerId === actorId) ? [ownerId] : []);
  if (actorId && SmsCampaignNotificationTypes.includes(event.type as typeof SmsCampaignNotificationTypes[number])) recipients.add(actorId);
  if (admins && adminNotifications.has(event.type)) {
    const users = await prisma.user.findMany({ where: activeAdminWhere(event.tenantId), select: { id: true } });
    users.forEach(user => recipients.add(user.id));
  }
  if (recipients.size && !adminNotifications.has(event.type)) {
    const users = await prisma.user.findMany({ where: { ...activeAdminWhere(event.tenantId), id: { in: [...recipients] } }, select: { id: true } });
    users.forEach(user => recipients.delete(user.id));
  }
  for (const userId of recipients) await deliverNotification({ ...event, actorId, userId });
}

const titles: Record<NotificationType, string> = {
  password_expiring_soon: 'Password Expiring Soon',
  sms_campaign_sent: 'SMS Campaign Sent', sms_campaign_delivered: 'SMS Campaign Delivered',
  sms_campaign_failed: 'SMS Campaign Failed', sms_campaign_partial: 'SMS Campaign Partially Completed',
  sms_campaign_unconfirmed: 'SMS Campaign Pending Verification', sms_campaign_progress: 'SMS Campaign Delivery Update',
  lead_assigned: 'Lead Assigned to You', contact_assigned: 'Contact Assigned to You', account_assigned: 'Account Assigned to You',
  deal_assigned: 'Deal Assigned to You', task_assigned: 'New Task Assigned', customer_hot: 'Customer Became Hot',
  customer_cold: 'Customer became Cold', customer_cancelled: 'Customer became Cancelled', deal_progressed: 'Deal progressed',
  deal_won: 'Deal Closed Deal', deal_lost: 'Deal Cancelled', closing_requirements_needed: 'Closing Requirements Need Attention',
  closing_requirements_completed: 'Closing requirements completed', task_due: 'Task reminder', task_overdue: 'Task overdue',
  customer_reply: 'New Customer Reply', campaign_failed: 'Campaign Failed', workflow_failed: 'Workflow Failed',
  user_created: 'New Team Member', user_status_changed: 'Team Member Account Status Changed', mailbox_disconnected: 'Gmail Disconnected',
  mailbox_sync_failed: 'Persistent Gmail sync failure', form_processing_failed: 'Form processing failed',
  record_archived: 'Record archived', record_restored: 'Record restored',
  website_lead: 'New Website Lead', role_created: 'Role Created', role_archived: 'Role Deleted',
  role_permissions_changed: 'Role Permissions Updated', user_role_changed: 'User Role Updated',
};

type Facts = { version?: number; incidentId?: string; stage?: string; status?: string; name?: string; counts?: SmsCampaignSummary;
  assignedName?: string; value?: number; currency?: string; before?: unknown; after?: unknown; hasAccess?: boolean;
  securityEvent?: 'account_locked'; securityLockedAt?: string };
const safeName = (value: unknown, fallback: string) => typeof value === 'string' && value.trim()
  ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || fallback : fallback;

async function presentation(event: NotificationEvent, facts: Facts) {
  const type = event.type as NotificationType;
  const scope = { tenantId: event.tenantId, id: event.entityId };
  let stored: { name?: string; value?: number; currency?: string } = {};
  // Older pending events have no presentation snapshot. Read only approved fields.
  if (!facts.name) {
    if (event.entityType === 'Lead' || event.entityType === 'Contact' || event.entityType === 'User') {
      const row = event.entityType === 'Lead' ? await prisma.lead.findFirst({ where: scope, select: { firstName: true, lastName: true } })
        : event.entityType === 'Contact' ? await prisma.contact.findFirst({ where: scope, select: { firstName: true, lastName: true } })
        : await prisma.user.findFirst({ where: scope, select: { firstName: true, lastName: true } });
      if (row) stored.name = `${row.firstName} ${row.lastName}`.trim();
    } else if (event.entityType === 'Deal') {
      const row = await prisma.deal.findFirst({ where: scope, select: { title: true } });
      if (row) stored.name = row.title; // Never infer a historical closing amount from a later edit.
    } else if (event.entityType === 'Task') {
      const row = await prisma.task.findFirst({ where: scope, select: { title: true } }); if (row) stored.name = row.title;
    } else if (event.entityType === 'Campaign') {
      const row = await prisma.campaign.findFirst({ where: scope, select: { name: true } }); if (row) stored.name = row.name;
    } else if (event.entityType === 'Workflow') {
      const row = await prisma.workflow.findFirst({ where: scope, select: { name: true } }); if (row) stored.name = row.name;
    }
  }
  const name = safeName(facts.name ?? stored.name, event.entityType === 'Lead' || event.entityType === 'Contact' ? 'A customer' : `The ${event.entityType.toLowerCase()}`);
  let title = titles[type], body = 'Open the related record for details.';
  if (type === 'password_expiring_soon') body = 'Your password will expire tomorrow. Please change your password to avoid losing access.';
  if (type.startsWith('sms_campaign_') && facts.counts) {
    const c = facts.counts;
    if (type === 'sms_campaign_sent') body = `SMS campaign sent successfully. ${c.sent + c.delivered} of ${c.total} messages sent.`;
    else if (type === 'sms_campaign_delivered') body = `SMS campaign delivered successfully. ${c.delivered} of ${c.total} messages delivered.`;
    else if (type === 'sms_campaign_failed') body = `SMS campaign failed to send. ${c.failed} of ${c.total} messages failed.`;
    else if (type === 'sms_campaign_partial') body = `SMS campaign partially completed. Some messages failed. ${c.sent + c.delivered} of ${c.total} sent; ${c.failed} failed.`;
    else if (type === 'sms_campaign_progress') body = `SMS campaign update: ${c.failed} of ${c.total} messages failed; ${c.total - c.failed - c.sent - c.delivered} awaiting confirmation.`;
    else body = `SMS campaign status is pending verification. ${c.unconfirmed} of ${c.total} messages require review. Verified Sent messages are retained; uncertain messages are not resent.`;
  } else if (assignmentNotifications.has(type)) {
    const assignment = assignmentEventFacts(event);
    if (assignment) {
      const [resolved] = await resolveAssignmentNames(event.tenantId, [assignment]);
      const content = formatAssignmentChange(resolved);
      title = content.title; body = content.description;
    } else body = `${name} has been assigned to you.`;
  }
  else if (type === 'website_lead') body = `${name} submitted a new inquiry.${facts.assignedName ? ` Assigned to ${safeName(facts.assignedName, 'an agent')}.` : ''}`;
  else if (['customer_hot', 'customer_cold', 'customer_cancelled'].includes(type)) {
    const status = type.slice('customer_'.length); const label = status[0].toUpperCase() + status.slice(1);
    title = `${event.entityType} Became ${label}`; body = `${name} was ${status === 'cancelled' ? 'marked' : 'updated to'} ${label}.`;
  } else if (type === 'deal_won' || type === 'deal_lost') {
    body = `${name} was marked Closed ${type === 'deal_won' ? 'Won' : 'Lost'}.`;
    if (type === 'deal_won' && typeof facts.value === 'number' && Number.isFinite(facts.value) && /^[A-Z]{3}$/.test(facts.currency ?? '')) {
      try { body += ` Value: ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: facts.currency, minimumFractionDigits: 0 }).format(facts.value)}.`; } catch { /* Unknown currency: retain the accurate outcome. */ }
    }
    if (facts.assignedName) body += ` Responsible agent: ${safeName(facts.assignedName, 'assigned staff')}.`;
  } else if (type === 'closing_requirements_needed') body = `${name} requires closing information.`;
  else if (type === 'task_due' || type === 'task_overdue') body = `${name} is ${type === 'task_due' ? 'due soon' : 'overdue'}.`;
  else if (type === 'customer_reply') body = facts.name ? `${name} replied to a conversation assigned to you.` : 'A customer replied to a conversation assigned to you.';
  else if (type === 'campaign_failed') body = `${name} encountered a delivery failure. Review the Campaign.`;
  else if (type === 'workflow_failed') body = `${name} encountered an execution failure.`;
  else if (type === 'form_processing_failed') body = 'A published Form submission could not be processed.';
  else if (type === 'mailbox_disconnected') body = 'A connected Gmail mailbox requires reconnection.';
  else if (type === 'mailbox_sync_failed') body = 'A connected Gmail mailbox has a persistent synchronization failure. Review the connection.';
  else if (type === 'user_created') body = `${name} was added to your organization.`;
  else if (type === 'user_status_changed') {
    if (facts.securityEvent === 'account_locked') {
      title = 'Account Locked'; body = `${name}'s account was locked after repeated failed login attempts. Review User Management.`;
    } else if (facts.status === 'PENDING') {
      title = 'User Status Changed'; body = `${name}'s account status changed to Pending.`;
    } else {
      const status = facts.status === 'ACTIVE' ? 'Reactivated' : 'Deactivated'; title = `User ${status}`; body = `${name}'s account was ${status.toLowerCase()}.`;
    }
  } else if (type === 'role_created') body = `${name} was created.`;
  else if (type === 'role_archived') body = `"${name}" was deleted.`;
  else if (type === 'role_permissions_changed') body = `${name} permissions were updated.`;
  else if (type === 'user_role_changed') body = `${name}'s role assignment was updated.`;
  return { title, body };
}

async function project(event: NotificationEvent, now: Date) {
  if (!NotificationTypes.includes(event.type as NotificationType)) throw new Error('INVALID_EVENT_TYPE');
  const facts = event.payload as Facts;
  const type = event.type as NotificationType;
  if (!adminNotifications.has(type) && !staffNotifications.has(type)) return;
  if (['role_permissions_changed', 'user_role_changed'].includes(type) && JSON.stringify(facts.before) === JSON.stringify(facts.after)) return;
  if (['role_created', 'role_archived'].includes(type)) {
    const role = await prisma.roleDefinition.findFirst({ where: { tenantId: event.tenantId, id: event.entityId }, select: { isSystemRole: true } });
    if (!role || role.isSystemRole) return;
  }
  if (type === 'user_created') {
    const user = await prisma.user.findFirst({ where: { tenantId: event.tenantId, id: event.entityId }, select: { id: true, tenantId: true, email: true, role: true } });
    if (!user) return;
    try { await requireEmployeeAccount(user); } catch (error) { if (error instanceof AppError) return; throw error; }
  }
  if (type === 'user_status_changed') {
    if (facts.securityEvent === 'account_locked') {
      if (!facts.securityLockedAt || !Number.isFinite(Date.parse(facts.securityLockedAt))) return;
      const user = await prisma.user.findFirst({ where: { tenantId: event.tenantId, id: event.entityId,
        securityLockedAt: new Date(facts.securityLockedAt) }, select: { id: true } });
      if (!user) return;
    } else if (!['ACTIVE', 'INACTIVE', 'PENDING'].includes(facts.status ?? '')) return;
  }
  if (['task_due', 'task_overdue'].includes(event.type)) {
    const task = await prisma.task.findFirst({ where: { tenantId: event.tenantId, id: event.entityId, isArchived: false,
      assignedUserId: event.ownerId ?? '', status: { notIn: ['completed', 'cancelled'] }, notificationVersion: facts.version } });
    if (!task || (event.type === 'task_due' && task.dueDate <= now) || (event.type === 'task_overdue' && task.dueDate > now)) return;
  }
  if (event.entityType === 'Mailbox') {
    const account = await prisma.emailAccount.findFirst({ where: { tenantId: event.tenantId, id: event.entityId, notificationIncidentId: facts.incidentId } });
    if (!account || (!account.syncError && account.isActive) || (event.type === 'mailbox_sync_failed' && !account.isActive)) return;
  }
  const content = await presentation(event, facts);
  await deliverEvent({ tenantId: event.tenantId, eventKey: event.eventKey, type, ...content,
    entityType: event.entityType, entityId: event.entityId,
    ownerId: event.ownerId, actorId: event.actorId, admins: event.admins, occurredAt: event.occurredAt,
    taskVersion: facts.version, incidentId: facts.incidentId, eligibilityAt: now,
    securityLockedAt: type === 'user_status_changed' && facts.securityEvent === 'account_locked' ? facts.securityLockedAt : undefined });
}

/** A bounded lease claim never advances past unprocessed work. Expired leases recover on restart. */
export async function dispatchTenantNotifications(tenantId: string, now = new Date(), batchSize = 25) {
  const leaseToken = randomUUID();
  // These columns store UTC in timestamp-without-time-zone values. A Date bound
  // as timestamptz otherwise changes comparison meaning with the SQL session zone.
  const utcNow = now.toISOString();
  const utcLeaseUntil = new Date(+now + 120000).toISOString();
  const limit = Math.min(100, Math.max(1, batchSize));
  const scope = tenantContext.getStore();
  if (scope && scope.tenantId !== tenantId) throw new Error('NOTIFICATION_TENANT_MISMATCH');
  const events = await tenantContext.exit(async () => await prisma.$queryRaw<NotificationEvent[]>`
    WITH pending AS (
      SELECT e.id FROM "NotificationEvent" e
      WHERE e."tenantId"=${tenantId} AND e."processedAt" IS NULL AND e."availableAt"<=${utcNow}::timestamp
        AND (e."leaseUntil" IS NULL OR e."leaseUntil"<=${utcNow}::timestamp)
        AND (e.type NOT LIKE 'sms_campaign_%' OR NOT EXISTS (
          SELECT 1 FROM "NotificationEvent" earlier WHERE earlier."tenantId"=e."tenantId"
            AND earlier."entityId"=e."entityId" AND earlier.type LIKE 'sms_campaign_%'
            AND earlier."processedAt" IS NULL
            AND (earlier.payload->>'sequence')::int < (e.payload->>'sequence')::int
        ))
      ORDER BY e."availableAt",e.id FOR UPDATE OF e SKIP LOCKED LIMIT ${limit}
    )
    UPDATE "NotificationEvent" e SET "leaseToken"=${leaseToken}, "leaseUntil"=${utcLeaseUntil}::timestamp, attempts=attempts+1
    FROM pending WHERE e.id=pending.id RETURNING e.*`);
  let processed = 0, failed = 0;
  for (const event of events) {
    try {
      await project(event, now);
      await prisma.notificationEvent.updateMany({ where: { id: event.id, tenantId, leaseToken },
        data: { processedAt: new Date(), leaseUntil: null, leaseToken: null, lastError: null } });
      processed++;
    } catch (error) {
      // Never persist exception text: database/provider errors can contain sensitive inputs.
      const category = error instanceof Error && error.message === 'INVALID_EVENT_TYPE' ? 'invalid_event_type' : 'delivery_failed';
      const delay = Math.min(3600000, 1000 * 2 ** Math.min(event.attempts, 12));
      await prisma.notificationEvent.updateMany({ where: { id: event.id, tenantId, leaseToken },
        data: { availableAt: new Date(+now + delay), leaseUntil: null, leaseToken: null, lastError: category } });
      failed++;
      console.warn('[Notifications] Delivery deferred', { tenantId, eventId: event.id, type: event.type, attempts: event.attempts, category });
    }
  }
  return { claimed: events.length, processed, failed };
}

const dispatching = new Map<string, Promise<void>>();
const dispatchRequested = new Set<string>();
/** Low-latency wake-up; the durable scheduler remains responsible after crashes. */
export function requestNotificationDispatch(tenantId: string) {
  if (process.env.NOTIFICATION_WORKER_ENABLED === 'false') return;
  dispatchRequested.add(tenantId);
  if (dispatching.has(tenantId)) return;
  const work = tenantContext.run({ tenantId }, async () => {
    dispatchRequested.delete(tenantId);
    for (let batch = 0; batch < 8; batch++) {
      const result = await dispatchTenantNotifications(tenantId);
      if (!result.claimed || result.failed) break;
    }
  }).catch(() => { console.warn('[Notifications] Immediate dispatch deferred to durable worker', { tenantId }); })
    .finally(() => { dispatching.delete(tenantId); if (dispatchRequested.has(tenantId)) requestNotificationDispatch(tenantId); });
  dispatching.set(tenantId, work);
}

// Compatibility entrypoint: reminders now live in the same durable queue.
export const dispatchTaskReminders = dispatchTenantNotifications;
let discoveryAfter: string | undefined;
export async function runNotificationWorker() {
  // Traverse a bounded tenant window fairly, including idle tenants. Delivery state
  // remains in the outbox; restarting this discovery cursor cannot skip an event.
  let tenants = await prisma.tenant.findMany({ where: discoveryAfter ? { id: { gt: discoveryAfter } } : {}, orderBy: { id: 'asc' }, take: 50, select: { id: true } });
  if (!tenants.length && discoveryAfter) {
    discoveryAfter = undefined;
    tenants = await prisma.tenant.findMany({ orderBy: { id: 'asc' }, take: 50, select: { id: true } });
  }
  discoveryAfter = tenants[tenants.length - 1]?.id;
  for (const tenant of tenants) {
    try { await tenantContext.run({ tenantId: tenant.id }, () => dispatchTenantNotifications(tenant.id)); }
    catch { console.warn('[Notifications] Tenant delivery unavailable', { tenantId: tenant.id }); }
  }
}
export function startNotificationScheduler() {
  let stopped = false;
  let running: Promise<void> | undefined;
  const run = () => {
    if (stopped || running) return;
    running = runNotificationWorker().catch(() => { console.warn('[Notifications] Queue unavailable'); }).finally(() => { running = undefined; });
  };
  run();
  const timer = setInterval(run, 5000);
  timer.unref();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
