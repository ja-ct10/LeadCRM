import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { workflowChain } from './workflow-dispatch-context';
import type { WorkflowFireParams } from './workflow.engine';
import { findTrigger } from '../triggers/trigger-catalog';
import { ValidationError } from '../../../shared/errors/http-error';
import { entityContext } from './workflows.repository';
import { interruptWorkflowRun } from './workflow-interruption';

const metadata = ['event.previousStageId', 'event.newStageId', 'event.previousStatus', 'event.newStatus', 'event.changedFields'];

/** Snapshot the recipients in the source transaction. A replay never discovers new workflows. */
export async function enqueueWorkflowTrigger(tx: Prisma.TransactionClient, params: WorkflowFireParams) {
  if (tenantContext.getStore()?.tenantId !== params.tenantId) throw new ValidationError('A matching CRM tenant context is required for automation.');
  const trigger = findTrigger(params.triggerType);
  if (!trigger || trigger.entity !== params.entityType) throw new ValidationError('Unsupported workflow trigger.');
  const eventId = params.eventId ?? (params.triggerType.endsWith('.created') ? `${params.triggerType}:${params.entityId}` : undefined);
  if (!eventId || eventId.length > 500) throw new ValidationError('A stable event identifier is required for automation.');
  const ancestry = [...(workflowChain.getStore() ?? [])];
  if (ancestry.length >= 10) return;
  const context = Object.fromEntries(Object.entries(params.context).filter(([key]) => metadata.includes(key)));
  const workflows = await tx.workflow.findMany({ where: { tenantId: params.tenantId, trigger: params.triggerType, isActive: true, status: 'ACTIVE', isArchived: false }, orderBy: { id: 'asc' } });
  if (!workflows.length) return;
  const savedContext = await entityContext(trigger.entity, params.entityId, params.tenantId, tx);
  if (!savedContext) throw new ValidationError('The triggering CRM record is unavailable.');
  const eventContext = JSON.parse(JSON.stringify({ ...savedContext, ...context })) as Prisma.InputJsonObject;
  const recordName = String(eventContext[`${trigger.entity}.title`] ?? eventContext[`${trigger.entity}.name`] ??
    `${eventContext[`${trigger.entity}.firstName`] ?? ''} ${eventContext[`${trigger.entity}.lastName`] ?? ''}`).trim().slice(0, 255);
  for (const workflow of workflows) {
    if (ancestry.includes(workflow.id)) continue;
    const triggerId = randomUUID();
    // PostgreSQL uniqueness errors abort transactions: use ON CONFLICT, never catch-and-continue.
    const inserted = await tx.workflowTriggerRecord.createMany({ data: [{ id: triggerId, tenantId: params.tenantId, workflowId: workflow.id, triggerType: params.triggerType, entityType: params.entityType, entityId: params.entityId, eventId, payload: { queueVersion: 1, recordName } }], skipDuplicates: true });
    if (!inserted.count) continue;
    await tx.workflowExecutionRun.create({ data: { tenantId: params.tenantId, workflowId: workflow.id, triggerId, entityType: params.entityType, entityId: params.entityId,
      status: 'queued', workflowVersion: workflow.version,
      definitionSnapshot: { name: workflow.name, description: workflow.description, trigger: workflow.trigger, conditions: workflow.conditions, actions: workflow.actions, isActive: workflow.isActive },
      dispatchContext: { version: 1, actorId: params.actorId ?? null, activatedById: workflow.activatedById, ancestry, context, eventContext } as Prisma.InputJsonValue,
    } });
  }
}

