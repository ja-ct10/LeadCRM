import type { Prisma } from '@prisma/client';
import { ConflictError } from '../../../shared/errors/http-error';

type GroupClient = Pick<Prisma.TransactionClient, 'tenantGroup'>;

/** Provision only through bootstrap/seed paths; never infer routing from a renamed label. */
export async function ensureSalesGroup(tx: GroupClient, tenantId: string) {
  const existing = await tx.tenantGroup.findFirst({ where: { tenantId, systemKey: 'SALES' } });
  if (existing) return existing;
  const legacy = (await tx.tenantGroup.findMany({ where: { tenantId, systemKey: null } })).filter(group => group.name.trim().toLowerCase() === 'sales');
  if (legacy.length > 1) throw new ConflictError('Multiple legacy Sales groups exist. Rename the duplicate groups explicitly before provisioning the default Sales group.');
  if (legacy[0]) return tx.tenantGroup.update({ where: { id: legacy[0].id, tenantId }, data: { systemKey: 'SALES' } });
  return tx.tenantGroup.create({ data: { tenantId, name: 'Sales', systemKey: 'SALES' } });
}

/** Small transaction-aware read shared by public-form assignment, with no Workflow dependency. */
export function findSalesGroup(tx: GroupClient, tenantId: string) {
  return tx.tenantGroup.findFirst({ where: { tenantId, systemKey: 'SALES' },
    select: { id: true, members: { where: { tenantId }, select: { userId: true } } } });
}
