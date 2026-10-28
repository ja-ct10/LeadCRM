import { Prisma } from '@prisma/client';
import type { CrmStatus } from '@leadcrm/shared';

export function statusContext(value: Prisma.JsonValue | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

export function manualStatusCheckpoint(status: CrmStatus, now = new Date()): Prisma.InputJsonObject {
  return { source: 'manual', status, selectedAt: now.toISOString() };
}

export function replyStatusCheckpoint(at: Date, key: string): Prisma.InputJsonObject {
  return { source: 'reply', status: 'Warm', replyAt: at.toISOString(), replyKey: key };
}

/** Legacy manual checkpoints remain protected too; replay is never a new selection. */
export function isManualStatus(value: Prisma.JsonValue | undefined) {
  const context = statusContext(value);
  return !!context && context.source !== 'reply';
}

export function acceptsStatusReply(value: Prisma.JsonValue | undefined, at: Date, previousReply?: Date | null, manualFallback?: Date | null) {
  if (!Number.isFinite(+at) || previousReply && +at <= +previousReply) return false;
  const context = statusContext(value);
  const boundary = context?.source === 'reply' ? context.replyAt : context?.selectedAt ?? (context ? manualFallback?.toISOString() : undefined);
  return typeof boundary !== 'string' || +at > +new Date(boundary);
}
