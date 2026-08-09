import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto';

// All queries scoped to tenantId — cross-tenant access is impossible by design

export async function findAllCompanies(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    ...(query.assignedUserId ? { assignedUserId: String(query.assignedUserId) } : {}),
    ...(query.search
      ? {
          OR: [
            { name:     { contains: String(query.search), mode: 'insensitive' as const } },
            { industry: { contains: String(query.search), mode: 'insensitive' as const } },
            { city:     { contains: String(query.search), mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.account.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.account.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findCompanyById(id: string, tenantId: string) {
  return prisma.account.findFirst({
    where: { id, tenantId },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function createCompany(tenantId: string, dto: CreateCompanyDto) {
  return prisma.account.create({ data: { ...dto, tenantId } as never });
}

export async function updateCompany(id: string, tenantId: string, dto: UpdateCompanyDto) {
  const existing = await prisma.account.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.account.update({ where: { id }, data: dto as never });
}

export async function archiveCompany(id: string, tenantId: string, userId: string) {
  const existing = await prisma.account.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.account.update({
    where: { id },
    data: { isArchived: true, deletedAt: new Date(), deletedBy: userId },
  });
}
