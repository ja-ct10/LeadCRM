"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKFLOW_TRIGGERS = void 0;
exports.findTrigger = findTrigger;
exports.getAvailableActions = getAvailableActions;
function fields(entity) {
    const definitions = entity === 'deal'
        ? [{ field: 'title', label: 'Deal title', type: 'string' }, { field: 'value', label: 'Deal value', type: 'number' },
            { field: 'stageId', label: 'Stage', type: 'stage' }, { field: 'pipelineId', label: 'Pipeline', type: 'pipeline' },
            { field: 'priority', label: 'Priority', type: 'enum', options: ['LOW', 'MEDIUM', 'HIGH'] },
            { field: 'expectedCloseDate', label: 'Expected close date', type: 'date' }]
        : [{ field: 'status', label: entity === 'lead' ? 'Lead status' : 'Relationship status', type: 'enum',
                options: entity === 'lead' ? ['Inquiry', 'Hot', 'Warm', 'Cold', 'Closed', 'Cancelled', 'Qualified', 'Converted', 'Archived', 'HOT', 'WARM', 'COLD'] : ['HOT', 'WARM', 'COLD', 'CANCELLED', 'CLOSED'] },
            { field: 'source', label: 'Source', type: 'string' }, { field: 'email', label: 'Email', type: 'string' },
            { field: 'firstName', label: 'First name', type: 'string' },
            { field: entity === 'lead' ? 'companyName' : 'company', label: 'Company', type: 'string' }];
    definitions.push({ field: 'assignedUserId', label: 'Assigned agent', type: 'user' });
    return definitions.map(field => ({ ...field, field: `${entity}.${field.field}` }));
}
/** Every entry has a domain emitter; no timers or engagement events are advertised. */
exports.WORKFLOW_TRIGGERS = [
    ['lead.created', 'Lead created', 'lead'], ['lead.status_changed', 'Lead status changed', 'lead'],
    ['contact.created', 'Client Profile created', 'contact'], ['contact.status_changed', 'Client Profile status changed', 'contact'],
    ['deal.created', 'Deal created', 'deal'], ['deal.stage_changed', 'Deal stage changed', 'deal'],
    ['deal.closed_won', 'Deal closed won', 'deal'], ['deal.closed_lost', 'Deal closed lost', 'deal'],
].map(([type, label, entity]) => ({ type, label, entity: entity, fields: fields(entity) }));
function findTrigger(type) {
    return exports.WORKFLOW_TRIGGERS.find(trigger => trigger.type === type);
}
function getAvailableActions() {
    return [
        { type: 'send_campaign', label: 'Send campaign', description: 'Send an existing draft email campaign once through its saved audience and delivery service.', entities: ['lead', 'contact', 'deal'], configSchema: { campaignId: { type: 'campaign', label: 'Email campaign', required: true } } },
        { type: 'create_task', label: 'Create task', description: 'Create a linked follow-up task immediately.', entities: ['lead', 'contact', 'deal'], configSchema: {
                title: { type: 'string', label: 'Task title', required: true }, description: { type: 'string', label: 'Description', required: false },
                assignedUserId: { type: 'user', label: 'Assign to (defaults to record owner)', required: false },
                dueDaysFromNow: { type: 'number', label: 'Due in days', required: false },
                priority: { type: 'select', label: 'Priority', required: false, options: ['Low', 'Medium', 'High'] },
            } },
        { type: 'send_email', label: 'Send email', description: 'Send a template through a connected Gmail account. External sending is blocked in Sandbox.', entities: ['lead', 'contact'], configSchema: {
                templateId: { type: 'template', label: 'Email template (optional with subject and message)', required: false },
                subject: { type: 'string', label: 'Subject (overrides template)', required: false }, body: { type: 'string', label: 'Message (overrides template)', required: false }, senderUserId: { type: 'user', label: 'Connected Gmail sender', required: true },
            } },
        { type: 'create_notification', label: 'Send notification', description: 'Notify a workspace user.', entities: ['lead', 'contact', 'deal'], configSchema: {
                title: { type: 'string', label: 'Title', required: true }, body: { type: 'string', label: 'Message', required: false },
                userId: { type: 'user', label: 'Notify user (defaults to record owner)', required: false },
            } },
        { type: 'assign_owner', label: 'Assign owner', description: 'Assign the related record to a workspace user.', entities: ['lead', 'contact', 'deal'], configSchema: {
                userId: { type: 'user', label: 'New owner', required: true },
            } },
        { type: 'update_field', label: 'Update safe field', description: 'Update notes or description. Relationship Status is protected.', entities: ['lead', 'contact', 'deal'], configSchema: {
                field: { type: 'select', label: 'Field (notes for Client Profiles; description for Leads or Deals)', required: true, options: ['description', 'notes'] },
                value: { type: 'string', label: 'New value', required: true },
            } },
        { type: 'move_deal_stage', label: 'Move deal stage', description: 'Use the governed pipeline transition.', entities: ['deal'], configSchema: {
                stageId: { type: 'stage', label: 'Target stage', required: true }, lostReason: { type: 'string', label: 'Reason (required for lost stages)', required: false },
            } },
    ];
}
