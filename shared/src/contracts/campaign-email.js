"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingTemplateSchema = exports.CampaignSendSchema = exports.CampaignDraftSchema = exports.CreateAudienceSchema = exports.AudiencePreviewSchema = exports.AudienceConditionSchema = exports.AUDIENCE_OPERATORS = exports.AUDIENCE_FIELDS = exports.AudienceSourceSchema = exports.EmailSubjectSchema = exports.MarketingNameSchema = exports.EMAIL_VARIABLE_TOKENS = exports.EMAIL_VARIABLES = void 0;
exports.escapeEmailHtml = escapeEmailHtml;
exports.renderEmailVariables = renderEmailVariables;
const zod_1 = require("zod");
exports.EMAIL_VARIABLES = ['first_name', 'last_name', 'company_name', 'contact_number', 'status', 'sender_name', 'sender_email'];
exports.EMAIL_VARIABLE_TOKENS = exports.EMAIL_VARIABLES.map(key => `{{${key}}}`);
function escapeEmailHtml(value) {
    return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function renderEmailVariables(text, values, html = false) {
    return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_token, key) => {
        if (!exports.EMAIL_VARIABLES.includes(key))
            return '';
        const value = Object.prototype.hasOwnProperty.call(values, key) ? values[key] ?? '' : '';
        return html ? escapeEmailHtml(value) : value.replace(/[\x00-\x1f\x7f]/g, ' ');
    });
}
exports.MarketingNameSchema = zod_1.z.string().trim().min(1, 'Name is required.').max(150).regex(/^[^\x00-\x1f\x7f]*$/, 'Control characters are not allowed.');
exports.EmailSubjectSchema = zod_1.z.string().max(200).regex(/^[^\x00-\x1f\x7f]*$/, 'Subject must not contain line breaks or control characters.').transform(s => s.trim());
exports.AudienceSourceSchema = zod_1.z.enum(['LEADS', 'CONTACTS', 'ALL']);
exports.AUDIENCE_FIELDS = ['status', 'source', 'company', 'productInterest', 'assignedUserId', 'createdAt'];
exports.AUDIENCE_OPERATORS = ['equals', 'not_equals', 'contains', 'gte', 'lte'];
exports.AudienceConditionSchema = zod_1.z.object({
    field: zod_1.z.enum(exports.AUDIENCE_FIELDS), operator: zod_1.z.enum(exports.AUDIENCE_OPERATORS),
    value: zod_1.z.string().trim().min(1, 'Value is required.').max(200).regex(/^[^\x00-\x1f\x7f]*$/),
}).strict().superRefine((c, ctx) => {
    const allowed = c.field === 'createdAt' ? ['gte', 'lte'] : ['status', 'assignedUserId', 'productInterest'].includes(c.field) ? ['equals', 'not_equals'] : ['equals', 'not_equals', 'contains'];
    if (!allowed.includes(c.operator))
        ctx.addIssue({ code: 'custom', path: ['operator'], message: 'Operator is not supported for this field.' });
    if (c.field === 'createdAt' && (!/^\d{4}-\d{2}-\d{2}$/.test(c.value) || Number.isNaN(Date.parse(c.value)) || new Date(c.value).toISOString().slice(0, 10) !== c.value))
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a valid date (YYYY-MM-DD).' });
    if (c.field === 'assignedUserId' && !zod_1.z.string().uuid().safeParse(c.value).success)
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter an agent ID.' });
    if (c.field === 'status' && !['HOT', 'WARM', 'COLD', 'CANCELLED', 'CLOSED', 'Inquiry', 'Qualified', 'Converted', 'Archived'].includes(c.value))
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Select a valid CRM status.' });
});
exports.AudiencePreviewSchema = zod_1.z.object({ source: exports.AudienceSourceSchema, conditions: zod_1.z.array(exports.AudienceConditionSchema).max(20).default([]) }).strict();
exports.CreateAudienceSchema = exports.AudiencePreviewSchema.extend({ name: exports.MarketingNameSchema });
exports.CampaignDraftSchema = zod_1.z.object({
    name: exports.MarketingNameSchema, type: zod_1.z.enum(['EMAIL', 'SMS', 'MULTI_CHANNEL']),
    subject: exports.EmailSubjectSchema.optional(), body: zod_1.z.string().max(50000).optional(),
    audienceSource: exports.AudienceSourceSchema.optional().nullable(), targetAudienceId: zod_1.z.string().uuid().optional().nullable(),
    emailTemplateId: zod_1.z.string().uuid().optional().nullable(), smsTemplateId: zod_1.z.string().uuid().optional().nullable(),
}).strict();
exports.CampaignSendSchema = exports.CampaignDraftSchema.superRefine((v, ctx) => {
    if (!v.audienceSource && !v.targetAudienceId)
        ctx.addIssue({ code: 'custom', path: ['targetAudienceId'], message: 'Target audience is required.' });
    if (v.type === 'EMAIL' && !v.subject?.trim())
        ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Subject line is required.' });
    if (!v.body?.trim())
        ctx.addIssue({ code: 'custom', path: ['body'], message: 'Body is required.' });
});
exports.MarketingTemplateSchema = zod_1.z.object({ name: exports.MarketingNameSchema, type: zod_1.z.enum(['Email', 'SMS']), category: exports.MarketingNameSchema.optional(), subject: exports.EmailSubjectSchema.optional(), content: zod_1.z.string().trim().min(1, 'Message content is required.').max(50000) }).strict().superRefine((v, ctx) => {
    if (v.type === 'Email' && !v.subject)
        ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Subject line is required.' });
});
