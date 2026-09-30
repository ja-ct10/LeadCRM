import prisma from '../../../config/database.config';
import type { CrmEnvironment } from '@leadcrm/shared';

export const findProduct = (tenantId: string, id: string) => prisma.productInterest.findFirst({ where: { tenantId, id } });

export function findWonDeals(tenantId: string, environment: CrmEnvironment, id: string, skip: number, take: number) {
  const scope = { tenantId, environment };
  const person = { firstName: true, lastName: true, tenantId: true, environment: true } as const;
  const where = { ...scope, stage: { ...scope, isWon: true }, OR: [{ productInterestId: id }, { productInterestIds: { has: id } }] };
  return Promise.all([
    prisma.deal.findMany({ where, skip, take, orderBy: [{ closedAt: 'desc' }, { id: 'asc' }], select: {
      id: true, title: true, value: true, currency: true, closedAt: true,
      lead: { select: person }, contact: { select: person },
      leadDeals: { where: scope, select: { lead: { select: person } } },
      contactDeals: { where: scope, select: { contact: { select: person } } },
      organization: { select: { name: true, tenantId: true, environment: true } },
      assignedUser: { select: { firstName: true, lastName: true, tenantId: true } },
    } }),
    prisma.deal.count({ where }),
  ]);
}
