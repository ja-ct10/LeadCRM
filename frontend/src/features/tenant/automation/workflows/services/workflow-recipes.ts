import type { WorkflowDraft } from '@leadcrm/shared';

export const WORKFLOW_RECIPES: WorkflowDraft[] = [
  // 1. Lead Management & Qualification
  {
    name: 'New Lead Follow-up',
    description: 'Assign an owner and create a follow-up task.',
    trigger: 'lead.created',
    isActive: false,
    actions: [
      { type: 'assign_owner', config: { userId: '' } },
      { type: 'create_task', config: { title: 'Follow up with new lead', dueDaysFromNow: 1, priority: 'Medium' } },
    ],
  },
  {
    name: 'Hot Lead Urgent Response',
    description: 'Alert the team and schedule an urgent call when a lead becomes Hot.',
    trigger: 'lead.status_changed',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'lead.status', operator: 'equals', value: 'Hot' }],
    },
    actions: [
      { type: 'create_notification', config: { title: 'Hot lead alert: {{first_name}}', body: 'Lead marked as Hot requires immediate response.' } },
      { type: 'create_task', config: { title: 'Urgent: Call hot lead {{first_name}}', dueDaysFromNow: 0, priority: 'High', description: 'Immediate outreach for high-intent prospect.' } },
    ],
  },
  {
    name: 'Website Inbound Lead Triage',
    description: 'Create a qualification task and notification for leads submitted via website.',
    trigger: 'lead.created',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'lead.source', operator: 'contains', value: 'Website' }],
    },
    actions: [
      { type: 'create_task', config: { title: 'Qualify inbound website lead: {{first_name}}', dueDaysFromNow: 1, priority: 'Medium', description: 'Review web form inquiry and verify contact details.' } },
      { type: 'create_notification', config: { title: 'New website lead received: {{first_name}}' } },
    ],
  },
  {
    name: 'Qualified Lead Discovery Preparation',
    description: 'Schedule discovery task and update notes when a lead is marked Qualified.',
    trigger: 'lead.status_changed',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'lead.status', operator: 'equals', value: 'Qualified' }],
    },
    actions: [
      { type: 'create_task', config: { title: 'Schedule discovery call for {{company}}', dueDaysFromNow: 2, priority: 'High', description: 'Prepare presentation deck and schedule qualification call.' } },
      { type: 'update_field', config: { field: 'description', value: 'Lead qualified by marketing. Ready for sales discovery call.' } },
      { type: 'create_notification', config: { title: 'Lead qualified for sales: {{first_name}}' } },
    ],
  },
  {
    name: 'Cold Lead Nurture Check',
    description: 'Schedule a nurture review task when a lead goes cold.',
    trigger: 'lead.status_changed',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'lead.status', operator: 'equals', value: 'Cold' }],
    },
    actions: [
      { type: 'create_task', config: { title: 'Review cold lead for future nurture: {{first_name}}', dueDaysFromNow: 14, priority: 'Low', description: 'Revisit engagement history and consider quarterly check-in.' } },
      { type: 'update_field', config: { field: 'description', value: 'Lead became cold. Scheduled for nurture campaign check.' } },
    ],
  },
  {
    name: 'Converted Lead Milestone',
    description: 'Notify the team and log milestone notes when a lead is converted.',
    trigger: 'lead.status_changed',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'lead.status', operator: 'equals', value: 'Converted' }],
    },
    actions: [
      { type: 'create_notification', config: { title: 'Lead converted to opportunity: {{first_name}} {{last_name}}', body: 'Great work! Check new Contact and Deals created.' } },
      { type: 'update_field', config: { field: 'description', value: 'Successfully converted to contact and opportunity.' } },
    ],
  },
  {
    name: 'Lead Re-assignment & Greeting',
    description: 'Assign owner, alert the agent, and schedule an introductory call.',
    trigger: 'lead.created',
    isActive: false,
    actions: [
      { type: 'assign_owner', config: { userId: '' } },
      { type: 'create_notification', config: { title: 'New lead assigned to your queue: {{first_name}}' } },
      { type: 'create_task', config: { title: 'Conduct introductory call with {{first_name}}', dueDaysFromNow: 2, priority: 'Medium' } },
    ],
  },
  {
    name: 'New Lead Email Welcome',
    description: 'Send an immediate welcome email and schedule a confirmation follow-up.',
    trigger: 'lead.created',
    isActive: false,
    actions: [
      { type: 'send_email', config: { senderUserId: '', subject: 'Thank you for connecting, {{first_name}}', body: '<p>Hi {{first_name}},</p><p>Thank you for reaching out to us at {{company}}. We received your details and an account representative will be in touch shortly.</p>' } },
      { type: 'create_task', config: { title: 'Confirm welcome email receipt with {{first_name}}', dueDaysFromNow: 2, priority: 'Low' } },
    ],
  },

  // 2. Contact Management
  {
    name: 'Contact Onboarding Handoff',
    description: 'Create an onboarding task, update notes, and alert the team when a contact is created.',
    trigger: 'contact.created',
    isActive: false,
    actions: [
      { type: 'create_task', config: { title: 'Welcome and onboarding setup for {{first_name}}', dueDaysFromNow: 3, priority: 'High', description: 'Send welcome packet and schedule onboarding session.' } },
      { type: 'create_notification', config: { title: 'New contact created: {{first_name}} {{last_name}}' } },
      { type: 'update_field', config: { field: 'notes', value: 'New contact created. Initiating standard onboarding checklist.' } },
    ],
  },
  {
    name: 'VIP Contact Review Alert',
    description: 'Alert account manager and schedule review when contact status changes to HOT.',
    trigger: 'contact.status_changed',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'contact.status', operator: 'equals', value: 'HOT' }],
    },
    actions: [
      { type: 'create_notification', config: { title: 'Contact active & hot: {{first_name}} at {{company}}' } },
      { type: 'create_task', config: { title: 'Executive relationship review for {{company}}', dueDaysFromNow: 2, priority: 'High', description: 'Key contact marked HOT. Conduct satisfaction check-in.' } },
    ],
  },
  {
    name: 'At-Risk Contact Follow-up',
    description: 'Trigger urgent task and notify manager when contact status changes to COLD.',
    trigger: 'contact.status_changed',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'contact.status', operator: 'equals', value: 'COLD' }],
    },
    actions: [
      { type: 'create_notification', config: { title: 'Attention needed: Contact status cold for {{first_name}}' } },
      { type: 'create_task', config: { title: 'Re-engagement outreach for {{company}}', dueDaysFromNow: 1, priority: 'High', description: 'Contact engagement dropped. Reach out to address concerns and offer support.' } },
      { type: 'update_field', config: { field: 'notes', value: 'Contact marked COLD. Outreach initiated.' } },
    ],
  },
  {
    name: 'Contact Status Closed Wrap-up',
    description: 'Create wrap-up checklist task when contact status changes to CLOSED.',
    trigger: 'contact.status_changed',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'contact.status', operator: 'equals', value: 'CLOSED' }],
    },
    actions: [
      { type: 'create_task', config: { title: 'Complete account wrap-up and archive files for {{company}}', dueDaysFromNow: 7, priority: 'Low', description: 'Finalize wrap-up and record contact status closure reason.' } },
      { type: 'create_notification', config: { title: 'Contact status closed: {{first_name}} {{last_name}}' } },
    ],
  },
  {
    name: 'Contact Welcome & Check-in Email',
    description: 'Send automated welcome email when contact is created and schedule 30-day check-in.',
    trigger: 'contact.created',
    isActive: false,
    actions: [
      { type: 'send_email', config: { senderUserId: '', subject: 'Welcome to our platform, {{first_name}}!', body: '<p>Hello {{first_name}},</p><p>Welcome! We are excited to partner with {{company}}. Please let us know if you have any questions as you get started.</p>' } },
      { type: 'create_task', config: { title: 'First 30-day check-in with {{first_name}}', dueDaysFromNow: 30, priority: 'Medium' } },
    ],
  },

  // 3. Deal Pipeline & Sales Operations
  {
    name: 'High-value Deal Alert',
    description: 'Notify the owner about a high-value opportunity.',
    trigger: 'deal.created',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'deal.value', operator: 'greater_than', value: 100000 }],
    },
    actions: [
      { type: 'create_notification', config: { title: 'High-value deal created' } },
    ],
  },
  {
    name: 'Enterprise Deal Executive Sponsor',
    description: 'Alert leadership and assign an executive sponsor for deals $250,000 and above.',
    trigger: 'deal.created',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'deal.value', operator: 'greater_than_or_equal', value: 250000 }],
    },
    actions: [
      { type: 'create_notification', config: { title: 'Major Enterprise Deal created over $250k' } },
      { type: 'create_task', config: { title: 'Assign executive sponsor and review proposal', dueDaysFromNow: 2, priority: 'High', description: 'High-impact enterprise deal requires executive oversight and strategic pricing review.' } },
    ],
  },
  {
    name: 'High-Priority Deal Accelerator',
    description: 'Notify owner and create a priority task for deals marked HIGH priority.',
    trigger: 'deal.created',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'deal.priority', operator: 'equals', value: 'HIGH' }],
    },
    actions: [
      { type: 'create_task', config: { title: 'Fast-track proposal preparation', dueDaysFromNow: 1, priority: 'High', description: 'High-priority opportunity. Coordinate sales engineering support.' } },
      { type: 'create_notification', config: { title: 'High-priority deal flagged for fast-tracking' } },
    ],
  },
  {
    name: 'Deal Stage Advance Notification',
    description: 'Notify owner and create milestone tasks whenever a deal changes stage.',
    trigger: 'deal.stage_changed',
    isActive: false,
    actions: [
      { type: 'create_notification', config: { title: 'Deal stage updated to next milestone' } },
      { type: 'create_task', config: { title: 'Complete deliverables for new deal stage', dueDaysFromNow: 3, priority: 'Medium', description: 'Verify stage exit criteria and update next steps.' } },
    ],
  },
  {
    name: 'Pipeline Stage Routing',
    description: 'Move newly created deal into pipeline staging and set up qualification task.',
    trigger: 'deal.created',
    isActive: false,
    actions: [
      { type: 'move_deal_stage', config: { stageId: '' } },
      { type: 'create_task', config: { title: 'Conduct initial qualification review', dueDaysFromNow: 2, priority: 'Medium' } },
    ],
  },
  {
    name: 'Won Deal Handoff',
    description: 'Create a handoff task and notify the owner.',
    trigger: 'deal.closed_won',
    isActive: false,
    actions: [
      { type: 'create_task', config: { title: 'Arrange contact handoff', dueDaysFromNow: 1, priority: 'Medium' } },
      { type: 'create_notification', config: { title: 'Won deal ready for handoff' } },
    ],
  },
  {
    name: 'Major Won Deal Celebration & Kickoff',
    description: 'Celebrate closed won deal and initiate immediate implementation kickoff.',
    trigger: 'deal.closed_won',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'deal.value', operator: 'greater_than_or_equal', value: 50000 }],
    },
    actions: [
      { type: 'create_notification', config: { title: 'Major deal closed won ($50k+)! Congratulations!' } },
      { type: 'create_task', config: { title: 'Schedule contact implementation kickoff', dueDaysFromNow: 2, priority: 'High', description: 'High-value implementation kickoff meeting and stakeholder introduction.' } },
    ],
  },
  {
    name: 'Lost Deal Win/Loss Analysis',
    description: 'Prompt sales rep to document loss reasons and competitor intelligence.',
    trigger: 'deal.closed_lost',
    isActive: false,
    actions: [
      { type: 'create_notification', config: { title: 'Deal closed lost: Win/loss analysis required' } },
      { type: 'create_task', config: { title: 'Log lost reason and review competitor insights', dueDaysFromNow: 3, priority: 'Low', description: 'Document key objections, pricing factors, and feedback for product marketing.' } },
    ],
  },
  {
    name: 'High-Value Lost Deal Review',
    description: 'Alert management and schedule a strategic post-mortem when a major deal is lost.',
    trigger: 'deal.closed_lost',
    isActive: false,
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'deal.value', operator: 'greater_than_or_equal', value: 50000 }],
    },
    actions: [
      { type: 'create_notification', config: { title: 'High-value deal lost ($50k+): Leadership review requested' } },
      { type: 'create_task', config: { title: 'Conduct executive post-mortem on lost deal', dueDaysFromNow: 5, priority: 'High', description: 'Analyze why this major deal was lost and evaluate future re-engagement timing.' } },
    ],
  },
];
