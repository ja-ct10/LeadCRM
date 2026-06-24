import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditLogDto {
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Adds an immutable audit log entry.
 * Call this after every create, update, or delete operation.
 */
export async function addAuditLog(dto: AuditLogDto): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: dto.tenantId, // never from client input
        userId: dto.userId,
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId,
        metadata: (dto.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    // Audit log failure must NOT break the main operation — log it server-side
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
}
