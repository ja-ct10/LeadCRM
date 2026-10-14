import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
import { tenantContext } from '../../core/tenant/tenant-context';

// Kept separate from tenantContext: that context is spread into Prisma where clauses.
export const notificationActor = new AsyncLocalStorage<string>();
export async function setNotificationActor(tx: Prisma.TransactionClient, actorId = notificationActor.getStore()) {
  // Only this constant transaction-local setting bypasses the ORM raw-query guard.
  // Record writes still run in the authenticated tenant context.
  if (actorId) await tenantContext.exit(async () => await tx.$queryRaw`SELECT set_config('leadcrm.actor_id', ${actorId}, true)`);
}

/** Transaction-local reason is visible to the existing assignment outbox trigger. */
export async function withAssignmentReason<T>(tx: Prisma.TransactionClient, reason: 'user_deactivation' | 'record_creation', work: () => Promise<T>): Promise<T> {
  const [previous] = await tenantContext.exit(async () => await tx.$queryRaw<Array<{ reason: string | null }>>`SELECT current_setting('leadcrm.assignment_reason', true) AS reason`);
  await tenantContext.exit(async () => await tx.$queryRaw`SELECT set_config('leadcrm.assignment_reason', ${reason}, true)`);
  const restore = () => tenantContext.exit(async () => await tx.$queryRaw`SELECT set_config('leadcrm.assignment_reason', ${previous?.reason ?? ''}, true)`);
  let result: T;
  try { result = await work(); }
  catch (error) {
    // An aborted SQL transaction restores its settings on rollback and cannot
    // execute another statement. Preserve the original assignment failure.
    await restore().catch(() => undefined);
    throw error;
  }
  await restore();
  return result;
}
