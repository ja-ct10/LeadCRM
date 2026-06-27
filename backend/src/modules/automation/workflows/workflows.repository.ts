// Workflow repository — thin DB layer
// All business logic lives in workflows.service.ts
import prisma from '../../../config/database.config';

export async function findWorkflowById(id: string, tenantId: string) {
  return prisma.workflow.findFirst({ where: { id, tenantId } });
}

export async function recordTrigger(data: {
  tenantId: string; workflowId: string;
  triggerType: string; entityType: string; entityId: string; payload?: object;
}) {
  return prisma.workflowTriggerRecord.create({ data });
}

export async function createExecutionRun(data: {
  tenantId: string; workflowId: string; triggerId: string;
  entityType: string; entityId: string;
}) {
  return prisma.workflowExecutionRun.create({ data });
}

export async function updateExecutionRun(id: string, data: {
  status: string; completedAt?: Date; errorMessage?: string;
}) {
  return prisma.workflowExecutionRun.update({ where: { id }, data });
}

export async function createExecutionStep(data: {
  tenantId: string; executionId: string; stepIndex: number;
  actionType: string; status: string; output?: object; error?: string;
}) {
  return prisma.workflowExecutionStep.create({ data });
}
