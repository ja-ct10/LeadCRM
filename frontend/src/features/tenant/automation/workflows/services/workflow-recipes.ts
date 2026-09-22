import type { WorkflowDraft } from '@leadcrm/shared';
export const WORKFLOW_RECIPES: WorkflowDraft[] = [
  { name: 'New Lead Follow-up', description: 'Assign an owner and create a follow-up task.', trigger: 'lead.created', isActive: false,
    actions: [{ type: 'assign_owner', config: { userId: '' } }, { type: 'create_task', config: { title: 'Follow up with new lead', dueDaysFromNow: 1 } }] },
  { name: 'High-value Deal Alert', description: 'Notify the owner about a high-value opportunity.', trigger: 'deal.created', isActive: false,
    conditions: { operator: 'AND', conditions: [{ field: 'deal.value', operator: 'greater_than', value: 100000 }] },
    actions: [{ type: 'create_notification', config: { title: 'High-value deal created' } }] },
  { name: 'Won Deal Handoff', description: 'Create a handoff task and notify the owner.', trigger: 'deal.closed_won', isActive: false,
    actions: [{ type: 'create_task', config: { title: 'Arrange customer handoff', dueDaysFromNow: 1 } }, { type: 'create_notification', config: { title: 'Won deal ready for handoff' } }] },
];
