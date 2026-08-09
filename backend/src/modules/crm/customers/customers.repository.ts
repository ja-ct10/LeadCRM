import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import { CreateCustomerDto, UpdateCustomerDto } from './customers.dto';

// All queries are scoped to tenantId — cross-tenant access is impossible by design

export async function findAllCustomers(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    ...(query.status       ? { status:       String(query.status) }       : {}),
    ...(query.accountId    ? { accountId:    String(query.accountId) }    : {}),
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
    prisma.customer.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        account:      { select: { id: true, name: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findCustomerById(id: string, tenantId: string) {
  return prisma.customer.findFirst({
    where: { id, tenantId },
    include: {
      account:      { select: { id: true, name: true } },
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function createCustomer(tenantId: string, dto: CreateCustomerDto) {
  return prisma.customer.create({
    data: {
      firstName:     dto.firstName,
      lastName:      dto.lastName,
      email:         dto.email,
      phone:         dto.phone,
      companyName:   dto.company,
      address:       dto.address,
      productInterest: dto.productInterests ?? [],
      source:        dto.source,
      status:        dto.status ?? 'Active',
      accountId:     dto.organizationId, // DTO still uses organizationId for backward compat
      assignedUserId: dto.assignedUserId,
      tenantId,
    },
  });
}

export async function updateCustomer(id: string, tenantId: string, dto: UpdateCustomerDto) {
  const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.customer.update({
    where: { id },
    data: {
      ...(dto.firstName     !== undefined ? { firstName:     dto.firstName }     : {}),
      ...(dto.lastName      !== undefined ? { lastName:      dto.lastName }      : {}),
      ...(dto.email         !== undefined ? { email:         dto.email }         : {}),
      ...(dto.phone         !== undefined ? { phone:         dto.phone }         : {}),
      ...(dto.company       !== undefined ? { companyName:   dto.company }       : {}),
      ...(dto.address       !== undefined ? { address:       dto.address }       : {}),
      ...(dto.source        !== undefined ? { source:        dto.source }        : {}),
      ...(dto.status        !== undefined ? { status:        dto.status }        : {}),
      ...(dto.organizationId !== undefined ? { accountId:    dto.organizationId } : {}),
      ...(dto.assignedUserId !== undefined ? { assignedUserId: dto.assignedUserId } : {}),
      ...(dto.productInterests !== undefined ? { productInterest: dto.productInterests } : {}),
    },
  });
}

export async function archiveCustomer(id: string, tenantId: string, _userId: string) {
  const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.customer.update({
    where: { id },
    data: { status: 'Inactive' },
  });
}
