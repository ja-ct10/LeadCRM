"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailboxDealAssociationSchema = exports.MailboxBulkActionSchema = exports.MailboxConversationPageSchema = exports.MailboxConversationReadStateSchema = exports.MailboxConversationIdSchema = exports.ScheduleMailboxEmailSchema = exports.MailboxListSchema = exports.SaveMailboxDraftSchema = exports.MailboxReadStateSchema = exports.MAILBOX_FILTERS = exports.SendMailboxEmailSchema = exports.MailboxComposeContextSchema = exports.MailboxUploadAttachmentsSchema = exports.MailboxUploadAttachmentSchema = exports.MAILBOX_ATTACHMENT_TYPES = exports.MAILBOX_ATTACHMENTS_MAX_BYTES = exports.MAILBOX_ATTACHMENT_MAX_BYTES = exports.MailboxRecordContextSchema = exports.MAILBOX_COMPOSE_MODES = exports.ClosedWonConfirmationSchema = exports.CLOSED_WON_CONFIRMATION_TYPES = void 0;
exports.mailboxAttachmentType = mailboxAttachmentType;
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
exports.MailboxRecordContextSchema = zod_1.z.object({ recordModule: zod_1.z.enum(['leads', 'contacts']), recordId: zod_1.z.string().min(1).max(200) }).strict();
exports.MAILBOX_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
exports.MAILBOX_ATTACHMENTS_MAX_BYTES = 10 * 1024 * 1024;
exports.MAILBOX_ATTACHMENT_TYPES = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    txt: 'text/plain', csv: 'text/csv', zip: 'application/zip', doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
function mailboxAttachmentType(filename) { return exports.MAILBOX_ATTACHMENT_TYPES[filename.split('.').pop()?.toLowerCase() ?? '']; }
exports.MailboxUploadAttachmentSchema = zod_1.z.object({
    filename: zod_1.z.string().trim().min(1).max(255).refine(value => !/[\\/\u0000-\u001f\u007f]/.test(value) && !!mailboxAttachmentType(value), 'Choose a supported document or image.'),
    mimeType: zod_1.z.string().max(150),
    content: zod_1.z.string().min(4).max(4 * Math.ceil(exports.MAILBOX_ATTACHMENT_MAX_BYTES / 3))
        .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Invalid attachment encoding')
        .refine(value => value.length % 4 === 0 && value.length * 3 / 4 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0) <= exports.MAILBOX_ATTACHMENT_MAX_BYTES, 'Invalid attachment encoding or size'),
}).strict().refine(file => file.mimeType === mailboxAttachmentType(file.filename), 'Attachment type does not match its filename');
exports.MailboxUploadAttachmentsSchema = zod_1.z.array(exports.MailboxUploadAttachmentSchema).max(10).refine(files => files.reduce((sum, file) => sum + file.content.length * 3 / 4 - (file.content.endsWith('==') ? 2 : file.content.endsWith('=') ? 1 : 0), 0) <= exports.MAILBOX_ATTACHMENTS_MAX_BYTES, 'Attachments must total 10 MB or less');
const recordComposeFields = { recordContext: exports.MailboxRecordContextSchema.optional(), dealId: zod_1.z.string().min(1).max(200).optional() };
exports.MailboxComposeContextSchema = zod_1.z.object({
    ...recordComposeFields,
    composeMode: zod_1.z.enum(exports.MAILBOX_COMPOSE_MODES).optional(),
    replyToMessageId: sourceId.optional(),
    forwardSourceMessageId: sourceId.optional(),
}).transform(value => ({ ...value, composeMode: value.composeMode ?? (value.replyToMessageId ? 'reply' : value.forwardSourceMessageId ? 'forward' : 'compose') }))
    .refine(value => value.composeMode === 'compose' ? !value.replyToMessageId && !value.forwardSourceMessageId
    : value.composeMode === 'forward' ? !!value.forwardSourceMessageId && !value.replyToMessageId
        : !!value.replyToMessageId && !value.forwardSourceMessageId, 'Choose the original message for Reply, Reply All or Forward.');
exports.SendMailboxEmailSchema = zod_1.z.object({
    ...recordComposeFields,
    attachments: exports.MailboxUploadAttachmentsSchema.optional(),
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
    ...recordComposeFields,
    attachments: exports.MailboxUploadAttachmentsSchema.optional(),
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
