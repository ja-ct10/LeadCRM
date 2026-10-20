import { z } from 'zod';

export const CLOSED_WON_CONFIRMATION_TYPES = ['Approved Quotation', 'Signed/Approved Contract', 'Purchase Order Received', 'Order Confirmed', 'Other'] as const;
export const ClosedWonConfirmationSchema = z.object({
  type: z.enum(CLOSED_WON_CONFIRMATION_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a Closed Deal date').refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() <= Date.now() + 86400000;
  }, 'Choose a valid date that is not in the future'),
  note: z.string().trim().max(2000).optional(),
}).strict().refine(value => value.type !== 'Other' || !!value.note?.trim(), { path: ['note'], message: 'Explain how the sale was confirmed' });
export type ClosedWonConfirmation = z.infer<typeof ClosedWonConfirmationSchema>;

const header = z.string().trim().min(1).max(998).refine(value => !/[\r\n]/.test(value), 'Invalid email header');
const recipient = z.string().trim().max(254).email().refine(value => !/[\r\n]/.test(value), 'Invalid email address');
export const MAILBOX_COMPOSE_MODES = ['compose', 'reply', 'replyAll', 'forward'] as const;
export type MailboxComposeMode = typeof MAILBOX_COMPOSE_MODES[number];
const sourceId = z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200);
export const MailboxRecordContextSchema = z.object({ recordModule: z.enum(['leads', 'contacts']), recordId: z.string().min(1).max(200) }).strict();
export type MailboxRecordContext = z.infer<typeof MailboxRecordContextSchema>;
export const MAILBOX_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const MAILBOX_ATTACHMENTS_MAX_BYTES = 10 * 1024 * 1024;
export const MAILBOX_ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  txt: 'text/plain', csv: 'text/csv', zip: 'application/zip', doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export function mailboxAttachmentType(filename: string) { return MAILBOX_ATTACHMENT_TYPES[filename.split('.').pop()?.toLowerCase() ?? '']; }
export const MailboxUploadAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255).refine(value => !/[\\/\u0000-\u001f\u007f]/.test(value) && !!mailboxAttachmentType(value), 'Choose a supported document or image.'),
  mimeType: z.string().max(150),
  content: z.string().min(4).max(4 * Math.ceil(MAILBOX_ATTACHMENT_MAX_BYTES / 3))
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Invalid attachment encoding')
    .refine(value => value.length % 4 === 0 && value.length * 3 / 4 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0) <= MAILBOX_ATTACHMENT_MAX_BYTES, 'Invalid attachment encoding or size'),
}).strict().refine(file => file.mimeType === mailboxAttachmentType(file.filename), 'Attachment type does not match its filename');
export type MailboxUploadAttachment = z.infer<typeof MailboxUploadAttachmentSchema>;
export const MailboxUploadAttachmentsSchema = z.array(MailboxUploadAttachmentSchema).max(10).refine(files => files.reduce((sum, file) => sum + file.content.length * 3 / 4 - (file.content.endsWith('==') ? 2 : file.content.endsWith('=') ? 1 : 0), 0) <= MAILBOX_ATTACHMENTS_MAX_BYTES, 'Attachments must total 10 MB or less');
const recordComposeFields = { recordContext: MailboxRecordContextSchema.optional(), dealId: z.string().min(1).max(200).optional() };
export const MailboxComposeContextSchema = z.object({
  ...recordComposeFields,
  composeMode: z.enum(MAILBOX_COMPOSE_MODES).optional(),
  replyToMessageId: sourceId.optional(),
  forwardSourceMessageId: sourceId.optional(),
}).transform(value => ({ ...value, composeMode: value.composeMode ?? (value.replyToMessageId ? 'reply' : value.forwardSourceMessageId ? 'forward' : 'compose') as MailboxComposeMode }))
  .refine(value => value.composeMode === 'compose' ? !value.replyToMessageId && !value.forwardSourceMessageId
    : value.composeMode === 'forward' ? !!value.forwardSourceMessageId && !value.replyToMessageId
    : !!value.replyToMessageId && !value.forwardSourceMessageId, 'Choose the original message for Reply, Reply All or Forward.');
export const SendMailboxEmailSchema = z.object({
  ...recordComposeFields,
  attachments: MailboxUploadAttachmentsSchema.optional(),
  requestId: z.string().uuid(),
  to: z.union([recipient, z.array(recipient).min(1).max(50)]),
  subject: header,
  body: z.string().trim().min(1).max(200000),
  replyToMessageId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
  forwardSourceMessageId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
  draftId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
  composeMode: z.enum(MAILBOX_COMPOSE_MODES).optional(),
}).strict();