export async function dispatchQueuedWorkflows() {
  const now = new Date();
  // Historical runs have null context and can never be mistaken for recoverable work.
  const expired = await prisma.workflowExecutionRun.findMany({ where: { status: 'running', dispatchContext: { not: Prisma.DbNull }, dispatchStartedAt: { not: null }, leaseUntil: { lt: now } }, select: { id: true, tenantId: true }, take: 50 });
  for (const run of expired) await tenantContext.run({ tenantId: run.tenantId }, () => prisma.$transaction(async tx => {
    await interruptWorkflowRun(tx, run, { status: 'running', leaseUntil: { lt: now } }, now);
  }));
  const due = await prisma.workflowExecutionRun.findMany({ where: { status: 'queued', dispatchContext: { not: Prisma.DbNull }, dispatchStartedAt: null, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, orderBy: [{ startedAt: 'asc' }, { id: 'asc' }], take: 10, include: { trigger: true } });
  for (const item of due) await tenantContext.run({ tenantId: item.tenantId }, async () => {
    const leaseId = randomUUID();
    const claim = await prisma.workflowExecutionRun.updateMany({ where: { id: item.id, tenantId: item.tenantId, status: 'queued', dispatchStartedAt: null, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: { leaseId, leaseUntil: new Date(Date.now() + 300000) } });
    if (!claim.count) return;
    const context = item.dispatchContext as { version?: number; actorId?: string; activatedById?: string; ancestry?: string[]; context?: Record<string, unknown>; eventContext?: Record<string, unknown> };
    try {
      const workflow = await prisma.workflow.findFirst({ where: { id: item.workflowId, tenantId: item.tenantId } });
      if (context.version !== 1 || !workflow || !workflow.isActive || workflow.isArchived || workflow.status !== 'ACTIVE' || workflow.version !== item.workflowVersion || workflow.activatedById !== context.activatedById) {
        await prisma.workflowExecutionRun.updateMany({ where: { id: item.id, leaseId, status: 'queued' }, data: { status: 'skipped', completedAt: new Date(), errorMessage: 'The saved workflow authorization or definition changed after this event.', leaseId: null, leaseUntil: null } });
        return;
      }
      if (!(await prisma.workflowExecutionRun.updateMany({ where: { id: item.id, leaseId, status: 'queued', dispatchStartedAt: null, leaseUntil: { gt: new Date() } }, data: { status: 'running', dispatchStartedAt: new Date() } })).count) return;
      const { fireWorkflowTrigger } = await import('./workflow.engine.js');
      await workflowChain.run(new Set(context.ancestry ?? []), () => fireWorkflowTrigger({ tenantId: item.tenantId, actorId: context.actorId, triggerType: item.trigger.triggerType, entityType: item.entityType, entityId: item.entityId, eventId: item.trigger.eventId!, context: context.context ?? {} }, { workflow, run: item, leaseId, eventContext: context.eventContext }));
      await prisma.workflowExecutionRun.updateMany({ where: { id: item.id, leaseId, status: 'running', leaseUntil: { gt: new Date() } }, data: { status: 'skipped', completedAt: new Date(), errorMessage: 'The triggering state changed before dispatch.' } });
      await prisma.workflowExecutionRun.updateMany({ where: { id: item.id, leaseId, status: { not: 'running' } }, data: { leaseId: null, leaseUntil: null } });
    } catch {
      await prisma.$transaction(async tx => {
        // Read persisted state through conditional writes: the dispatch marker's
        // acknowledgement may have been lost even though the write committed.
        const undispatched = await tx.workflowExecutionRun.updateMany({ where: {
          id: item.id, tenantId: item.tenantId, leaseId, status: 'queued', dispatchStartedAt: null,
        }, data: { leaseId: null, leaseUntil: null } });
        if (undispatched.count) return; // The next bounded tick may safely retry preparation.
        await interruptWorkflowRun(tx, item, { leaseId, status: 'running', dispatchStartedAt: { not: null } });
      });
    }
  });
}

export function startWorkflowScheduler() {
  let stopping = false;
  let pending: Promise<void> | undefined;
  const tick = () => {
    if (!stopping && !pending) pending = dispatchQueuedWorkflows().catch(error => console.error('[Workflow] Queue tick failed', { failureClass: error instanceof Error ? error.name : 'UnknownError' })).finally(() => { pending = undefined; });
  };
  const timer = setInterval(tick, 30000);
  timer.unref();
  tick();
  return async () => { stopping = true; clearInterval(timer); await pending; };
}
