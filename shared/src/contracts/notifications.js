"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NOTIFICATION_PREFERENCES = exports.NotificationPreferencesSchema = exports.NotificationQuerySchema = exports.NotificationTypes = exports.SmsCampaignNotificationTypes = exports.MarkNotificationsReadSchema = exports.NotificationRecordTargetSchema = exports.DeleteNotificationsSchema = void 0;
exports.assignmentName = assignmentName;
exports.assignmentUserName = assignmentUserName;
exports.formatAssignmentChange = formatAssignmentChange;
const zod_1 = require("zod");
function assignmentName(value) {
    if (typeof value !== 'string')
        return undefined;
    const name = value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    return name && !['undefined', 'null'].includes(name.toLowerCase()) ? name : undefined;
}
function assignmentUserName(user) {
    return assignmentName([user?.firstName, user?.lastName].filter(Boolean).join(' '));
}
function formatAssignmentChange(facts) {
    const previous = assignmentName(facts.previousAssignedName);
    const next = assignmentName(facts.assignedName);
    const title = next ? `Assigned Agent changed to ${next}` : 'Assigned Agent changed';
    if (facts.reason === 'user_deactivation') {
        return { title, description: `Ownership transferred because ${previous ?? 'the previous agent'} was deactivated. ${next ? `The record is now assigned to ${next}.` : 'The record was reassigned.'}` };
    }
    if (next && previous)
        return { title, description: `Assigned Agent changed from ${previous} to ${next}.` };
    if (next)
        return { title, description: `${facts.previousAssignedUserId === null ? 'The record was previously unassigned. ' : ''}The record is now assigned to ${next}.` };
    return { title, description: 'The record\'s Assigned Agent was updated.' };
}
exports.DeleteNotificationsSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(500).transform(ids => [...new Set(ids)]),
}).strict();
exports.NotificationRecordTargetSchema = zod_1.z.object({
    entityType: zod_1.z.enum(['Lead', 'Contact', 'Account', 'Deal', 'Task', 'Campaign', 'Workflow', 'Form']),
    entityId: zod_1.z.string().uuid(),
}).strict();
exports.MarkNotificationsReadSchema = zod_1.z.object({
    before: zod_1.z.string().datetime().optional(),
    record: exports.NotificationRecordTargetSchema.optional(),
}).strict();
exports.SmsCampaignNotificationTypes = [
    'sms_campaign_sent', 'sms_campaign_delivered', 'sms_campaign_failed',
    'sms_campaign_partial', 'sms_campaign_unconfirmed', 'sms_campaign_progress',
];
exports.NotificationTypes = [
    'password_expiring_soon',
    'lead_assigned', 'contact_assigned', 'account_assigned', 'deal_assigned', 'task_assigned',
    'customer_hot', 'customer_cold', 'customer_cancelled', 'deal_progressed', 'deal_won', 'deal_lost',
    'closing_requirements_needed', 'closing_requirements_completed', 'task_due', 'task_overdue',
    'customer_reply', 'campaign_failed', 'workflow_failed', 'user_created', 'user_status_changed',
    'mailbox_disconnected', 'mailbox_sync_failed', 'form_processing_failed', 'record_archived', 'record_restored',
    'website_lead', 'role_created', 'role_archived', 'role_permissions_changed', 'user_role_changed',
    ...exports.SmsCampaignNotificationTypes,
];
exports.NotificationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).max(10000).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    isRead: zod_1.z.enum(['true', 'false']).optional(),
    unreadOnly: zod_1.z.enum(['true', 'false']).optional(),
    cursor: zod_1.z.string().max(1024).optional(),
    snapshot: zod_1.z.string().datetime().optional(),
}).strict();
exports.NotificationPreferencesSchema = zod_1.z.object({
    leadAssignmentEmail: zod_1.z.literal(false),
    dailyPipelineBriefing: zod_1.z.literal(false),
    urgentHotLeadSms: zod_1.z.literal(false),
    inAppGeneral: zod_1.z.boolean(),
}).strict();
exports.DEFAULT_NOTIFICATION_PREFERENCES = {
    leadAssignmentEmail: false, dailyPipelineBriefing: false, urgentHotLeadSms: false, inAppGeneral: true,
};
