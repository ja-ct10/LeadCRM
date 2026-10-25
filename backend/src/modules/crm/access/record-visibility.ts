import type { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { AppError } from '../../../shared/errors/app-error';
import { archiveReadWhere, type ArchiveEntity } from '../../administration/archived-data/archive-access';
import { crmActor, resolveCrmActor } from './crm-record-access.service';

/** Additional data boundaries, using the existing trusted actor and role resolver. */
export async function visibilityActor(tenantId: string, db: Prisma.TransactionClient = prisma) {
  if (tenantContext.getStore()?.tenantId !== tenantId) throw new AppError('Workspace context required.', 403);
  const actor = crmActor.getStore();
  if (!actor) return undefined; // Autonomous callers retain their explicit tenant/business policies.
  if (actor.tenantId !== tenantId) throw new AppError('Access denied.', 403);
  return resolveCrmActor(db, actor);
}
export async function creatorWhere(tenantId: string, db: Prisma.TransactionClient = prisma, type: ArchiveEntity = 'Campaign'): Promise<{ tenantId: string; createdById?: string } & Record<string, any>> {
  const actor = await visibilityActor(tenantId, db);
  return { tenantId, ...(actor && !actor.clientAdmin ? { createdById: actor.userId, ...await archiveReadWhere(db, type, actor) } : {}) };
}
export async function recipientWhere(tenantId: string, db: Prisma.TransactionClient = prisma) {
  const actor = await visibilityActor(tenantId, db);
  return { tenantId, ...(actor && !actor.clientAdmin ? { assignedUserId: actor.userId } : {}) };
}
export async function groupWhere(tenantId: string, db: Prisma.TransactionClient = prisma) {
  const actor = await visibilityActor(tenantId, db);
  return { tenantId, ...(actor && !actor.clientAdmin ? { members: { some: { tenantId, userId: actor.userId } } } : {}) };
}
