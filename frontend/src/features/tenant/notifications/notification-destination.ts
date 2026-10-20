import type { NotificationRecord } from '@leadcrm/shared';
import { NotificationRecordTargetSchema } from '@leadcrm/shared';
import { notificationsApi } from '@/shared/services/notifications.api';
import { toast } from 'sonner';

export function opensNotificationRecord(notification: Pick<NotificationRecord, 'entityType' | 'entityId'>): boolean {
  return NotificationRecordTargetSchema.safeParse({ entityType: notification.entityType, entityId: notification.entityId }).success;
}

/** Only application-owned destinations; notification data cannot supply arbitrary URLs. */
export function notificationDestination(notification: Pick<NotificationRecord, 'entityType' | 'entityId'>): string | undefined {
  const paths: Record<string, string> = { Lead: '/crm/leads', Contact: '/crm/contacts', Account: '/crm/accounts', Deal: '/crm/deals' };
  if (notification.entityType && paths[notification.entityType] && notification.entityId) return `${paths[notification.entityType]}/${encodeURIComponent(notification.entityId)}`;
  if (notification.entityType === 'Task') return `/operations/taskboard?taskId=${encodeURIComponent(notification.entityId ?? '')}`;
  return ({ User: '/settings?tab=users', RoleDefinition: '/settings?tab=roles', Workflow: '/automation/workflows', Campaign: '/marketing/campaigns', Mailbox: '/inbox', Form: '/marketing/forms' } as Record<string, string>)[notification.entityType ?? ''];
}

/** Reauthorize at click time, including after ownership or permission changes. */
export async function resolveNotificationDestination(id: string): Promise<string | undefined> {
  try {
    const result = await notificationsApi.destination(id);
    if (result.destination?.startsWith('/') && !result.destination.startsWith('//')) return result.destination;
    toast.info('The related record is unavailable or your access has changed.');
  } catch { toast.error('Unable to open this notification. Please try again.'); }
}
