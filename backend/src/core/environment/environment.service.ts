import type { CrmEnvironment } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';

export async function changeEnvironment(userId: string, tenantId: string, environment: CrmEnvironment) {
  return prisma.$transaction(async tx => {
    const user = await tx.user.findFirst({ where: { id: userId, tenantId, status: 'ACTIVE' } });
    if (!user || user.role === 'System Admin') throw new AppError('Tenant user required.', 403);
    await tx.user.update({ where: { id: user.id, tenantId }, data: { activeEnvironment: environment } });
    if (user.activeEnvironment !== environment) await tx.auditLog.create({ data: {
      tenantId, userId, action: 'environment.changed', entityType: 'User', entityId: userId,
      category: 'auth', changeset: { before: { environment: user.activeEnvironment }, after: { environment } },
    } });
    return { environment };
  });
}