export const MAILBOX_FILTERS = ['all', 'unread', 'sent', 'scheduled', 'drafts'] as const;
export const MailboxReadStateSchema = z.object({ isRead: z.boolean() }).strict();
export const SaveMailboxDraftSchema = z.object({
  ...recordComposeFields,
  attachments: MailboxUploadAttachmentsSchema.optional(),
  requestId: z.string().uuid(),
  to: z.string().max(998).refine(value => !/[\r\n]/.test(value)),
  subject: z.string().max(998).refine(value => !/[\r\n]/.test(value)),
  body: z.string().max(200000),
  draftId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
  replyToMessageId: SendMailboxEmailSchema.shape.replyToMessageId,
  forwardSourceMessageId: SendMailboxEmailSchema.shape.forwardSourceMessageId,
  composeMode: SendMailboxEmailSchema.shape.composeMode,
}).strict();
export const MailboxListSchema = z.object({
  view: z.enum(['inbox', 'archived']).default('inbox'),
  filter: z.enum(MAILBOX_FILTERS).default('all'),
  sort: z.enum(['newest', 'oldest', 'unread']).default('newest'),
  query: z.string().trim().max(1000).optional(),
  maxResults: z.coerce.number().int().min(1).max(50).default(30),
  pageToken: z.string().max(2000).optional(),
}).refine(value => value.view !== 'archived' || value.filter === 'all' || value.filter === 'unread', 'Archived Messages supports All or Unread.');
export type MailboxListOptions = z.input<typeof MailboxListSchema>;
export const ScheduleMailboxEmailSchema = SendMailboxEmailSchema.extend({
  scheduledAt: z.string().datetime().refine(value => Date.parse(value) > Date.now(), 'Choose a future date and time'),
  requestId: z.string().uuid(),
  draftId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200).optional(),
}).strict();

export interface MailboxAttachment {
  id: string; filename: string; mimeType: string; size?: number;
  contentId?: string;
  disposition?: 'inline' | 'attachment';
  /** Gmail MIME part locator; bytes remain in Gmail, never in this metadata. */
  partId?: string;
}
export interface MailboxMessageContent { body: string; attachments: MailboxAttachment[] }

export interface MailboxEmail {
  id: string;
  threadId: string;
  /** Inbox identity only. Never pass this value to Gmail as a thread ID. */
  conversationId?: string;
  conversationKind?: 'person' | 'group';
  correspondentAddresses?: string[];
  rfcMessageId?: string;
  rfcInReplyTo?: string | null;
  rfcReferences?: string[];
  draftId?: string;
  composeMode?: MailboxComposeMode;
  replyToMessageId?: string;
  forwardSourceMessageId?: string;
  draftContextRequired?: boolean;
  recordContext?: MailboxRecordContext;
  from: string;
  to: string[];
  cc?: string[];
  replyToAddress?: string | null;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  isRead: boolean;
  labels: string[];
  direction?: 'inbound' | 'outbound' | 'unknown';
  leadId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  dealTitle?: string | null;
  isArchived?: boolean;
  canArchive?: boolean;
  needsDealAssociation?: boolean;
  scheduledStatus?: string;
  scheduleError?: string | null;
  /** Present on non-draft list rows; detail still returns individual messages. */
  messageCount?: number;
  participants?: string[];
  attachments?: MailboxAttachment[];
}

export interface MailboxUnreadCount { unreadCount: number; unreadCountUnit?: 'conversations' }

export interface ScheduledMailboxEmailDetail {
  id: string; status: string; scheduledAt: string; recipients: string[];
  subject: string; body: string; lastError: string | null; canCancel: boolean;
}

const providerId = z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200);
export const MailboxConversationIdSchema = z.string().regex(/^c_[a-f0-9]{32}$/);
export const MailboxConversationReadStateSchema = MailboxReadStateSchema.extend({
  pageToken: z.string().max(2000).optional(),
}).strict();
export interface MailboxConversationReadState {
  count: number;
  completedMessageIds: string[];
  nextPageToken?: string;
  isRead: boolean;
  unreadCount: number;
}
export const MailboxConversationPageSchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(50).default(50),
  pageToken: z.string().max(2000).optional(),
});
export interface MailboxConversationDetail {
  emails: MailboxEmail[];
  nextPageToken?: string;
  messageCount: number;
  dealId?: string | null;
  dealTitle?: string | null;
  threads: { threadId: string; dealOptions: { id: string; title: string; stage: string }[]; canAssociateDeal: boolean }[];
}
export const MailboxBulkActionSchema = z.union([
  z.object({ conversationIds: z.array(MailboxConversationIdSchema).min(1).max(100) }).strict(),
  z.object({ threadIds: z.array(providerId).min(1).max(100) }).strict(),
  z.object({ messageIds: z.array(providerId).min(1).max(100) }).strict(),
]);

export const MailboxDealAssociationSchema = z.object({
  dealId: z.string().min(1).max(200),
  conversationId: MailboxConversationIdSchema.optional(),
  messageId: providerId.optional(),
}).strict().refine(value => !(value.conversationId && value.messageId), 'Choose one message or conversation.');

export interface MailboxBulkActionResult {
  success: boolean;
  count: number;
  completedMessageIds: string[];
  completedConversationIds?: string[];
  error?: string;
}
