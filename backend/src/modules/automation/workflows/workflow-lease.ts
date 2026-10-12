import type { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';
import { AppError } from '../../../shared/errors/app-error';
import { workflowLease } from './workflow-dispatch-context';

export function isWorkflowLeaseLost(error: unknown): boolean {
  return error instanceof AppError && error.code === 'WORKFLOW_LEASE_LOST';
}

/** The conditional update locks the parent until the source mutation commits. */
export async function fenceWorkflowLease(tx: Prisma.TransactionClient = prisma): Promise<void> {
  const lease = workflowLease.getStore();
  if (!lease) return; // Existing synchronous execution has no durable worker claim.
  const now = new Date();
  const owned = await tx.workflowExecutionRun.updateMany({ where: { id: lease.executionId, tenantId: lease.tenantId,
    status: 'running', leaseId: lease.leaseId, leaseUntil: { gt: now } }, data: { leaseUntil: new Date(+now + 300000) } });
  if (!owned.count) throw new AppError('Workflow dispatch claim expired. Review its outcome before replay.', 409, 'WORKFLOW_LEASE_LOST');
}

/** Step evidence and history share the same parent lock as their lease check. */
export async function workflowLeaseWrite<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (!workflowLease.getStore()) return work(prisma);
  return prisma.$transaction(async tx => { await fenceWorkflowLease(tx); return work(tx); }, { timeout: 20000 });
}
