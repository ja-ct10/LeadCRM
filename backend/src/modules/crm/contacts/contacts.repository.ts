import prisma from '../../../config/database.config';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { getPaginationParams } from '../../../shared/helpers/pagination';

// Score map — kept in sync with business rules
const STATUS_SCORES: Record<string, number> = {
  HOT: 95, WARM: 75, COLD: 40, CANCELLED: 0, CLOSED: 100,
};

// All queries are scoped to tenantId — cross-tenant access is impossible by design
export async function findAllContacts(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    ...(query.status         ? { status:    String(query.status) as never }       : {}),
    ...(query.accountId      ? { accountId: String(query.accountId) }             : {}),
    ...(query.assignedUserId ? { assignedUserId: String(query.assignedUserId) }   : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: String(query.search), mode: 'insensitive' as const } },
            { lastName:  { contains: String(query.search), mode: 'insensitive' as const } },
            { email:     { contains: String(query.search), mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findContactById(id: string, tenantId: string) {
  return prisma.lead.findFirst({
    where: { id, tenantId },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function createContact(tenantId: string, dto: CreateContactDto) {
  return prisma.lead.create({
    data: { ...dto, tenantId },
  });
}

export async function updateContact(id: string, tenantId: string, dto: UpdateContactDto) {
  const existing = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.lead.update({
    where: { id },
    data: dto as never,
  });
}

export async function archiveContact(id: string, tenantId: string, _userId: string) {
  const existing = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.lead.update({
    where: { id },
    data: { status: 'Archived' } as never,
  });
}
