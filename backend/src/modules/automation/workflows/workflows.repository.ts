import { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import type { WorkflowDraft, WorkflowEntity } from '@leadcrm/shared';

export async function builderOptions(tenantId: string, marketing: boolean) {
  const [users, pipelines, templates, campaigns] = await Promise.all([
    prisma.user.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: 'asc' } }),
    prisma.pipeline.findMany({ where: { tenantId, isArchived: false }, select: { id: true, name: true, stages: { select: { id: true, name: true }, orderBy: { order: 'asc' } } } }),
    marketing ? prisma.template.findMany({ where: { tenantId, isArchived: false, type: 'Email' }, select: { id: true, name: true } }) : [],
    marketing ? prisma.campaign.findMany({ where: { tenantId, isArchived: false, status: 'DRAFT', type: 'EMAIL' }, select: { id: true, name: true } }) : [],
  ]);
  return { users: users.map(user => ({ id: user.id, name: `${user.firstName} ${user.lastName}` })), pipelines, templates, campaigns };
}

export function findWorkflowById(id: string, tenantId: string) {
  return prisma.workflow.findFirst({ where: { id, tenantId } });
}
export async function listWorkflows(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const where: Prisma.WorkflowWhereInput = { tenantId, isArchived: query.archived === 'true',
    ...(query.isActive !== undefined ? { isActive: query.isActive === 'true' } : {}),
    ...(query.search ? { name: { contains: String(query.search), mode: 'insensitive' } } : {}) };
  const [rows, total] = await Promise.all([
    prisma.workflow.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.workflow.count({ where }),
  ]);
  const runs = await prisma.workflowExecutionRun.groupBy({ by: ['workflowId', 'status'],
    where: { tenantId, workflowId: { in: rows.map(row => row.id) } }, _max: { startedAt: true }, _count: { _all: true } });
  return { rows: rows.map(row => {
    const history = runs.filter(run => run.workflowId === row.id);
    return { ...row, lastRunAt: history.reduce<Date | null>((latest, run) => !latest || (run._max.startedAt && run._max.startedAt > latest) ? run._max.startedAt : latest, null),
      totalRuns: history.reduce((sum, run) => sum + run._count._all, 0),
      successfulRuns: history.find(run => run.status === 'completed')?._count._all ?? 0,
      failedRuns: history.find(run => run.status === 'failed')?._count._all ?? 0 };
  }), total, page, limit };
}
function workflowData(draft: Partial<WorkflowDraft>): Prisma.WorkflowUncheckedUpdateInput {
  return { ...draft, conditions: draft.conditions === null ? Prisma.DbNull : draft.conditions,
    actions: draft.actions as Prisma.InputJsonValue | undefined };
}
export function createWorkflow(tenantId: string, draft: WorkflowDraft, activatedById?: string) {
  return prisma.workflow.create({ data: { ...draft, tenantId, status: draft.isActive ? 'ACTIVE' : 'DRAFT', activatedById,
    conditions: draft.conditions == null ? Prisma.DbNull : draft.conditions,
    actions: draft.actions as Prisma.InputJsonValue } });
}
export function updateWorkflow(id: string, tenantId: string, draft: Partial<WorkflowDraft> & { isArchived?: boolean; status?: string; activatedById?: string }) {
  return prisma.workflow.update({ where: { id, tenantId }, data: workflowData(draft) });
}
export function activeWorkflows(tenantId: string, trigger: string) {
  return prisma.workflow.findMany({ where: { tenantId, trigger, isActive: true, isArchived: false } });
}
export async function startRun(params: { tenantId: string; workflowId: string; triggerType: string; entityType: string; entityId: string; eventId: string; recordName: string }) {
  try { return await prisma.$transaction(async tx => {
    const trigger = await tx.workflowTriggerRecord.create({ data: { tenantId: params.tenantId, workflowId: params.workflowId, triggerType: params.triggerType, entityType: params.entityType, entityId: params.entityId, eventId: params.eventId, payload: { recordName: params.recordName } } });
    return tx.workflowExecutionRun.create({ data: { tenantId: params.tenantId, workflowId: params.workflowId,
      triggerId: trigger.id, entityType: params.entityType, entityId: params.entityId } });
  }); } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
    throw error;
  }
}
export function updateExecutionRun(id: string, tenantId: string, data: { status: string; completedAt?: Date; errorMessage?: string }) {
  return prisma.workflowExecutionRun.update({ where: { id, tenantId }, data });
}
export function createExecutionStep(data: { tenantId: string; executionId: string; stepIndex: number; actionType: string; status: string; output?: object; error?: string }) {
  return prisma.workflowExecutionStep.create({ data });
}
export function listExecutions(workflowId: string, tenantId: string, page = 1) {
  return prisma.workflowExecutionRun.findMany({ where: { workflowId, tenantId }, orderBy: { startedAt: 'desc' },
    skip: (page - 1) * 25, take: 25,
    include: { steps: { orderBy: { stepIndex: 'asc' } }, trigger: { select: { triggerType: true, entityType: true, triggeredAt: true, payload: true } } } });
}
export async function entityContext(entity: WorkflowEntity, id: string, tenantId: string): Promise<Record<string, unknown> | null> {
  const record = entity === 'lead' ? await prisma.lead.findFirst({ where: { id, tenantId, isArchived: false } })
    : entity === 'contact' ? await prisma.contact.findFirst({ where: { id, tenantId, isArchived: false } })
    : await prisma.deal.findFirst({ where: { id, tenantId, isArchived: false } });
  if (!record) return null;
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value instanceof Date || value === null || ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => [`${entity}.${key}`, value instanceof Date ? value.toISOString() : value]));
}
export function findActor(id: string, tenantId: string) {
  return prisma.user.findFirst({ where: { id, tenantId, status: 'ACTIVE' }, select: { id: true } });
}
export function recordRunActivity(tenantId: string, actorId: string, entity: WorkflowEntity, entityId: string, workflowId: string, runId: string, name: string, status: string) {
  return prisma.activity.create({ data: { tenantId, createdById: actorId, type: 'workflow', title: `Workflow: ${name}`,
    description: `Run ${status}.`, metadata: { workflowId, runId, status },
    ...(entity === 'lead' ? { leadId: entityId } : entity === 'contact' ? { contactId: entityId } : { dealId: entityId }) } });
}

export function finishExecutionStep(id: string, tenantId: string, data: { status: string; output?: object; error?: string }) {
  return prisma.workflowExecutionStep.update({ where: { id, tenantId }, data });
}
export function findExecution(id: string, workflowId: string, tenantId: string) {
  return prisma.workflowExecutionRun.findFirst({ where: { id, workflowId, tenantId }, include: { steps: { orderBy: { stepIndex: 'asc' } }, trigger: true } });
}
