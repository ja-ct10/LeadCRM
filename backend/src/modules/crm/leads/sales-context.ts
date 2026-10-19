import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

/** Exposes only the transaction to durable event enqueueing, never external dispatch. */
export const salesContext = new AsyncLocalStorage<Prisma.TransactionClient>();
/** Coalesce wakeups per attempt and discard them when the transaction rolls back. */
export const salesAfterCommit = new AsyncLocalStorage<Map<string, () => void>>();
