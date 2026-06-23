import type { Workflow, WorkflowExecution, Task } from '../types';

// ─── Workflows ────────────────────────────────────────────────────────────────

export const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: 'wf_1',
    tenantId: 'tenant_demo',
    name: 'CCTV Site Survey',
    description: 'Automatically schedule a site survey when a CCTV deal is qualified.',
    category: 'Security',
    status: 'active',
    trigger: 'deal_stage_qualified',
    condition: 'title_contains_CCTV',
    actions: [{ id: 'action_1', type: 'create_task', config: { taskTitle: 'Schedule Site Survey', taskDescription: 'Please schedule a site survey for this CCTV deal.' } }],
    executionCount: 24,
  },
  {
    id: 'wf_2',
    tenantId: 'tenant_demo',
    name: 'Biometrics Config',
    description: 'Assign a configuration task to the IT team when a Biometrics deal is won.',
    category: 'Security',
    status: 'active',
    trigger: 'deal_stage_won',
    condition: 'title_contains_Biometrics',
    actions: [{ id: 'action_1', type: 'create_task', config: { taskTitle: 'Configure Biometrics', taskDescription: 'Please configure the biometrics system for this won deal.' } }],
    executionCount: 12,
  },
  {
    id: 'wf_3',
    tenantId: 'tenant_demo',
    name: 'Structured Cabling Layout',
    description: 'Generate a cabling layout task when a networking deal reaches proposal stage.',
    category: 'Telecom',
    status: 'active',
    trigger: 'deal_stage_proposal',
    condition: 'title_contains_Cabling',
    actions: [{ id: 'action_1', type: 'create_task', config: { taskTitle: 'Generate Cabling Layout', taskDescription: 'Create a structured cabling layout for this proposal.' } }],
    executionCount: 8,
  },
  {
    id: 'wf_4',
    tenantId: 'tenant_demo',
    name: 'Server Provisioning',
    description: 'Notify the hardware team to prepare servers when an IT deal is won.',
    category: 'IT',
    status: 'active',
    trigger: 'deal_stage_won',
    condition: 'title_contains_Server',
    actions: [{ id: 'action_1', type: 'send_email', config: { templateId: 'tpl_1' } }],
    executionCount: 5,
  },
  {
    id: 'wf_5',
    tenantId: 'tenant_demo',
    name: 'New Contact Welcome',
    description: 'Send a welcome email to all new contacts.',
    category: 'General',
    status: 'active',
    trigger: 'lead_created',
    actions: [{ id: 'action_1', type: 'send_email', config: { templateId: 'tpl_2' } }],
    executionCount: 142,
  },
];

// ─── Workflow Executions ──────────────────────────────────────────────────────

export const MOCK_WORKFLOW_EXECUTIONS: WorkflowExecution[] = [
  {
    id: 'exec_1',
    workflowId: 'wf_1',
    tenantId: 'tenant_demo',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: 'success',
    details: 'Created task: CCTV Site Survey',
    relatedEntityId: 'deal_1',
  },
  {
    id: 'exec_2',
    workflowId: 'wf_2',
    tenantId: 'tenant_demo',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    status: 'success',
    details: 'Sent Email using template: Proposal Follow-up',
    relatedEntityId: 'deal_2',
  },
];

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const MOCK_TASKS: Task[] = [
  {
    id: 'task_1',
    tenantId: 'tenant_demo',
    dealId: 'deal_1',
    title: 'Initial Site Survey',
    description: 'Conduct a physical survey of the client site for CCTV placement and cable pathing.',
    status: 'completed',
    dueDate: '2026-03-15',
    assignedUserId: 'user_sales_2',
    createdAt: '2026-03-12T10:00:00.000Z',
    priority: 'Medium',
  },
  {
    id: 'task_2',
    tenantId: 'tenant_demo',
    dealId: 'deal_3',
    title: 'Proposal Review',
    description: 'Review the enterprise solution proposal with the legal team and regional stakeholders.',
    status: 'pending',
    dueDate: '2026-04-05',
    assignedUserId: 'user_sales_3',
    createdAt: '2026-03-22T09:15:00.000Z',
    priority: 'High',
  },
  {
    id: 'task_3',
    tenantId: 'tenant_demo',
    title: 'Hardware Order Placement',
    description: 'Execute procurement order for fiber switches, network cables, and router modules.',
    status: 'in-progress',
    dueDate: '2026-06-15',
    assignedUserId: 'user_sales_2',
    createdAt: '2026-05-25T11:00:00.000Z',
    priority: 'High',
  },
  {
    id: 'task_4',
    tenantId: 'tenant_demo',
    title: 'Draft User Manual',
    description: 'Create draft user manuals and handbook guides for custom VoIP lines configuration.',
    status: 'pending',
    dueDate: '2026-06-30',
    assignedUserId: 'user_sales_1',
    createdAt: '2026-05-28T14:30:00.000Z',
    priority: 'Low',
  },
];
