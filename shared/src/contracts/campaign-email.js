"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingTemplateSchema = exports.CampaignSendSchema = exports.CampaignDraftSchema = exports.SMS_ORGANIZATION_EMAIL_REQUIRED = exports.SMS_MAX_LENGTH = exports.CreateAudienceSchema = exports.AudiencePreviewRequestSchema = exports.AudiencePreviewSchema = exports.AudienceConditionSchema = exports.AUDIENCE_OPERATORS = exports.AUDIENCE_FIELDS = exports.AudienceSourceSchema = exports.EmailSubjectSchema = exports.MarketingNameSchema = exports.EMAIL_VARIABLE_TOKENS = exports.EMAIL_VARIABLES = void 0;
exports.escapeEmailHtml = escapeEmailHtml;
exports.renderEmailVariables = renderEmailVariables;
exports.appendSmsFooter = appendSmsFooter;
const zod_1 = require("zod");
const record_experience_1 = require("./record-experience");
const lead_created_contract_1 = require("./lead-created.contract");
exports.EMAIL_VARIABLES = ['first_name', 'last_name', 'company_name', 'contact_number', 'status', 'sender_name', 'sender_email'];
exports.EMAIL_VARIABLE_TOKENS = exports.EMAIL_VARIABLES.map(key => `{{${key}}}`);
function escapeEmailHtml(value) {
    return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function renderEmailVariables(text, values, html = false) {
    return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_token, key) => {
        var _a;
        if (!exports.EMAIL_VARIABLES.includes(key))
            return '';
        const value = Object.prototype.hasOwnProperty.call(values, key) ? (_a = values[key]) !== null && _a !== void 0 ? _a : '' : '';
        return html ? escapeEmailHtml(value) : value.replace(/[\x00-\x1f\x7f]/g, ' ');
    });
}
exports.MarketingNameSchema = zod_1.z.string().trim().min(1, 'Name is required.').max(150).regex(/^[^\x00-\x1f\x7f]*$/, 'Control characters are not allowed.');
exports.EmailSubjectSchema = zod_1.z.string().max(200).regex(/^[^\x00-\x1f\x7f]*$/, 'Subject must not contain line breaks or control characters.').transform(s => s.trim());
exports.AudienceSourceSchema = zod_1.z.enum(['LEADS', 'CONTACTS', 'ALL']);
exports.AUDIENCE_FIELDS = ['status', 'source', 'company', 'productInterest', 'assignedUserId', 'createdAt'];
exports.AUDIENCE_OPERATORS = ['equals', 'not_equals', 'contains', 'any', 'gte', 'lte', 'between'];
const equality = zod_1.z.enum(['equals', 'not_equals']);
exports.AudienceConditionSchema = zod_1.z.discriminatedUnion('field', [
    zod_1.z.object({ field: zod_1.z.literal('status'), operator: equality, value: record_experience_1.CrmStatusSchema }).strict(),
    zod_1.z.object({ field: zod_1.z.literal('source'), operator: equality, value: record_experience_1.LeadSourceSchema }).strict(),
    zod_1.z.object({ field: zod_1.z.literal('company'), operator: zod_1.z.enum(['equals', 'not_equals', 'contains']), value: zod_1.z.string().trim().min(1, 'Value is required.').max(200).regex(/^[^\x00-\x1f\x7f]*$/) }).strict(),
    zod_1.z.object({ field: zod_1.z.literal('productInterest'), operator: equality, value: zod_1.z.array(zod_1.z.string().uuid()).min(1, 'Select a Product Interest.').max(100).transform(ids => [...new Set(ids)]) }).strict(),
    zod_1.z.object({ field: zod_1.z.literal('assignedUserId'), operator: equality, value: zod_1.z.string().uuid('Select an Assigned Agent.') }).strict(),
    zod_1.z.object({ field: zod_1.z.literal('createdAt'), operator: zod_1.z.enum(['any', 'gte', 'lte', 'between']), value: zod_1.z.union([zod_1.z.string(), zod_1.z.object({ from: zod_1.z.string(), to: zod_1.z.string() }).strict(), zod_1.z.null()]) }).strict(),
]).superRefine((c, ctx) => {
    if (c.field !== 'createdAt')
        return;
    if (c.operator === 'any') {
        if (c.value !== null)
            ctx.addIssue({ code: 'custom', path: ['value'], message: 'Any date has no value.' });
        return;
    }
    const parsed = lead_created_contract_1.LeadCreatedFilterSchema.safeParse(c.operator === 'between'
        ? Object.assign({ operator: c.operator }, (typeof c.value === 'object' ? c.value : {})) : { operator: c.operator, date: c.value });
    if (!parsed.success)
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter valid dates with From on or before To.' });
});
exports.AudiencePreviewSchema = zod_1.z.object({ source: exports.AudienceSourceSchema, conditions: zod_1.z.array(exports.AudienceConditionSchema).max(20).default([]) }).strict();
exports.AudiencePreviewRequestSchema = exports.AudiencePreviewSchema.extend({ channel: zod_1.z.enum(['EMAIL', 'SMS']).default('EMAIL'), page: zod_1.z.number().int().min(1).max(100000).default(1), limit: zod_1.z.number().int().min(1).max(50).default(25) });
exports.CreateAudienceSchema = exports.AudiencePreviewSchema.extend({ name: exports.MarketingNameSchema });
exports.SMS_MAX_LENGTH = 670;
exports.SMS_ORGANIZATION_EMAIL_REQUIRED = 'Configure the organization email in Settings → General before sending SMS campaigns.';
/** Shared by the sample preview and every server-side SMS caller. Never truncate. */
function appendSmsFooter(content, organizationEmail) {
    const email = zod_1.z.string().trim().email().safeParse(organizationEmail);
    if (!email.success)
        throw new Error(exports.SMS_ORGANIZATION_EMAIL_REQUIRED);
    const footer = `For product inquiries, contact Camxian Technologies at ${email.data}.\nThis SMS is no-reply.`;
    const body = content.trim();
    return body.endsWith(footer) ? body : `${body}\n\n${footer}`;
}
exports.CampaignDraftSchema = zod_1.z.object({
    name: exports.MarketingNameSchema, type: zod_1.z.enum(['EMAIL', 'SMS', 'MULTI_CHANNEL']),
    subject: exports.EmailSubjectSchema.optional(), body: zod_1.z.string().max(50000).optional(),
    audienceSource: exports.AudienceSourceSchema.optional().nullable(), targetAudienceId: zod_1.z.string().uuid().optional().nullable(),
    emailTemplateId: zod_1.z.string().uuid().optional().nullable(), smsTemplateId: zod_1.z.string().uuid().optional().nullable(),
}).strict();
exports.CampaignSendSchema = exports.CampaignDraftSchema.superRefine((v, ctx) => {
    var _a, _b;
    if (!v.audienceSource && !v.targetAudienceId)
        ctx.addIssue({ code: 'custom', path: ['targetAudienceId'], message: 'Target audience is required.' });
    if (v.type === 'EMAIL' && !((_a = v.subject) === null || _a === void 0 ? void 0 : _a.trim()))
        ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Subject line is required.' });
    if (!((_b = v.body) === null || _b === void 0 ? void 0 : _b.trim()))
        ctx.addIssue({ code: 'custom', path: ['body'], message: 'Body is required.' });
});
exports.MarketingTemplateSchema = zod_1.z.object({ name: exports.MarketingNameSchema, type: zod_1.z.enum(['Email', 'SMS']), category: exports.MarketingNameSchema.optional(), subject: exports.EmailSubjectSchema.optional(), content: zod_1.z.string().trim().min(1, 'Message content is required.').max(50000) }).strict().superRefine((v, ctx) => {
    if (v.type === 'Email' && !v.subject)
        ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Subject line is required.' });
});
