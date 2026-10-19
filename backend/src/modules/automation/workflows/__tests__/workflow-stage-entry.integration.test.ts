import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../../../config/database.config';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { salesTransaction } from '../../../crm/leads/lead-automation.service';
import { createDeal, moveDealStage, moveDealPipeline, duplicateDeal } from '../../../crm/deals/deals.service';
import { cancelOpenDeals } from '../../../crm/engagement.service';
import { listFields } from '../../../crm/closing-requirements/closing-requirements.service';
import { fireDealStageChanged } from '../../triggers/triggers.service';
import { dispatchQueuedWorkflows } from '../workflow-queue';
import { flushWorkflowQueue } from './workflow-queue-test-helper';
import * as workflows from '../workflows.service';
import * as taskPreparation from '../../actions/action-task-input';
import * as assignments from '../../assignment/workflow-assignment.service';
import { resolveWorkflowTemplate } from '../../../../../../frontend/src/features/tenant/automation/workflows/services/workflow-stage-templates';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_workflow_test_\d+$/.test(url.pathname);

describe.skipIf(!disposable)('persisted Workflow stage entry identity and Task preview', { timeout: 30000 }, () => {
  let tenantId: string, actorId: string, ownerId: string, replacementId: string, pipelineId: string, initialId: string, qualifiedId: string, lostId: string, wonId: string, contactedId: string, customId: string, productId: string;
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  const newDeal = (title = 'Stage entry opportunity') => scope(async () => {
    const lead = await prisma.lead.create({ data: { tenantId, firstName: 'Entry', lastName: 'Fixture', assignedUserId: ownerId } });
    return createDeal(tenantId, actorId, { title, pipelineId, stageId: initialId, productInterestIds: [productId], assignedUserId: ownerId, leadIds: [lead.id] });
  });
  const move = (id: string, stageId: string) => scope(() => moveDealStage(id, tenantId, actorId, { stageId,
    ...(stageId === lostId ? { lostReason: 'Controlled stage-entry scenario' } : {}) }));
  const create = (active = true, title = 'Persisted stage follow-up') => scope(() => workflows.createWorkflow(tenantId, actorId, {
    name: `Entry ${randomUUID()}`, trigger: 'deal.stage_changed', isActive: active,
    conditions: { operator: 'AND', conditions: [{ field: 'event.newStageId', operator: 'equals', value: qualifiedId }] },
    actions: [{ type: 'create_task', config: { title, dueDaysFromNow: 1, assignedUserId: ownerId } }],
  }));
  const runs = (id: string) => scope(() => workflows.getWorkflowExecutions(id, tenantId));
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Stage entry acceptance', slug: randomUUID(), status: 'ACTIVE' } })).id;
    actorId = (await prisma.user.create({ data: { tenantId, role: 'Client Admin', email: `${randomUUID()}@example.test`, firstName: 'Admin', lastName: 'Actor' } })).id;
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Entry staff' } });
    await prisma.rolePermission.createMany({ data: ['deals', 'leads', 'contacts', 'accounts', 'tasks'].map(module => ({ tenantId, roleId: role.id, module, canView: true, canEdit: true })) });
    ownerId = (await prisma.user.create({ data: { tenantId, role: 'Entry staff', email: `${randomUUID()}@example.test`, firstName: 'Assigned', lastName: 'Staff', userRoles: { create: { roleId: role.id } } } })).id;
    replacementId = (await prisma.user.create({ data: { tenantId, role: 'Entry staff', email: `${randomUUID()}@example.test`, firstName: 'Replacement', lastName: 'Staff', userRoles: { create: { roleId: role.id } } } })).id;
    pipelineId = (await prisma.pipeline.create({ data: { tenantId, name: 'Entry pipeline' } })).id;
    const stage = (name: string, order: number, isLost = false) => prisma.stage.create({ data: { tenantId, pipelineId, name, order, isLost } });
    initialId = (await stage('Lead', 0)).id; qualifiedId = (await stage('Qualified', 1)).id; lostId = (await stage('Cancelled', 2, true)).id;
    contactedId = (await stage('Contacted', 3)).id; customId = (await stage('Commercial review', 4)).id;
    wonId = (await prisma.stage.create({ data: { tenantId, pipelineId, name: 'Implementation approved', order: 5, isWon: true } })).id;
    productId = (await prisma.productInterest.create({ data: { tenantId, name: 'Entry Product', dealValue: 1000 } })).id;
    await scope(() => listFields(tenantId));
  }, 60000);
  beforeEach(async () => { vi.restoreAllMocks(); await prisma.workflow.updateMany({ where: { tenantId }, data: { isActive: false } }); });
  afterAll(async () => { vi.useRealTimers(); vi.restoreAllMocks(); await prisma.$disconnect(); });

  it.each(['created', 'contacted', 'qualified', 'custom', 'won', 'lost', 'assign', 'reopen'] as const)('persists the configured %s template through canonical source events', async scenario => {
    const options = await scope(() => workflows.getOptions(tenantId, actorId));
    const stageId = scenario === 'created' ? initialId : scenario === 'contacted' || scenario === 'assign' ? contactedId : scenario === 'custom' ? customId : scenario === 'won' ? wonId : scenario === 'lost' ? lostId : qualifiedId;
    const kind = ['created', 'won', 'lost', 'assign', 'reopen'].includes(scenario) ? scenario : 'entry';
    const identity = `stage:${kind}:${pipelineId}:${stageId}${scenario === 'reopen' ? ':' + lostId : ''}`;
    const entry = resolveWorkflowTemplate(identity, options)!;
    expect(entry).toBeDefined(); expect(entry.recipe.isActive).toBe(false);
    const draft = structuredClone(entry.recipe);
    draft.name = `${scenario} ${randomUUID()}`;
    if (scenario === 'assign') draft.actions[0].config = { assignmentTarget: { type: 'user', id: replacementId } };
    const workflow = await scope(() => workflows.createWorkflow(tenantId, actorId, draft));
    expect(workflow.isActive).toBe(false);
    await scope(() => workflows.toggleWorkflow(workflow.id, tenantId, actorId, true));
    const deal = await newDeal(`${scenario} configured opportunity`);
    if (scenario === 'won') { await move(deal.id, qualifiedId); await move(deal.id, wonId); }
    else if (scenario === 'reopen') { await move(deal.id, lostId); await move(deal.id, qualifiedId); }
    else if (scenario !== 'created') await move(deal.id, stageId);
    const start = Date.now();
    await flushWorkflowQueue(tenantId);
    const history = await runs(workflow.id);
    const completed = history.filter(run => run.status === 'completed');
    expect(completed).toHaveLength(1);
    const step = completed[0].steps.find(step => step.actionType === 'create_task')!;
    const task = await prisma.task.findUniqueOrThrow({ where: { id: String(step.output?.taskId) }, include: { dealLinks: true } });
    expect(task).toMatchObject({ tenantId, createdById: actorId, assignedUserId: scenario === 'assign' ? replacementId : ownerId, status: 'pending', priority: 'Medium' });
    expect(task.dealLinks.map(link => link.dealId)).toEqual([deal.id]);
    const days = scenario === 'lost' ? 3 : 1;
    expect(task.dueDate.getTime()).toBeGreaterThanOrEqual(start + days * 86400000 - 1000);
    expect(task.dueDate.getTime()).toBeLessThanOrEqual(Date.now() + days * 86400000);
    expect(await prisma.auditLog.count({ where: { tenantId, entityId: task.id, action: 'task.created' } })).toBe(1);
    if (scenario === 'assign') expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).assignedUserId).toBe(replacementId);
    if (scenario === 'won') await expect(move(deal.id, qualifiedId)).rejects.toThrow('won');
  });

  it('skips the older entry after same-millisecond leave/re-entry, persists latest Task, and deduplicates deliveries', async () => {
    const workflow = await create(); const deal = await newDeal();
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-13T12:00:00.000Z'));
    let first: Awaited<ReturnType<typeof move>>, last: Awaited<ReturnType<typeof move>>;
    try { first = await move(deal.id, qualifiedId); await move(deal.id, lostId); last = await move(deal.id, qualifiedId); }
    finally { vi.useRealTimers(); }
    expect(first!.stageHistory!.movedAt).toEqual(last!.stageHistory!.movedAt);
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).currentStageHistoryId).toBe(last!.stageHistory!.id);
    const repeat = () => scope(() => fireDealStageChanged({ tenantId, actorId, eventId: last!.stageHistory!.id, deal: last!.deal,
      prevStageId: lostId, newStageId: qualifiedId, newStageName: 'Qualified', isWon: false, isLost: false }));
    await Promise.all([repeat(), repeat()]); await Promise.all([dispatchQueuedWorkflows(), dispatchQueuedWorkflows()]);
    await flushWorkflowQueue(tenantId);
    const history = await runs(workflow.id);
    expect(history).toHaveLength(3);
    const old = history.find(run => run.trigger.payload?.recordName === deal.title && run.steps.some(step => String(step.output?.reason).includes('superseded')));
    expect(old).toMatchObject({ status: 'skipped', errorMessage: expect.stringContaining('superseded') });
    expect(old!.steps).toMatchObject([{ status: 'skipped', output: { reason: expect.stringContaining('superseded') } }]);
    const success = history.find(run => run.status === 'completed')!;
    const taskId = String(success.steps[0].output?.taskId);
    expect(await prisma.task.count({ where: { tenantId, title: 'Persisted stage follow-up' } })).toBe(1);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).toMatchObject({ createdById: actorId, assignedUserId: ownerId, status: 'pending' });
    expect(await prisma.auditLog.count({ where: { tenantId, action: 'task.created', entityId: taskId } })).toBe(1);
    expect(await prisma.notificationEvent.count({ where: { tenantId, type: 'task_assigned', entityId: taskId } })).toBe(1);
    await move(deal.id, lostId); await move(deal.id, qualifiedId); await flushWorkflowQueue(tenantId);
    expect(await prisma.task.count({ where: { tenantId, title: 'Persisted stage follow-up' } })).toBe(2);
  });

  it('rechecks stage identity inside the Task transaction after input preparation', async () => {
    const workflow = await create(true, 'Must not persist'); const deal = await newDeal(); await move(deal.id, qualifiedId);
    const original = taskPreparation.prepareWorkflowTaskInput;
    const prepare = vi.spyOn(taskPreparation, 'prepareWorkflowTaskInput').mockImplementationOnce(async input => {
      const result = await original(input); await move(deal.id, lostId); return result;
    });
    try { await flushWorkflowQueue(tenantId); } finally { prepare.mockRestore(); }
    expect(await prisma.task.count({ where: { tenantId, title: 'Must not persist' } })).toBe(0);
    expect((await runs(workflow.id)).some(run => run.status === 'skipped' && run.steps.some(step => String(step.output?.reason).includes('superseded')))).toBe(true);
  });

  it('previews real persisted stage metadata and canonical Task values without consuming state', async () => {
    const workflow = await create(false, 'Follow up {{title}}'); const deal = await newDeal('Preview opportunity'); const transition = await move(deal.id, qualifiedId);
    const counts = async () => Promise.all([prisma.task.count({ where: { tenantId } }), prisma.workflowExecutionRun.count({ where: { tenantId } }), prisma.auditLog.count({ where: { tenantId } }), prisma.tenantPreference.count({ where: { tenantId, module: 'workflow-assignment' } })]);
    const before = await counts();
    const result = await scope(() => workflows.testWorkflow(workflow.id, tenantId, deal.id, actorId, transition.stageHistory!.id));
    expect(result).toMatchObject({ valid: true, trigger: { matched: true, stageHistoryId: transition.stageHistory!.id, eventId: `deal.stage_changed:${transition.stageHistory!.id}` }, conditions: { matched: true },
      actions: [{ valid: true, status: 'ready', taskPreview: { title: 'Follow up Preview opportunity', assignedUserId: ownerId, dealIds: [deal.id], priority: 'Medium', status: 'pending' } }] });
    expect(await counts()).toEqual(before);
    await move(deal.id, lostId); await move(deal.id, qualifiedId);
    const superseded = await scope(() => workflows.testWorkflow(workflow.id, tenantId, deal.id, actorId, transition.stageHistory!.id));
    expect(superseded).toMatchObject({ valid: false, trigger: { matched: false, reason: expect.stringContaining('superseded') }, actions: [{ status: 'skipped' }] });
    const missing = await scope(() => workflows.testWorkflow(workflow.id, tenantId, deal.id, actorId));
    expect(missing.trigger.reason).toContain('Choose a recorded');
    await expect(scope(() => workflows.testWorkflow(workflow.id, tenantId, deal.id, actorId, randomUUID()))).rejects.toThrow('not found');
  });

  it('reports rendered title overflow in preview and live execution with no Task persisted', async () => {
    const workflow = await create(true, 'Follow up {{title}}'); const deal = await newDeal('X'.repeat(250)); const transition = await move(deal.id, qualifiedId);
    const preview = await scope(() => workflows.testWorkflow(workflow.id, tenantId, deal.id, actorId, transition.stageHistory!.id));
    expect(preview.actions[0]).toMatchObject({ valid: false, status: 'failed', message: expect.stringContaining('Rendered Task title') });
    await flushWorkflowQueue(tenantId);
    expect((await runs(workflow.id))[0]).toMatchObject({ status: 'failed', steps: [{ status: 'failed', error: expect.stringContaining('Rendered Task title') }] });
    expect(await prisma.task.count({ where: { tenantId, dealLinks: { some: { dealId: deal.id } } } })).toBe(0);
  });

  it('preserves the known persisted Task outcome if capacity cleanup fails', async () => {
    const workflow = await create(true, 'Cleanup persisted'); const deal = await newDeal(); await move(deal.id, qualifiedId);
    const cleanup = vi.spyOn(assignments, 'completeWorkflowAssignment').mockRejectedValueOnce(new Error('Temporary cleanup failure'));
    try { await flushWorkflowQueue(tenantId); } finally { cleanup.mockRestore(); }
    const run = (await runs(workflow.id))[0]; expect(run.status).toBe('completed');
    expect(run.steps[0]).toMatchObject({ status: 'success', output: { assignmentCleanupPending: true, cleanupWarning: expect.stringContaining('saved') } });
    expect(await prisma.task.findUniqueOrThrow({ where: { id: String(run.steps[0].output?.taskId) } })).toMatchObject({ title: 'Cleanup persisted' });
  });

  it('updates pointer identity through pipeline and cancellation writers and resets it on duplicate', async () => {
    const deal = await newDeal(); const start = (await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).currentStageHistoryId;
    expect(start).toBeTruthy();
    const duplicated = await scope(() => duplicateDeal(deal.id, tenantId, actorId));
    const copy = await prisma.deal.findUniqueOrThrow({ where: { id: duplicated!.id } });
    expect(copy.currentStageHistoryId).toBeTruthy(); expect(copy.currentStageHistoryId).not.toBe(start);
    const target = await prisma.pipeline.create({ data: { tenantId, name: 'Second entry pipeline' } });
    const stage = await prisma.stage.create({ data: { tenantId, pipelineId: target.id, name: 'Lead', order: 0 } });
    const moved = await scope(() => moveDealPipeline(deal.id, tenantId, actorId, { pipelineId: target.id, stageId: stage.id }));
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).currentStageHistoryId).toBe(moved.stageHistory!.id);
    const lead = await prisma.lead.create({ data: { tenantId, firstName: 'Cancellation', lastName: 'Source' } });
    await prisma.leadDeal.create({ data: { tenantId, leadId: lead.id, dealId: copy.id } });
    await scope(() => salesTransaction(tx => cancelOpenDeals(tx, tenantId, actorId, { leadId: lead.id }, 'Controlled cancellation')));
    const cancelled = await prisma.deal.findUniqueOrThrow({ where: { id: copy.id } });
    expect(cancelled.stageId).toBe(lostId);
    expect(await prisma.dealStageHistory.findUniqueOrThrow({ where: { id: cancelled.currentStageHistoryId! } })).toMatchObject({ dealId: copy.id, previousStageId: initialId, newStageId: lostId });
  });
});
