"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailboxDealAssociationSchema = exports.MailboxBulkActionSchema = exports.MailboxConversationPageSchema = exports.MailboxConversationReadStateSchema = exports.MailboxConversationIdSchema = exports.ScheduleMailboxEmailSchema = exports.MailboxListSchema = exports.SaveMailboxDraftSchema = exports.MailboxReadStateSchema = exports.MAILBOX_FILTERS = exports.SendMailboxEmailSchema = exports.MailboxComposeContextSchema = exports.MAILBOX_COMPOSE_MODES = exports.ClosedWonConfirmationSchema = exports.CLOSED_WON_CONFIRMATION_TYPES = void 0;
const zod_1 = require("zod");
exports.CLOSED_WON_CONFIRMATION_TYPES = ['Approved Quotation', 'Signed/Approved Contract', 'Purchase Order Received', 'Order Confirmed', 'Other'];
exports.ClosedWonConfirmationSchema = zod_1.z.object({
    type: zod_1.z.enum(exports.CLOSED_WON_CONFIRMATION_TYPES),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a Closed Deal date').refine(value => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() <= Date.now() + 86400000;
    }, 'Choose a valid date that is not in the future'),
    note: zod_1.z.string().trim().max(2000).optional(),
}).strict().refine(value => value.type !== 'Other' || !!value.note?.trim(), { path: ['note'], message: 'Explain how the sale was confirmed' });
const header = zod_1.z.string().trim().min(1).max(998).refine(value => !/[\r\n]/.test(value), 'Invalid email header');
const recipient = zod_1.z.string().trim().max(254).email().refine(value => !/[\r\n]/.test(value), 'Invalid email address');
exports.MAILBOX_COMPOSE_MODES = ['compose', 'reply', 'replyAll', 'forward'];
const sourceId = zod_1.z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200);
exports.MailboxComposeContextSchema = zod_1.z.object({
    dealId: zod_1.z.string().min(1).max(200).optional(),
    composeMode: zod_1.z.enum(exports.MAILBOX_COMPOSE_MODES).optional(),
    replyToMessageId: sourceId.optional(),
    forwardSourceMessageId: sourceId.optional(),
}).transform(value => ({ ...value, composeMode: value.composeMode ?? (value.replyToMessageId ? 'reply' : value.forwardSourceMessageId ? 'forward' : 'compose') }))
    .refine(value => value.composeMode === 'compose' ? !value.replyToMessageId && !value.forwardSourceMessageId
    : value.composeMode === 'forward' ? !!value.forwardSourceMessageId && !value.replyToMessageId
        : !!value.replyToMessageId && !value.forwardSourceMessageId, 'Choose the original message for Reply, Reply All or Forward.');
exports.SendMailboxEmailSchema = zod_1.z.object({
    dealId: zod_1.z.string().min(1).max(200).optional(),
    requestId: zod_1.z.string().uuid(),
    to: zod_1.z.union([recipient, zod_1.z.array(recipient).min(1).max(50)]),
    subject: header,
    body: zod_1.z.string().trim().min(1).max(200000),
    replyToMessageId: zod_1.z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
    forwardSourceMessageId: zod_1.z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
    draftId: zod_1.z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
    composeMode: zod_1.z.enum(exports.MAILBOX_COMPOSE_MODES).optional(),
}).strict();
exports.MAILBOX_FILTERS = ['all', 'unread', 'sent', 'scheduled', 'drafts'];
exports.MailboxReadStateSchema = zod_1.z.object({ isRead: zod_1.z.boolean() }).strict();
exports.SaveMailboxDraftSchema = zod_1.z.object({
    dealId: exports.SendMailboxEmailSchema.shape.dealId,
    requestId: zod_1.z.string().uuid(),
    to: zod_1.z.string().max(998).refine(value => !/[\r\n]/.test(value)),
    subject: zod_1.z.string().max(998).refine(value => !/[\r\n]/.test(value)),
    body: zod_1.z.string().max(200000),
    draftId: zod_1.z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
    replyToMessageId: exports.SendMailboxEmailSchema.shape.replyToMessageId,
    forwardSourceMessageId: exports.SendMailboxEmailSchema.shape.forwardSourceMessageId,
    composeMode: exports.SendMailboxEmailSchema.shape.composeMode,
}).strict();
exports.MailboxListSchema = zod_1.z.object({
    view: zod_1.z.enum(['inbox', 'archived']).default('inbox'),
    filter: zod_1.z.enum(exports.MAILBOX_FILTERS).default('all'),
    sort: zod_1.z.enum(['newest', 'oldest', 'unread']).default('newest'),
    query: zod_1.z.string().trim().max(1000).optional(),
    maxResults: zod_1.z.coerce.number().int().min(1).max(50).default(30),
    pageToken: zod_1.z.string().max(2000).optional(),
}).refine(value => value.view !== 'archived' || value.filter === 'all' || value.filter === 'unread', 'Archived Messages supports All or Unread.');
exports.ScheduleMailboxEmailSchema = exports.SendMailboxEmailSchema.extend({
    scheduledAt: zod_1.z.string().datetime().refine(value => Date.parse(value) > Date.now(), 'Choose a future date and time'),
    requestId: zod_1.z.string().uuid(),
    draftId: zod_1.z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
}).strict();
const providerId = zod_1.z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200);
exports.MailboxConversationIdSchema = zod_1.z.string().regex(/^c_[a-f0-9]{32}$/);
exports.MailboxConversationReadStateSchema = exports.MailboxReadStateSchema.extend({
    pageToken: zod_1.z.string().max(2000).optional(),
}).strict();
exports.MailboxConversationPageSchema = zod_1.z.object({
    maxResults: zod_1.z.coerce.number().int().min(1).max(50).default(50),
    pageToken: zod_1.z.string().max(2000).optional(),
});
exports.MailboxBulkActionSchema = zod_1.z.union([
    zod_1.z.object({ conversationIds: zod_1.z.array(exports.MailboxConversationIdSchema).min(1).max(100) }).strict(),
    zod_1.z.object({ threadIds: zod_1.z.array(providerId).min(1).max(100) }).strict(),
    zod_1.z.object({ messageIds: zod_1.z.array(providerId).min(1).max(100) }).strict(),
]);
exports.MailboxDealAssociationSchema = zod_1.z.object({
    dealId: zod_1.z.string().min(1).max(200),
    conversationId: exports.MailboxConversationIdSchema.optional(),
    messageId: providerId.optional(),
}).strict().refine(value => !(value.conversationId && value.messageId), 'Choose one message or conversation.');
