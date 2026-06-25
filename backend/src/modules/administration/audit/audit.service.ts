import prisma from '../../../config/database.config';
import { getPaginationParams, paginate } from '../../../shared/helpers/pagination';

export async function getAuditLogs(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    ...(query.entityType ? { entityType: String(query.entityType) } : {}),
    ...(query.entityId   ? { entityId:   String(query.entityId) }   : {}),
    ...(query.userId     ? { userId:     String(query.userId) }     : {}),
    ...(query.action     ? { action:     { contains: String(query.action), mode: 'insensitive' as const } } : {}),
    ...(query.severity   ? { severity:   String(query.severity) }   : {}),
    ...(query.from || query.to ? {
      createdAt: {
        ...(query.from ? { gte: new Date(String(query.from)) } : {}),
        ...(query.to   ? { lte: new Date(String(query.to)) }   : {}),
      },
    } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return paginate(data, total, { page, limit });
}
