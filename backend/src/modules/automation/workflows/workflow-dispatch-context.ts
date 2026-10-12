import { AsyncLocalStorage } from 'node:async_hooks';
export const workflowChain = new AsyncLocalStorage<ReadonlySet<string>>();
export const workflowLease = new AsyncLocalStorage<{ tenantId: string; executionId: string; leaseId: string }>();
