import type { WorkflowEntity, WorkflowTriggerDefinition } from './workflow.contracts';

function fields(entity: WorkflowEntity): WorkflowTriggerDefinition['fields'] {
  const definitions: Array<[string, string, 'string' | 'number' | 'boolean']> = entity === 'deal'
    ? [['title', 'Deal title', 'string'], ['value', 'Deal value', 'number'], ['stageId', 'Stage', 'string'],
       ['pipelineId', 'Pipeline', 'string'], ['priority', 'Priority', 'string']]
    : [['status', 'Relationship status (read only)', 'string'], ['source', 'Source', 'string'],
       ['email', 'Email', 'string'], ['firstName', 'First name', 'string']];
  return [...definitions, ['assignedUserId', 'Assigned user', 'string'] as const].map(([field, label, type]) => ({ field: `${entity}.${field}`, label, type }));
}

/** Every entry has a domain emitter; no timers or engagement events are advertised. */
export const WORKFLOW_TRIGGERS: WorkflowTriggerDefinition[] = [
  ['lead.created', 'Lead created', 'lead'], ['lead.status_changed', 'Lead status changed', 'lead'],
  ['contact.created', 'Client Profile created', 'contact'], ['contact.status_changed', 'Client Profile status changed', 'contact'],
  ['deal.created', 'Deal created', 'deal'], ['deal.stage_changed', 'Deal stage changed', 'deal'],
  ['deal.closed_won', 'Deal closed won', 'deal'], ['deal.closed_lost', 'Deal closed lost', 'deal'],
].map(([type, label, entity]) => ({ type, label, entity: entity as WorkflowEntity, fields: fields(entity as WorkflowEntity) }));

export function findTrigger(type: string): WorkflowTriggerDefinition | undefined {
  return WORKFLOW_TRIGGERS.find(trigger => trigger.type === type);
}

import type { ActionDefinition } from './workflow.contracts';
export function getAvailableActions(): ActionDefinition[] {
  return [
    { type: 'create_task', label: 'Create task', description: 'Create a linked follow-up task immediately.', entities: ['lead', 'contact', 'deal'], configSchema: {
      title: { type: 'string', label: 'Task title', required: true }, description: { type: 'string', label: 'Description', required: false },
      assignedUserId: { type: 'user', label: 'Assign to (defaults to record owner)', required: false },
      dueDaysFromNow: { type: 'number', label: 'Due in days', required: false },
      priority: { type: 'select', label: 'Priority', required: false, options: ['Low', 'Medium', 'High'] },
    } },
    { type: 'send_email', label: 'Send email', description: 'Send a template through a connected Gmail account. External sending is blocked in Sandbox.', entities: ['lead', 'contact'], configSchema: {
      templateId: { type: 'template', label: 'Email template', required: true }, senderUserId: { type: 'user', label: 'Connected Gmail sender', required: true },
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

