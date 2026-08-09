import prisma from '../../../config/database.config';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { getPaginationParams } from '../../../shared/helpers/pagination';

// All queries are scoped to tenantId — cross-tenant access is impossible by design
export async function findAllContacts(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    // Lead has no isArchived — archive is expressed as status='Archived'
    ...(query.archived === 'true' ? { status: 'Archived' } : { status: { not: 'Archived' } }),
    ...(query.status         ? { status:         String(query.status) }        : {}),
    ...(query.accountId      ? { accountId:      String(query.accountId) }     : {}),
    ...(query.assignedUserId ? { assignedUserId: String(query.assignedUserId) } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName:   { contains: String(query.search), mode: 'insensitive' as const } },
            { lastName:    { contains: String(query.search), mode: 'insensitive' as const } },
            { email:       { contains: String(query.search), mode: 'insensitive' as const } },
            { companyName: { contains: String(query.search), mode: 'insensitive' as const } },
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
        account:      { select: { id: true, name: true } },
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
      account:      { select: { id: true, name: true, industry: true } },
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
    data:  dto,
  });
}

export async function archiveContact(id: string, tenantId: string, _userId: string) {
  const existing = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  // Lead has no isArchived — archive is expressed as status change
  return prisma.lead.update({
    where: { id },
    data:  { status: 'Archived' },
  });
}
