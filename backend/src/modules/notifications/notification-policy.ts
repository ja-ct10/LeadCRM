import { SmsCampaignNotificationTypes, type NotificationType } from '@leadcrm/shared';

export const assignmentNotifications = new Set<NotificationType>([
  'lead_assigned', 'contact_assigned', 'account_assigned', 'deal_assigned', 'task_assigned',
]);
export const adminNotifications = new Set<NotificationType>([
  'password_expiring_soon',
  'user_created', 'user_status_changed',
  'role_created', 'role_archived', 'role_permissions_changed', 'user_role_changed',
]);
export const staffNotifications = new Set<NotificationType>([
  'password_expiring_soon',
  ...SmsCampaignNotificationTypes,
  ...assignmentNotifications, 'customer_hot', 'customer_cold', 'customer_cancelled', 'deal_won', 'deal_lost',
  'closing_requirements_needed', 'task_due', 'task_overdue', 'customer_reply',
  'campaign_failed', 'mailbox_disconnected', 'mailbox_sync_failed',
]);

export const notificationEntities: Partial<Record<NotificationType, readonly string[]>> = {
  password_expiring_soon: ['PasswordSecurity'],
  ...Object.fromEntries(SmsCampaignNotificationTypes.map(type => [type, ['Campaign']])),
  website_lead: ['Lead'], lead_assigned: ['Lead'], contact_assigned: ['Contact'], account_assigned: ['Account'], deal_assigned: ['Deal'], task_assigned: ['Task'],
  customer_hot: ['Lead', 'Contact'], customer_cold: ['Lead', 'Contact'], customer_cancelled: ['Lead', 'Contact'],
  deal_won: ['Deal'], deal_lost: ['Deal'], closing_requirements_needed: ['Deal'], task_due: ['Task'], task_overdue: ['Task'],
  customer_reply: ['MailboxMessage'], campaign_failed: ['Campaign'], workflow_failed: ['Workflow'], form_processing_failed: ['Form'],
  mailbox_disconnected: ['Mailbox'], mailbox_sync_failed: ['Mailbox'], user_created: ['User'], user_status_changed: ['User'], user_role_changed: ['User'],
  role_created: ['RoleDefinition'], role_archived: ['RoleDefinition'], role_permissions_changed: ['RoleDefinition'],
};
