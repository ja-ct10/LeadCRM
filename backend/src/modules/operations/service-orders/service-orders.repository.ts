import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import { CreateServiceOrderDto, UpdateServiceOrderDto, CompleteServiceOrderDto } from './service-orders.dto';

export async function findAllServiceOrders(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    ...(query.status              ? { status:              String(query.status) }              : {}),
    ...(query.assignedTechnicianId ? { assignedTechnicianId: String(query.assignedTechnicianId) } : {}),
    ...(query.contactId           ? { contactId:           String(query.contactId) }           : {}),
    ...(query.search
      ? { title: { contains: String(query.search), mode: 'insensitive' as const } }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where, skip, take: limit, orderBy: { scheduledDate: 'asc' },
      include: {
        technician:   { select: { id: true, firstName: true, lastName: true } },
        contact:      { select: { id: true, firstName: true, lastName: true } },
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.serviceOrder.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findServiceOrderById(id: string, tenantId: string) {
  return prisma.serviceOrder.findFirst({
    where: { id, tenantId },
    include: {
      technician:   { select: { id: true, firstName: true, lastName: true, email: true } },
      contact:      { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      organization: { select: { id: true, name: true } },
      deal:         { select: { id: true, title: true } },
    },
  });
}

export async function createServiceOrder(tenantId: string, dto: CreateServiceOrderDto) {
  return prisma.serviceOrder.create({ data: { ...dto, tenantId } });
}

export async function updateServiceOrder(id: string, tenantId: string, dto: UpdateServiceOrderDto) {
  const existing = await prisma.serviceOrder.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.serviceOrder.update({ where: { id }, data: dto });
}

export async function completeServiceOrder(
  id: string, tenantId: string, dto: CompleteServiceOrderDto,
) {
  const existing = await prisma.serviceOrder.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.serviceOrder.update({
    where: { id },
    data: {
      status:             'completed',
      completedAt:        new Date(),
      actualDurationMins: dto.actualDurationMins,
      notes:              dto.notes,
      photos:             dto.photos as object | undefined,
      signature:          dto.signature,
    },
  });
}
