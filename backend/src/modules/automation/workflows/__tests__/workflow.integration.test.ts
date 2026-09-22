import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { WorkflowDraft, WorkflowAction } from '@leadcrm/shared';
import prisma from '../../../../config/database.config';
import { environmentContext } from '../../../../core/environment/environment-context';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import { fireWorkflowTrigger } from '../workflow.engine';
import * as workflows from '../workflows.service';
import { sendEmail } from '../../../../integrations/gmail/gmail.service';
import app from '../../../../app';

vi.mock('../../../../integrations/gmail/gmail.service', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../integrations/gmail/gmail.service')>(),
  sendEmail: vi.fn(),
}));
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_workflow_test_\d+$/.test(url.pathname);
describe.skipIf(!disposable)('workflow acceptance on disposable PostgreSQL and authenticated HTTP', { timeout: 20000 }, () => {
  let tenantId: string, otherTenantId: string, token: string, viewerToken: string, base: string;
  let actor: any, owner: any, outsider: any, lead: any, contact: any, deal: any, won: any, lost: any, required: any, template: any;
  let server: Server;
  const scope = <T>(work: () => T, environment: 'PRODUCTION' | 'SANDBOX' = 'PRODUCTION') => environmentContext.run({ tenantId, environment }, work);
  const create = (actions: WorkflowAction[], extras: Partial<WorkflowDraft> = {}) => scope(() => workflows.createWorkflow(tenantId, actor.id, {
    name: 'Acceptance workflow', trigger: 'lead.created', isActive: true, actions, ...extras,
  }));
  const fire = (entity = 'lead', record = lead, trigger = `${entity}.created`) => scope(() => fireWorkflowTrigger({ tenantId, actorId: actor.id,
    entityType: entity, entityId: record.id, triggerType: trigger, context: {} }));
  const runs = (workflowId: string) => scope(() => workflows.getWorkflowExecutions(workflowId, tenantId));
  async function call(path: string, method = 'GET', body?: unknown, auth = token) {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: `leadcrm_token=${auth}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  beforeAll(async () => {
    const stamp = Date.now();
    tenantId = (await prisma.tenant.create({ data: { name: 'Workflow acceptance', slug: `workflow-${stamp}`, status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    otherTenantId = (await prisma.tenant.create({ data: { name: 'Foreign workspace', slug: `workflow-other-${stamp}` } })).id;
    const user = (name: string, tenant = tenantId, role = 'Client Admin') => prisma.user.create({ data: { tenantId: tenant, role,
      email: `workflow-${name}-${stamp}@camxian.com`, firstName: name, lastName: 'Test', activeEnvironment: 'PRODUCTION', mustChangePassword: false, emailVerified: new Date() } });
    actor = await user('actor'); owner = await user('owner'); outsider = await user('outsider', otherTenantId);
    const viewer = await user('viewer', tenantId, 'Workflow Viewer');
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Workflow Viewer', permissions: { create: {
      tenantId, module: 'workflows', canView: true, canCreate: false, canEdit: false, canDelete: false,
    } } } });
    await prisma.userRole.create({ data: { tenantId, userId: viewer.id, roleId: role.id } });
    token = (await issueAuthSession(actor)).token; viewerToken = (await issueAuthSession(viewer)).token;
    await scope(async () => {
      const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Acceptance pipeline' } });
      const stage = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'New', order: 0, requiredFields: [] } });
      won = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Won', order: 1, isWon: true, requiredFields: [] } });
      lost = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Lost', order: 2, isLost: true, requiredFields: [] } });
      required = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Qualified', order: 3, requiredFields: ['expectedCloseDate'] } });
      lead = await prisma.lead.create({ data: { tenantId, firstName: 'Ada', lastName: 'Lead', email: 'recipient@example.test', assignedUserId: actor.id, productInterest: [] } });
      contact = await prisma.contact.create({ data: { tenantId, firstName: 'Grace', lastName: 'Client', assignedUserId: actor.id, activeProducts: [], productInterests: [] } });
      deal = await prisma.deal.create({ data: { tenantId, pipelineId: pipeline.id, stageId: stage.id, leadId: lead.id, customerId: contact.id,
        title: 'Acceptance deal', value: 50000, assignedUserId: actor.id, tags: [], productInterests: [] } });
      template = await prisma.template.create({ data: { tenantId, name: 'Welcome', type: 'Email', subject: 'Hello {{first_name}}', content: '<p>Welcome {{first_name}}</p>' } });
    });
    await prisma.emailAccount.create({ data: { tenantId, userId: actor.id, email: actor.email, accessToken: 'disposable-fixture', scopes: ['gmail.send'] } });
    server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}/api/v1`;
  }, 30000);
  beforeEach(async () => {
    await prisma.workflow.updateMany({ where: { tenantId }, data: { isActive: false } });
    vi.mocked(sendEmail).mockReset().mockResolvedValue({ messageId: `provider-message-${tenantId}`, threadId: `provider-thread-${tenantId}` });
  });
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });

  it('runs the real lead-created path through cookie-authenticated HTTP with ordered actions and persisted history', async () => {
    const workflow = await create([{ type: 'assign_owner', config: { userId: owner.id } }, { type: 'create_task', config: { title: 'Call lead', dueDaysFromNow: 0 } },
      { type: 'update_field', config: { field: 'description', value: 'Follow up requested' } }, { type: 'create_notification', config: { title: 'New lead follow-up' } }]);
    const response = await call('/crm/leads', 'POST', { firstName: 'Created', lastName: 'Via HTTP' });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const record = await prisma.lead.findUniqueOrThrow({ where: { id: response.body.data.id } });
    expect(record.assignedUserId).toBe(owner.id); expect(record.description).toBe('Follow up requested');
    const task = await prisma.task.findFirstOrThrow({ where: { leadId: record.id } });
    expect(task.assignedUserId).toBe(owner.id); expect(task.assignedById).toBe(actor.id);
    expect(await prisma.notification.count({ where: { entityId: record.id, title: 'New lead follow-up', userId: owner.id } })).toBe(1);
    const history = await runs(workflow.id); expect(history).toHaveLength(1); expect(history[0].status).toBe('completed');
    expect(history[0].steps.map(step => step.status)).toEqual(['success', 'success', 'success', 'success']);
    expect(await prisma.activity.count({ where: { leadId: record.id, title: 'Workflow: Acceptance workflow', createdById: actor.id } })).toBe(1);
    expect((await call(`/automation/workflows/${workflow.id}/executions`)).body.data[0].id).toBe(history[0].id);
  });
  it('keeps Client Profile actions attached to Contact, with the relationship Status unchanged', async () => {
    const workflow = await create([{ type: 'assign_owner', config: { userId: owner.id } }, { type: 'update_field', config: { field: 'notes', value: 'Client follow-up' } },
      { type: 'create_task', config: { title: 'Call Client Profile' } }], { trigger: 'contact.created' });
    await fire('contact', contact);
    expect((await runs(workflow.id))[0].status).toBe('completed');
    const updated = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(updated.status).toBe(contact.status); expect(updated.notes).toBe('Client follow-up'); expect(updated.assignedUserId).toBe(owner.id);
    expect((await prisma.task.findFirstOrThrow({ where: { customerId: contact.id } })).leadId).toBeNull();
  });
  it('uses the stage domain service, records one history entry, and never changes Lead/Contact Status', async () => {
    const workflow = await create([{ type: 'move_deal_stage', config: { stageId: won.id } }], { trigger: 'deal.stage_changed' });
    await fire('deal', deal, 'deal.stage_changed');
    expect((await runs(workflow.id))).toHaveLength(1);
    expect((await runs(workflow.id))[0].status).toBe('completed');
    expect(await prisma.dealStageHistory.count({ where: { dealId: deal.id } })).toBe(1);
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).closedAt).not.toBeNull();
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe(lead.status);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).status).toBe(contact.status);
  });
  it('skips every action when numeric conditions do not match', async () => {
    const workflow = await create([{ type: 'create_task', config: { title: 'Must not exist' } }], { trigger: 'deal.created', conditions: {
      operator: 'AND', conditions: [{ field: 'deal.value', operator: 'greater_than', value: 100000 }],
    } });
    await fire('deal', deal); const [run] = await runs(workflow.id);
    expect(run.status).toBe('skipped'); expect(run.steps[0].status).toBe('skipped');
    expect(await prisma.task.count({ where: { tenantId, title: 'Must not exist' } })).toBe(0);
  });
  it('validates drafts and performs dry runs without mutations or deliveries', async () => {
    const workflow = await create([{ type: 'create_task', config: { title: 'Dry run only' } }, { type: 'send_email', config: { templateId: template.id, senderUserId: actor.id } }], { isActive: false });
    const result = await call(`/automation/workflows/${workflow.id}/test`, 'POST', { entityId: lead.id });
    expect(result.status).toBe(200); expect(result.body.data.valid).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled(); expect(await runs(workflow.id)).toHaveLength(0);
    expect(await prisma.task.count({ where: { tenantId, title: 'Dry run only' } })).toBe(0);
  });
  it('projects an earlier owner assignment during dry-run without changing the record', async () => {
    const unassigned = await scope(() => prisma.lead.create({ data: { tenantId, firstName: 'Unassigned', lastName: 'Sample', productInterest: [] } }));
    const workflow = await create([{ type: 'assign_owner', config: { userId: owner.id } }, { type: 'create_task', config: { title: 'Projected owner' } }], {
      isActive: false, conditions: { operator: 'AND', conditions: [{ field: 'lead.assignedUserId', operator: 'is_empty', value: null }] },
    });
    const result = await scope(() => workflows.testWorkflow(workflow.id, tenantId, unassigned.id));
    expect(result.valid).toBe(true); expect(result.conditions.matched).toBe(true);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: unassigned.id } })).assignedUserId).toBeNull();
  });
  it('records invalid legacy definitions as failed validation without changing CRM data', async () => {
    const workflow = await scope(() => prisma.workflow.create({ data: { tenantId, name: 'Legacy', trigger: 'lead.created', isActive: true,
      actions: [{ type: 'update_field', field: 'status', value: 'HOT' }] } }));
    await fire(); const [run] = await runs(workflow.id);
    expect(run.status).toBe('failed'); expect(run.steps[0].actionType).toBe('validation');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe(lead.status);
  });
  it('persists Gmail acknowledgement; reports provider failure and skips later actions', async () => {
    const workflow = await create([{ type: 'send_email', config: { templateId: template.id, senderUserId: actor.id } },
      { type: 'create_task', config: { title: 'After email' } }]);
    await fire(); expect((await runs(workflow.id))[0].status).toBe('completed');
    expect(sendEmail).toHaveBeenCalledWith(tenantId, actor.id, lead.email, 'Hello Ada', '<p>Welcome Ada</p>');
    expect(await prisma.emailDeliveryLog.count({ where: { tenantId, gmailMessageId: `provider-message-${tenantId}`, status: 'sent' } })).toBe(1);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Provider credential detail must not leak'));
    await fire(); const [failed] = await runs(workflow.id);
    expect(failed.status).toBe('failed'); expect(failed.errorMessage).not.toContain('credential detail');
    expect(failed.steps.map(step => step.status)).toEqual(['failed', 'skipped']);
    expect(await prisma.emailDeliveryLog.count({ where: { tenantId, status: 'failed' } })).toBe(1);
    expect(await prisma.task.count({ where: { tenantId, title: 'After email' } })).toBe(1);
  });
  it('requires valid ownership, connected sender, required stage fields and a lost reason', async () => {
    await expect(create([{ type: 'assign_owner', config: { userId: outsider.id } }])).rejects.toThrow();
    await expect(create([{ type: 'send_email', config: { templateId: template.id, senderUserId: owner.id } }])).rejects.toThrow(/Connect/);
    await expect(create([{ type: 'move_deal_stage', config: { stageId: lost.id } }], { trigger: 'deal.created' })).rejects.toThrow(/reason/);
    const workflow = await create([{ type: 'move_deal_stage', config: { stageId: required.id } }], { trigger: 'deal.created' });
    const dry = await scope(() => workflows.testWorkflow(workflow.id, tenantId, deal.id));
    expect(dry.valid).toBe(false); expect(dry.actions[0].message).toContain('expectedCloseDate');
    await fire('deal', deal); expect((await runs(workflow.id))[0].status).toBe('failed');
  });
  it('rejects protected fields, unsupported actions/triggers, and invalid numeric conditions at activation', async () => {
    for (const actions of [[{ type: 'update_field', config: { field: 'status', value: 'HOT' } }], [{ type: 'send_sms', config: {} }]]) {
      expect((await call('/automation/workflows', 'POST', { name: 'Unsafe', trigger: 'lead.created', actions, isActive: true })).status).toBe(400);
    }
    expect((await call('/automation/workflows', 'POST', { name: 'Unsupported', trigger: 'task.overdue', actions: [], isActive: false })).status).toBe(400);
    await expect(create([{ type: 'create_task', config: { title: 'Invalid comparison' } }], { trigger: 'deal.created', conditions: {
      operator: 'AND', conditions: [{ field: 'deal.value', operator: 'greater_than', value: '1000' }],
    } })).rejects.toThrow(/number/);
    const draft = await create([], { isActive: false });
    expect((await call(`/automation/workflows/${draft.id}/toggle`, 'PATCH')).status).toBe(400);
  });
  it('enforces view-only RBAC and tenant ownership on mutation, dry run, and history routes', async () => {
    const workflow = await create([{ type: 'create_task', config: { title: 'Permission check' } }]);
    expect((await call('/automation/workflows', 'GET', undefined, viewerToken)).status).toBe(200);
    for (const [path, method, body] of [[`/${workflow.id}/toggle`, 'PATCH', undefined], [`/${workflow.id}/archive`, 'PATCH', undefined],
      [`/${workflow.id}`, 'PUT', { name: 'Forbidden' }], ['', 'POST', { name: 'Forbidden', trigger: 'lead.created', actions: [] }]] as const) {
      expect((await call(`/automation/workflows${path}`, method, body, viewerToken)).status).toBe(403);
    }
    const foreign = await prisma.workflow.create({ data: { tenantId: otherTenantId, name: 'Foreign', trigger: 'lead.created', actions: [] } });
    for (const suffix of ['', '/executions']) expect((await call(`/automation/workflows/${foreign.id}${suffix}`)).status).toBe(404);
    expect((await call(`/automation/workflows/${foreign.id}/test`, 'POST', { entityId: lead.id })).status).toBe(404);
  });
  it('does not execute paused, archived, foreign-tenant or other-environment workflows', async () => {
    const paused = await create([{ type: 'create_task', config: { title: 'Paused' } }], { isActive: false });
    const archived = await create([{ type: 'create_task', config: { title: 'Archived' } }]);
    await scope(() => workflows.archiveWorkflow(archived.id, tenantId, actor.id));
    const sandbox = await scope(() => workflows.createWorkflow(tenantId, actor.id, { name: 'Sandbox', trigger: 'lead.created', isActive: true,
      actions: [{ type: 'create_task', config: { title: 'Sandbox task', assignedUserId: actor.id } }] }), 'SANDBOX');
    await fire(); expect(await runs(paused.id)).toHaveLength(0); expect(await runs(archived.id)).toHaveLength(0);
    expect(await prisma.workflowExecutionRun.count({ where: { workflowId: sandbox.id } })).toBe(0);
    expect((await call(`/automation/workflows/${sandbox.id}/test`, 'POST', { entityId: lead.id })).status).toBe(404);
    await expect(fireWorkflowTrigger({ tenantId, actorId: actor.id, entityType: 'lead', entityId: lead.id, triggerType: 'lead.created', context: {} })).rejects.toThrow(/environment/);
  });
});
