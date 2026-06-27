import { PrismaClient } from '@prisma/client';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { getPaginationParams } from '../../../shared/helpers/pagination';

const prisma = new PrismaClient();

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
    doNotContact: query.doNotContact === 'true' ? true : undefined,
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
    prisma.contact.findMany({
      where, skip, take: limit,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      include: {
        organization: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findContactById(id: string, tenantId: string) {
  return prisma.contact.findFirst({
    where: { id, tenantId },
    include: {
      organization: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      owner:        { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function createContact(tenantId: string, dto: CreateContactDto) {
  const score = STATUS_SCORES[dto.status ?? 'WARM'] ?? 75;

  return prisma.contact.create({
    data: {
      ...dto,
      tenantId,
      score,
      // ownerId is set to the creating user's ID — done in service layer
    },
  });
}

export async function updateContact(id: string, tenantId: string, dto: UpdateContactDto) {
  const existing = await prisma.contact.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  // Auto-update score when status changes
  const score = dto.status ? STATUS_SCORES[dto.status] : undefined;

  return prisma.contact.update({
    where: { id },
    data: { ...dto, ...(score !== undefined ? { score } : {}) },
  });
}

export async function archiveContact(id: string, tenantId: string) {
  const existing = await prisma.contact.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.contact.update({
    where: { id },
    data: { isArchived: true },
  });
}
