import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { WorkflowAction, WorkflowDraft } from '@leadcrm/shared';
import prisma from '../../../../config/database.config';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import * as workflows from '../workflows.service';
import { fireWorkflowTrigger } from '../workflow.engine';
import { flushWorkflowQueue } from './workflow-queue-test-helper';
import { entityContext } from '../workflows.repository';
import { dispatchAction } from '../../actions/action-dispatcher';
import * as taskPreparation from '../../actions/action-task-input';
import { getTasks } from '../../../operations/tasks/tasks.service';
import { runAuthorizedWorkflow } from '../../../crm/access/crm-record-access.service';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_workflow_test_\d+$/.test(url.pathname);
describe.skipIf(!disposable)('Workflow task matching and atomic associations on disposable PostgreSQL', { timeout: 30000 }, () => {
  let tenantId: string, actorId: string, taskUserId: string, taskRoleId: string, pipelineId: string, secondPipelineId: string;
  let initialStageId: string, nextStageId: string, secondStageId: string, productId: string;
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  const taskAction = (config: Record<string, unknown> = {}): WorkflowAction => ({ type: 'create_task', config: {
    title: `Follow up ${randomUUID()}`, assignedUserId: taskUserId, ...config,
  } });
  const create = (action: WorkflowAction, trigger = 'lead.updated', extra: Partial<WorkflowDraft> = {}) => scope(() => workflows.createWorkflow(tenantId, actorId, {
    name: `Task associations ${randomUUID()}`, trigger, isActive: true, actions: [action], ...extra,
  }));
  const newLead = () => scope(() => prisma.lead.create({ data: { tenantId, firstName: 'Task', lastName: 'Lead', assignedUserId: actorId } }));
  const newContact = () => scope(() => prisma.contact.create({ data: { tenantId, firstName: 'Task', lastName: 'Contact', assignedUserId: actorId } }));
  const newDeal = (leadId?: string, contactId?: string, extra: Record<string, unknown> = {}) => scope(() => prisma.deal.create({ data: {
    tenantId, pipelineId, stageId: initialStageId, title: `Related deal ${randomUUID()}`, assignedUserId: actorId,
    ...(leadId ? { leadDeals: { create: { leadId } } } : {}), ...(contactId ? { contactDeals: { create: { contactId } } } : {}), ...extra,
  } }));
  const fire = async (entity: 'lead' | 'contact' | 'deal', id: string, eventId = randomUUID()) => {
    await scope(() => fireWorkflowTrigger({ tenantId, actorId, eventId, entityType: entity, entityId: id, triggerType: `${entity}.updated`, context: { 'event.changedFields': [entity === 'deal' ? 'title' : 'firstName'] } }));
    await flushWorkflowQueue(tenantId);
  };
  const runs = (workflowId: string) => scope(() => workflows.getWorkflowExecutions(workflowId, tenantId));
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Workflow task matching', slug: randomUUID(), status: 'ACTIVE' } })).id;
    actorId = (await prisma.user.create({ data: { tenantId, role: 'Client Admin', firstName: 'Workflow', lastName: 'Admin', email: `${randomUUID()}@camxian.com` } })).id;
    await scope(async () => {
      const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Task workers', permissions: { create: { module: 'tasks', canView: true } } } });
      taskRoleId = role.id;
      taskUserId = (await prisma.user.create({ data: { tenantId, role: role.name, firstName: 'Task', lastName: 'Assignee', email: `${randomUUID()}@camxian.com`, userRoles: { create: { roleId: role.id } } } })).id;
      pipelineId = (await prisma.pipeline.create({ data: { tenantId, name: 'Primary matching pipeline' } })).id;
      secondPipelineId = (await prisma.pipeline.create({ data: { tenantId, name: 'Other pipeline' } })).id;
      initialStageId = (await prisma.stage.create({ data: { tenantId, pipelineId, name: 'Lead', order: 0 } })).id;
      nextStageId = (await prisma.stage.create({ data: { tenantId, pipelineId, name: 'Qualified', order: 1 } })).id;
      secondStageId = (await prisma.stage.create({ data: { tenantId, pipelineId: secondPipelineId, name: 'Lead', order: 0 } })).id;
      productId = (await prisma.productInterest.create({ data: { tenantId, name: 'Task matching product', dealValue: 50 } })).id;
    });
  });
  beforeEach(async () => { await scope(() => prisma.workflow.updateMany({ where: { tenantId }, data: { isActive: false } })); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('previews three matches without writes, creates one task with three links, and retains every CRM list association after refresh', async () => {
    const lead = await newLead(), contact = await newContact();
    const account = await scope(() => prisma.account.create({ data: { tenantId, name: 'Associated company' } }));
    const deals = await Promise.all(Array.from({ length: 3 }, () => newDeal(lead.id, contact.id, { accountId: account.id })));
    const action = taskAction({ targetMode: 'all_matching' }), workflow = await create(action);
    const counts = async () => Promise.all([prisma.task.count({ where: { tenantId } }), prisma.auditLog.count({ where: { tenantId } }),
      prisma.emailDeliveryLog.count({ where: { tenantId } }), prisma.tenantPreference.count({ where: { tenantId, module: 'workflow-assignment' } })]);
    const before = await counts();
    const preview = await scope(() => workflows.testWorkflow(workflow.id, tenantId, lead.id, actorId));
    expect(preview).toMatchObject({ valid: true, actions: [{ taskPreview: { taskCount: 1, dealCount: 3,
      dealIds: deals.map(deal => deal.id).sort(), associationSummary: 'Creates 1 task linked to 3 deals.' } }] });
    expect(preview.actions[0].taskPreview?.deals).toHaveLength(3);
    expect(await counts()).toEqual(before);
    const eventId = randomUUID(); await fire('lead', lead.id, eventId); await fire('lead', lead.id, eventId);
    const history = await runs(workflow.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'completed', steps: [{ status: 'success', output: {
      taskCount: 1, dealCount: 3, dealIds: deals.map(deal => deal.id).sort(), associationSummary: 'Creates 1 task linked to 3 deals.',
    } }] });
    const taskId = String(history[0].steps[0].output?.taskId);
    expect(await prisma.task.count({ where: { tenantId, title: String(action.config.title) } })).toBe(1);
    expect(await prisma.taskDeal.count({ where: { tenantId, taskId } })).toBe(3);
    expect(await prisma.auditLog.count({ where: { tenantId, entityId: taskId, action: 'task.created' } })).toBe(1);
    for (const query of [{ leadId: lead.id }, { contactId: contact.id }, { accountId: account.id }, ...deals.map(deal => ({ dealId: deal.id }))]) {
      const page = await scope(() => getTasks(tenantId, query));
      expect(page.meta.total).toBe(1); expect(page.data).toMatchObject([{ id: taskId, dealIds: deals.map(deal => deal.id).sort() }]);
    }
    const saved = await scope(() => getTasks(tenantId, { leadId: lead.id }));
    expect(saved.data[0].relatedRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'lead', id: lead.id }), expect.objectContaining({ kind: 'contact', id: contact.id }), expect.objectContaining({ kind: 'account', id: account.id }),
    ]));
  });

  it('matches Contact direct and converted-Lead deals with pipeline, stage and Product filters', async () => {
    const lead = await newLead(), contact = await newContact();
    await scope(() => prisma.lead.update({ where: { id: lead.id, tenantId }, data: { contactId: contact.id, convertedAt: new Date() } }));
    const direct = await newDeal(undefined, contact.id, { productInterestId: productId });
    const converted = await newDeal(lead.id, undefined, { productInterestIds: [productId] });
    await scope(() => prisma.contactDeal.create({ data: { tenantId, contactId: contact.id, dealId: converted.id } }));
    await newDeal(undefined, contact.id, { productInterestId: productId, stageId: nextStageId });
    await newDeal(undefined, contact.id, { productInterestId: productId, pipelineId: secondPipelineId, stageId: secondStageId });
    await newDeal(undefined, contact.id); await newDeal(undefined, contact.id, { isArchived: true, productInterestId: productId });
    const action = taskAction({ targetMode: 'all_matching', pipelineId, currentStageId: initialStageId, productInterestId: productId });
    const workflow = await create(action, 'contact.updated');
    const preview = await scope(() => workflows.testWorkflow(workflow.id, tenantId, contact.id, actorId));
    expect(preview).toMatchObject({ valid: true, actions: [{ taskPreview: { dealCount: 2, dealIds: [direct.id, converted.id].sort() } }] });
    await fire('contact', contact.id);
    const history = await runs(workflow.id);
    expect(history[0].status).toBe('completed');
    expect(await prisma.taskDeal.count({ where: { tenantId, taskId: String(history[0].steps[0].output?.taskId) } })).toBe(2);
  });

  it('explains ambiguous or missing matches and preserves a valid saved exact-deal selection', async () => {
    const lead = await newLead(); const deals = await Promise.all([newDeal(lead.id), newDeal(lead.id), newDeal(lead.id, undefined, { stageId: nextStageId })]);
    const ambiguous = await create(taskAction());
    const preview = await scope(() => workflows.testWorkflow(ambiguous.id, tenantId, lead.id, actorId));
    expect(preview).toMatchObject({ valid: false, actions: [{ status: 'failed', message: expect.stringContaining('3 related deals match your selection') }] });
    await fire('lead', lead.id);
    expect((await runs(ambiguous.id))[0].status).toBe('failed');
    expect(await prisma.task.count({ where: { tenantId, title: String(ambiguous.actions[0].config.title) } })).toBe(0);
    await scope(() => workflows.toggleWorkflow(ambiguous.id, tenantId, actorId, false));
    const exact = await create(taskAction({ dealId: deals[0].id }));
    expect(await scope(() => workflows.testWorkflow(exact.id, tenantId, lead.id, actorId))).toMatchObject({ valid: true, actions: [{ taskPreview: { dealCount: 1, dealIds: [deals[0].id] } }] });
    const narrow = await create(taskAction({ pipelineId, currentStageId: nextStageId }));
    expect(await scope(() => workflows.testWorkflow(narrow.id, tenantId, lead.id, actorId))).toMatchObject({ valid: true, actions: [{ taskPreview: { dealIds: [deals[2].id] } }] });
    const unrelated = await newLead();
    expect(await scope(() => workflows.testWorkflow(exact.id, tenantId, unrelated.id, actorId))).toMatchObject({ valid: false, actions: [{ message: expect.stringContaining('No related deals match') }] });
  });

  it('enforces all 50 allowed associations and rejects 51 without dropping any matching deal', async () => {
    const lead = await newLead(); const ids = Array.from({ length: 51 }, () => randomUUID());
    await scope(async () => {
      await prisma.deal.createMany({ data: ids.map(id => ({ id, tenantId, pipelineId, stageId: initialStageId, title: `Limit deal ${id}`, assignedUserId: actorId })) });
      await prisma.leadDeal.createMany({ data: ids.map(dealId => ({ tenantId, dealId, leadId: lead.id })) });
    });
    const workflow = await create(taskAction({ targetMode: 'all_matching' }));
    expect(await scope(() => workflows.testWorkflow(workflow.id, tenantId, lead.id, actorId))).toMatchObject({ valid: false, actions: [{ message: expect.stringContaining('51 related deals match your selection. A task supports up to 50 deal associations.') }] });
    await fire('lead', lead.id);
    expect(await prisma.task.count({ where: { tenantId, title: String(workflow.actions[0].config.title) } })).toBe(0);
    await scope(() => prisma.leadDeal.delete({ where: { leadId_dealId: { leadId: lead.id, dealId: ids[50] } } }));
    await fire('lead', lead.id);
    const successful = (await runs(workflow.id)).find(run => run.status === 'completed')!;
    expect(await prisma.taskDeal.count({ where: { tenantId, taskId: String(successful.steps[0].output?.taskId) } })).toBe(50);
  });

  it('revalidates source relationships inside the Task transaction before saving any record', async () => {
    const lead = await newLead(); const deals = await Promise.all([newDeal(lead.id), newDeal(lead.id), newDeal(lead.id)]);
    const workflow = await create(taskAction({ targetMode: 'all_matching' }));
    const original = taskPreparation.prepareWorkflowTaskInput;
    const prepare = vi.spyOn(taskPreparation, 'prepareWorkflowTaskInput').mockImplementationOnce(async input => {
      const payload = await original(input);
      await prisma.leadDeal.delete({ where: { leadId_dealId: { leadId: lead.id, dealId: deals[0].id } } });
      return payload;
    });
    try { await fire('lead', lead.id); } finally { prepare.mockRestore(); }
    expect(await prisma.task.count({ where: { tenantId, title: String(workflow.actions[0].config.title) } })).toBe(0);
    expect((await runs(workflow.id))[0]).toMatchObject({ status: 'failed', steps: [{ status: 'failed', error: expect.stringContaining('Workflow Deal context changed') }] });
  });

  it('uses the persisted Task receipt and assignee without rotating or regenerating input on repeated dispatch', async () => {
    const lead = await newLead(); await newDeal(lead.id);
    const action = taskAction({ assignmentTarget: { type: 'role', id: taskRoleId, strategy: 'round_robin' } });
    const workflow = await create(action); await fire('lead', lead.id);
    const run = (await runs(workflow.id))[0], step = run.steps[0];
    expect(run.status).toBe('completed');
    const storedBefore = await prisma.workflowExecutionStep.findUniqueOrThrow({ where: { id: step.id } });
    const cursorBefore = await prisma.tenantPreference.findMany({ where: { tenantId, module: 'workflow-assignment' } });
    const context = await scope(() => entityContext('lead', lead.id, tenantId));
    const prepare = vi.spyOn(taskPreparation, 'prepareWorkflowTaskInput');
    let replay: Awaited<ReturnType<typeof dispatchAction>>;
    try { replay = await scope(() => runAuthorizedWorkflow(tenantId, run.id, () => dispatchAction(action, context!, tenantId, actorId, { workflowId: workflow.id, actionIndex: 0, stepId: step.id }))); }
    finally { expect(prepare).not.toHaveBeenCalled(); prepare.mockRestore(); }
    expect(replay!).toMatchObject({ success: true, output: { taskId: step.output?.taskId, resolvedUserId: taskUserId, assignmentTargetType: 'role', assignmentTargetId: taskRoleId } });
    expect(await prisma.task.count({ where: { tenantId, title: String(action.config.title) } })).toBe(1);
    expect(await prisma.tenantPreference.findMany({ where: { tenantId, module: 'workflow-assignment' } })).toEqual(cursorBefore);
    expect((await prisma.workflowExecutionStep.findUniqueOrThrow({ where: { id: step.id } })).resolvedInput).toEqual(storedBefore.resolvedInput);
    expect(await prisma.auditLog.count({ where: { tenantId, entityId: String(step.output?.taskId), action: 'task.created' } })).toBe(1);
  });

  it('rechecks assignee eligibility after payload preparation and rejects unavailable filters on save', async () => {
    const lead = await newLead(); await newDeal(lead.id);
    await expect(create(taskAction({ pipelineId: randomUUID() }))).rejects.toThrow('pipeline');
    await expect(create(taskAction({ pipelineId, currentStageId: secondStageId }))).rejects.toThrow('another pipeline');
    const workflow = await create(taskAction()); const original = taskPreparation.prepareWorkflowTaskInput;
    const prepare = vi.spyOn(taskPreparation, 'prepareWorkflowTaskInput').mockImplementationOnce(async input => {
      const payload = await original(input); await prisma.user.update({ where: { id: taskUserId }, data: { status: 'INACTIVE' } }); return payload;
    });
    try { await fire('lead', lead.id); } finally { prepare.mockRestore(); await prisma.user.update({ where: { id: taskUserId }, data: { status: 'ACTIVE' } }); }
    expect(await prisma.task.count({ where: { tenantId, title: String(workflow.actions[0].config.title) } })).toBe(0);
    expect((await runs(workflow.id))[0]).toMatchObject({ status: 'failed', steps: [{ status: 'failed', error: expect.stringContaining('assignee') }] });
  });

  it.each(['canCreate', 'canAssign', 'canAssignSelf', 'deals.view'] as const)('rechecks the Workflow author %s grant inside the Task write transaction', async revoked => {
    const lead = await newLead(); await newDeal(lead.id);
    const role = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: `Workflow runner ${randomUUID()}`, permissions: { create: [
      { module: 'workflows', canView: true, canActivate: true }, { module: 'leads', canView: true }, { module: 'deals', canView: true },
      { module: 'tasks', canView: true, canCreate: true, canAssign: true }, { module: 'users', canView: true },
    ] } } }));
    const runner = await scope(() => prisma.user.create({ data: { tenantId, role: role.name, firstName: 'Workflow', lastName: 'Runner', email: `${randomUUID()}@camxian.com`, userRoles: { create: { roleId: role.id } } } }));
    const action = taskAction(revoked === 'canAssignSelf' ? { assignedUserId: runner.id } : {});
    const workflow = await scope(() => workflows.createWorkflow(tenantId, runner.id, { name: `Permission race ${randomUUID()}`, trigger: 'lead.updated', actions: [action], isActive: true }));
    const original = taskPreparation.prepareWorkflowTaskInput;
    const prepare = vi.spyOn(taskPreparation, 'prepareWorkflowTaskInput').mockImplementationOnce(async input => {
      const payload = await original(input);
      await prisma.rolePermission.updateMany({ where: { tenantId, roleId: role.id, module: revoked === 'deals.view' ? 'deals' : 'tasks' },
        data: revoked === 'deals.view' ? { canView: false } : revoked === 'canCreate' ? { canCreate: false } : { canAssign: false } });
      return payload;
    });
    try { await fire('lead', lead.id); } finally { prepare.mockRestore(); }
    expect(await prisma.task.count({ where: { tenantId, title: String(action.config.title) } })).toBe(0);
    expect((await runs(workflow.id))[0]).toMatchObject({ status: 'failed', steps: [{ status: 'failed', error: 'Access denied' }] });
  });
});
