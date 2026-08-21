import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';

/**
 * Contacts V2 Repository — queries the Contact table (formerly Customer).
 * This is separate from the leads/contacts controller which queries the Lead table.
 */

export async function findAllContacts(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    tenantId,
    ...(query.status ? { status: String(query.status) } : {}),
    ...(query.assignedUserId ? { assignedUserId: String(query.assignedUserId) } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: String(query.search), mode: 'insensitive' } },
            { lastName: { contains: String(query.search), mode: 'insensitive' } },
            { email: { contains: String(query.search), mode: 'insensitive' } },
            { companyName: { contains: String(query.search), mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.contact.findMany({
      where: where as any,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true } },
      },
    }),
    prisma.contact.count({ where: where as any }),
  ]);

  return { data, total, page, limit };
}

export async function findContactById(id: string, tenantId: string) {
  return prisma.contact.findFirst({
    where: { id, tenantId },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
      account: { select: { id: true, name: true } },
    },
  });
}

export async function createContact(tenantId: string, dto: Record<string, unknown>) {
  return prisma.contact.create({
    data: { ...dto, tenantId } as any,
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
      account: { select: { id: true, name: true } },
    },
  });
}

export async function updateContact(id: string, tenantId: string, dto: Record<string, unknown>) {
  try {
    return await prisma.contact.update({
      where: { id, tenantId } as any,
      data: dto as any,
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true } },
      },
    });
  } catch {
    return null;
  }
}

export async function archiveContact(id: string, tenantId: string) {
  try {
    return await prisma.contact.update({
      where: { id, tenantId } as any,
      data: { status: 'Archived' },
    });
  } catch {
    return null;
  }
}
