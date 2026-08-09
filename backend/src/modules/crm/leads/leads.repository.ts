import { PrismaClient } from '@prisma/client';
import { CreateLeadDto, UpdateLeadDto } from './leads.dto';
import { getPaginationParams } from '../../../shared/helpers/pagination';

const prisma = new PrismaClient();

// Score map — kept in sync with business rules
const STATUS_SCORES: Record<string, number> = {
  HOT: 95, WARM: 75, COLD: 40, CANCELLED: 0, CLOSED: 100,
};

// All queries are scoped to tenantId — cross-tenant access is impossible by design
export async function findAllLeads(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    // isArchived: query.archived === 'true',
    doNotLead: query.doNotLead === 'true' ? true : undefined,
    ...(query.status         ? { status:         String(query.status) as never }         : {}),
    ...(query.organizationId ? { organizationId: String(query.organizationId) }          : {}),
    ...(query.assignedUserId ? { assignedUserId: String(query.assignedUserId) }          : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: String(query.search), mode: 'insensitive' as const } },
            { lastName:  { contains: String(query.search), mode: 'insensitive' as const } },
            { email:     { contains: String(query.search), mode: 'insensitive' as const } },
            { company:   { contains: String(query.search), mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where, skip, take: limit,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        account: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findLeadById(id: string, tenantId: string) {
  return prisma.lead.findFirst({
    where: { id, tenantId },
    include: {
      account: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function createLead(tenantId: string, dto: CreateLeadDto) {
  return prisma.lead.create({
    data: {
      ...dto,
      tenantId,
      // ownerId is set to the creating user's ID — done in service layer
    },
  });
}

export async function updateLead(id: string, tenantId: string, dto: UpdateLeadDto) {
  const existing = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.lead.update({
    where: { id },
    data: { ...dto },
  });
}

export async function archiveLead(id: string, tenantId: string, userId: string) {
  const existing = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.lead.delete({
    where: { id },
  });
}
