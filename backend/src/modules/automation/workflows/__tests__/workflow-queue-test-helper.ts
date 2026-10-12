import prisma from '../../../../config/database.config';
import { dispatchQueuedWorkflows } from '../workflow-queue';

/** Exercise committed work through the real consumer; never replay terminal runs. */
export async function flushWorkflowQueue(tenantId: string) {
  for (let tick = 0; tick < 20; tick++) {
    await dispatchQueuedWorkflows();
    if (!await prisma.workflowExecutionRun.count({ where: { tenantId, status: 'queued' } })) return;
  }
  throw new Error('Workflow fixture queue did not drain within its bounded ticks.');
}
