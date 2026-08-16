import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';

export async function findAllTasks(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    ...(query.status         ? { status:         String(query.status) }         : {}),
    ...(query.priority       ? { priority:       String(query.priority) }       : {}),
    ...(query.assignedUserId ? { assignedUserId: String(query.assignedUserId) } : {}),
    ...(query.dealId         ? { dealId:         String(query.dealId) }         : {}),
    ...(query.leadId         ? { leadId:         String(query.leadId) }         : {}),
    ...(query.overdue === 'true'
      ? { dueDate: { lt: new Date() }, status: { notIn: ['completed', 'cancelled'] } }
      : {}),
    ...(query.search
      ? { title: { contains: String(query.search), mode: 'insensitive' as const } }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where, skip, take: limit, orderBy: { dueDate: 'asc' },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        assignedBy:   { select: { id: true, firstName: true, lastName: true } },
        deal:         { select: { id: true, title: true } },
        lead:         { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findTaskById(id: string, tenantId: string) {
  return prisma.task.findFirst({
    where: { id, tenantId },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedBy:   { select: { id: true, firstName: true, lastName: true } },
      completedBy:  { select: { id: true, firstName: true, lastName: true } },
      deal:         { select: { id: true, title: true } },
      lead:         { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function createTask(tenantId: string, assignedById: string, dto: CreateTaskDto) {
  return prisma.task.create({
    data: { ...dto, tenantId, assignedById },
  });
}

export async function updateTask(id: string, tenantId: string, dto: UpdateTaskDto) {
  try {
    return await prisma.task.update({ where: { id, tenantId }, data: dto });
  } catch {
    return null;
  }
}

export async function completeTask(id: string, tenantId: string, completedById: string) {
  try {
    return await prisma.task.update({
      where: { id, tenantId },
      data: { status: 'completed', completedAt: new Date(), completedById },
    });
  } catch {
    return null;
  }
}

export async function archiveTask(id: string, tenantId: string) {
  try {
    return await prisma.task.update({ where: { id, tenantId }, data: { isArchived: true } });
  } catch {
    return null;
  }
}
