import prisma from '../../config/database.config';

export interface AuditParams {
  tenantId:   string;
  userId:     string;
  action:     string;           // e.g. 'contact.created', 'deal.stage_changed'
  entityType: string;           // e.g. 'Contact', 'Deal'
  entityId?:  string;
  before?:    Record<string, unknown>;   // state before the change
  after?:     Record<string, unknown>;   // state after the change
  metadata?:  Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  severity?:  'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * Write a single audit log entry.
 * Fire-and-forget — does NOT throw if the write fails
 * (audit failure must never block the primary operation).
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  const changeset =
    params.before || params.after
      ? { before: params.before ?? null, after: params.after ?? null }
      : undefined;

  try {
    await prisma.auditLog.create({
      data: {
        tenantId:   params.tenantId,
        userId:     params.userId,
        action:     params.action,
        entityType: params.entityType,
        entityId:   params.entityId,
        changeset:  changeset ? (changeset as object) : undefined,
        metadata:   params.metadata ? (params.metadata as object) : undefined,
        ipAddress:  params.ipAddress,
        userAgent:  params.userAgent,
        sessionId:  params.sessionId,
        severity:   params.severity ?? 'INFO',
      },
    });
  } catch (err) {
    // Log internally but never surface to caller
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
}

/**
 * Convenience wrapper — builds changeset from old/new objects automatically.
 * Only includes fields that actually changed.
 */
export function buildChangeset(
  before: Record<string, unknown>,
  after:  Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter:  Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key]  = after[key];
    }
  }

  return { before: changedBefore, after: changedAfter };
}
