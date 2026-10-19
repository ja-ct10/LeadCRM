import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

/** Exposes only the transaction to durable event enqueueing, never external dispatch. */
export const salesContext = new AsyncLocalStorage<Prisma.TransactionClient>();

const queuedTransactions = new WeakSet<Prisma.TransactionClient>();
let wakeWorkflowWorker: (() => void) | undefined;

export function markWorkflowQueued(tx: Prisma.TransactionClient) { queuedTransactions.add(tx); }
export function discardWorkflowWake(tx: Prisma.TransactionClient) { queuedTransactions.delete(tx); }

/** Only the transaction owner calls this after Prisma acknowledges the commit. */
export function workflowTransactionCommitted(tx: Prisma.TransactionClient) {
  if (queuedTransactions.delete(tx)) wakeWorkflowWorker?.();
}

export function registerWorkflowWake(wake: () => void) {
  wakeWorkflowWorker = wake;
  return () => { if (wakeWorkflowWorker === wake) wakeWorkflowWorker = undefined; };
}
