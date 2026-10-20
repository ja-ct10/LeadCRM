import { z } from 'zod';

/** Assignment facts are frozen in existing Activity metadata and outbox payloads. */
export interface AssignmentChangeFacts {
  assignmentChanged?: boolean;
  previousAssignedUserId?: string | null;
  newAssignedUserId?: string | null;
  previousAssignedName?: string | null;
  assignedName?: string | null;
  actorName?: string | null;
  reason?: string | null;
}

export function assignmentName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return name && !['undefined', 'null'].includes(name.toLowerCase()) ? name : undefined;
}

export function assignmentUserName(user?: { firstName?: string | null; lastName?: string | null } | null): string | undefined {
  return assignmentName([user?.firstName, user?.lastName].filter(Boolean).join(' '));
}

export function formatAssignmentChange(facts: AssignmentChangeFacts): { title: string; description: string } {
  const previous = assignmentName(facts.previousAssignedName);
  const next = assignmentName(facts.assignedName);
  const title = next ? `Assigned Agent changed to ${next}` : 'Assigned Agent changed';
  if (facts.reason === 'user_deactivation') {
    return { title, description: `Ownership transferred because ${previous ?? 'the previous agent'} was deactivated. ${next ? `The record is now assigned to ${next}.` : 'The record was reassigned.'}` };
  }
  if (next && previous) return { title, description: `Assigned Agent changed from ${previous} to ${next}.` };
  if (next) return { title, description: `${facts.previousAssignedUserId === null ? 'The record was previously unassigned. ' : ''}The record is now assigned to ${next}.` };
  return { title, description: 'The record\'s Assigned Agent was updated.' };
}

export interface NotificationRecord {
  id: string; tenantId: string; userId: string;
  type: string; title: string; body?: string | null;
  entityType?: string | null; entityId?: string | null;
  isRead: boolean; readAt?: string | null; createdAt: string;
  occurredAt?: string | null;
  available?: boolean;
}
export interface NotificationsResponse {
  success: boolean; data: NotificationRecord[]; unreadCount: number; totalCount: number;
  meta: { total: number; page: number; limit: number; hasMore: boolean; nextCursor?: string | null; snapshot?: string };
}
export const DeleteNotificationsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500).transform(ids => [...new Set(ids)]),
}).strict();

export interface NotificationMutationResponse {
  success: boolean;
  totalCount: number;
  unreadCount: number;
  unreadByModule?: Record<string, number>;
  unreadRecords?: UnreadNotificationRecord[];
  readBefore?: string;
  readRecord?: NotificationRecordTarget;
}

export const NotificationRecordTargetSchema = z.object({
  entityType: z.enum(['Lead', 'Contact', 'Account', 'Deal', 'Task', 'Campaign', 'Workflow', 'Form']),
  entityId: z.string().uuid(),
}).strict();
export type NotificationRecordTarget = z.infer<typeof NotificationRecordTargetSchema>;
export interface UnreadNotificationRecord extends NotificationRecordTarget { count: number }
export const MarkNotificationsReadSchema = z.object({
  before: z.string().datetime().optional(),
  record: NotificationRecordTargetSchema.optional(),
}).strict();

export interface SmsCampaignSummary {
  total: number; pending: number; submitting: number; submitted: number;
  sent: number; delivered: number; failed: number; unconfirmed: number;
}
export interface NotificationCountsResponse extends NotificationMutationResponse {
  updates?: NotificationRecord[];
  cursor?: string;
  hasMore?: boolean;
  /** Fast checks expire even when an offline gateway never reports a result. */
  activeSmsUntil?: string | null;
}

export const SmsCampaignNotificationTypes = [
  'sms_campaign_sent', 'sms_campaign_delivered', 'sms_campaign_failed',
  'sms_campaign_partial', 'sms_campaign_unconfirmed', 'sms_campaign_progress',
] as const;

export const NotificationTypes = [
  'password_expiring_soon',
  'lead_assigned', 'contact_assigned', 'account_assigned', 'deal_assigned', 'task_assigned',
  'customer_hot', 'customer_cold', 'customer_cancelled', 'deal_progressed', 'deal_won', 'deal_lost',
  'closing_requirements_needed', 'closing_requirements_completed', 'task_due', 'task_overdue',
  'customer_reply', 'campaign_failed', 'workflow_failed', 'user_created', 'user_status_changed',
  'mailbox_disconnected', 'mailbox_sync_failed', 'form_processing_failed', 'record_archived', 'record_restored',
  'website_lead', 'role_created', 'role_archived', 'role_permissions_changed', 'user_role_changed',
  ...SmsCampaignNotificationTypes,
] as const;
export type NotificationType = typeof NotificationTypes[number];
export const NotificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z.enum(['true', 'false']).optional(),
  unreadOnly: z.enum(['true', 'false']).optional(),
  cursor: z.string().max(1024).optional(),
  snapshot: z.string().datetime().optional(),
}).strict();
export const NotificationPreferencesSchema = z.object({
  leadAssignmentEmail: z.literal(false),
  dailyPipelineBriefing: z.literal(false),
  urgentHotLeadSms: z.literal(false),
  inAppGeneral: z.boolean(),
}).strict();
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  leadAssignmentEmail: false, dailyPipelineBriefing: false, urgentHotLeadSms: false, inAppGeneral: true,
};
export interface NotificationPreferencesResponse {
  success: boolean;
  data: NotificationPreferences;
  availability: { leadAssignmentEmail: false; dailyPipelineBriefing: false; urgentHotLeadSms: false; inAppGeneral: true };
}
