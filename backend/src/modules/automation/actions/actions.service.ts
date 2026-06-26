/**
 * Actions service — lists available action types and their config schemas.
 * Used by the frontend workflow builder to render action configuration forms.
 */

export interface ActionDefinition {
  type:        string;
  label:       string;
  description: string;
  configSchema: Record<string, { type: string; label: string; required: boolean; options?: string[] }>;
}

export function getAvailableActions(): ActionDefinition[] {
  return [
    {
      type:  'create_task',
      label: 'Create Task',
      description: 'Automatically create a follow-up task',
      configSchema: {
        title:           { type: 'string',  label: 'Task Title',      required: true },
        description:     { type: 'string',  label: 'Description',     required: false },
        priority:        { type: 'select',  label: 'Priority',        required: false, options: ['Low', 'Medium', 'High'] },
        dueDaysFromNow:  { type: 'number',  label: 'Due in (days)',   required: false },
        assignedUserId:  { type: 'user',    label: 'Assign To',       required: false },
      },
    },
    {
      type:  'create_notification',
      label: 'Send Notification',
      description: 'Send an in-app notification to a user',
      configSchema: {
        title:  { type: 'string', label: 'Notification Title', required: true },
        body:   { type: 'string', label: 'Message',            required: false },
        userId: { type: 'user',   label: 'Notify User',        required: false },
      },
    },
    {
      type:  'send_email',
      label: 'Send Email',
      description: 'Send an email via Gmail integration',
      configSchema: {
        templateId: { type: 'template', label: 'Email Template', required: true },
        toEmail:    { type: 'string',   label: 'To (override)',  required: false },
      },
    },
    {
      type:  'assign_owner',
      label: 'Assign Owner',
      description: 'Reassign deal or contact to a specific user',
      configSchema: {
        userId: { type: 'user', label: 'Assign To', required: true },
      },
    },
    {
      type:  'update_field',
      label: 'Update Field',
      description: 'Update a field on the related entity',
      configSchema: {
        entity: { type: 'select', label: 'Entity',     required: true, options: ['contact', 'deal'] },
        field:  { type: 'string', label: 'Field Name', required: true },
        value:  { type: 'string', label: 'New Value',  required: true },
      },
    },
    {
      type:  'move_deal_stage',
      label: 'Move Deal Stage',
      description: 'Move the deal to a specific pipeline stage',
      configSchema: {
        stageId: { type: 'stage', label: 'Target Stage', required: true },
      },
    },
  ];
}
