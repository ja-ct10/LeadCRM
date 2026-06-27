import prisma from '../../../config/database.config';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { getPaginationParams, paginate } from '../../../shared/helpers/pagination';

export async function getWorkflows(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;
  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    ...(query.isActive !== undefined ? { isActive: query.isActive === 'true' } : {}),
    ...(query.search ? { name: { contains: String(query.search), mode: 'insensitive' as const } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.workflow.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.workflow.count({ where }),
  ]);
  return paginate(data, total, { page, limit });
}

export async function getWorkflowById(id: string, tenantId: string) {
  const workflow = await prisma.workflow.findFirst({ where: { id, tenantId } });
  if (!workflow) throw new NotFoundError('Workflow');
  return workflow;
}

export async function createWorkflow(tenantId: string, userId: string, dto: Record<string, unknown>) {
  const workflow = await prisma.workflow.create({ data: { ...dto, tenantId } as never });
  await writeAuditLog({ tenantId, userId, action: 'workflow.created', entityType: 'Workflow', entityId: workflow.id });
  return workflow;
}

export async function updateWorkflow(id: string, tenantId: string, userId: string, dto: Record<string, unknown>) {
  const existing = await prisma.workflow.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Workflow');
  const workflow = await prisma.workflow.update({ where: { id }, data: dto as never });
  await writeAuditLog({ tenantId, userId, action: 'workflow.updated', entityType: 'Workflow', entityId: id });
  return workflow;
}

export async function toggleWorkflow(id: string, tenantId: string, userId: string) {
  const existing = await prisma.workflow.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Workflow');
  const workflow = await prisma.workflow.update({ where: { id }, data: { isActive: !existing.isActive } });
  await writeAuditLog({
    tenantId, userId,
    action: workflow.isActive ? 'workflow.activated' : 'workflow.deactivated',
    entityType: 'Workflow', entityId: id,
    after: { isActive: workflow.isActive },
  });
  return workflow;
}

export async function archiveWorkflow(id: string, tenantId: string, userId: string) {
  const existing = await prisma.workflow.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Workflow');
  await prisma.workflow.update({ where: { id }, data: { isArchived: true, isActive: false } });
  await writeAuditLog({ tenantId, userId, action: 'workflow.archived', entityType: 'Workflow', entityId: id });
}

export async function getWorkflowExecutions(workflowId: string, tenantId: string) {
  return prisma.workflowExecutionRun.findMany({
    where: { workflowId, tenantId },
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: {
      steps: { orderBy: { stepIndex: 'asc' } },
      trigger: { select: { triggerType: true, entityType: true, triggeredAt: true } },
    },
  });
}
