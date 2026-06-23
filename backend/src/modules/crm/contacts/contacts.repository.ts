import { PrismaClient } from '@prisma/client';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { getPaginationParams } from '../../../shared/helpers/pagination';

const prisma = new PrismaClient();

// All queries are scoped to tenantId — cross-tenant access is impossible by design
export async function findAllContacts(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    ...(query.status ? { status: String(query.status) as never } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: String(query.search), mode: 'insensitive' as const } },
            { lastName: { contains: String(query.search), mode: 'insensitive' as const } },
            { email: { contains: String(query.search), mode: 'insensitive' as const } },
            { company: { contains: String(query.search), mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.contact.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.contact.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findContactById(id: string, tenantId: string) {
  return prisma.contact.findFirst({ where: { id, tenantId } });
}

export async function createContact(tenantId: string, dto: CreateContactDto) {
  return prisma.contact.create({
    data: { ...dto, tenantId }, // tenantId injected server-side — never from client
  });
}

export async function updateContact(id: string, tenantId: string, dto: UpdateContactDto) {
  // Verify ownership before updating — prevents cross-tenant mutation
  const existing = await prisma.contact.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.contact.update({ where: { id }, data: dto });
}

export async function archiveContact(id: string, tenantId: string) {
  const existing = await prisma.contact.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.contact.update({ where: { id }, data: { isArchived: true } });
}
