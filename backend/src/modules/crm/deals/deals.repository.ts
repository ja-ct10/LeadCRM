import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import { CreateDealDto, UpdateDealDto } from './deals.dto';

// All queries are scoped to tenantId — cross-tenant access is impossible by design

export async function findAllDeals(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    ...(query.stageId      ? { stageId:      String(query.stageId) }      : {}),
    ...(query.pipelineId   ? { pipelineId:   String(query.pipelineId) }   : {}),
    ...(query.assignedUserId ? { assignedUserId: String(query.assignedUserId) } : {}),
    ...(query.search ? { title: { contains: String(query.search), mode: 'insensitive' as const } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        stage:       true,
        pipeline:    true,
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        contactDeals: {
          include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.deal.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findDealById(id: string, tenantId: string) {
  return prisma.deal.findFirst({
    where: { id, tenantId },
    include: {
      stage:        { select: { id: true, name: true, isWon: true, isLost: true, color: true } },
      pipeline:     true,
      organization: true,
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      owner:        { select: { id: true, firstName: true, lastName: true, email: true } },
      contactDeals: {
        include: { contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      },
      stageHistories: {
        orderBy: { movedAt: 'desc' },
        take: 20,
        include: {
          newStage:      { select: { id: true, name: true } },
          previousStage: { select: { id: true, name: true } },
          movedBy:       { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
}

export async function createDeal(tenantId: string, ownerId: string, dto: CreateDealDto) {
  const { contactIds, ...dealData } = dto;

  const deal = await prisma.deal.create({
    data: { ...dealData, tenantId, ownerId },
  });

  if (contactIds && contactIds.length > 0) {
    await prisma.contactDeal.createMany({
      data: contactIds.map((contactId) => ({ contactId, dealId: deal.id, tenantId, addedById: ownerId })),
      skipDuplicates: true,
    });
  }

  return deal;
}

export async function updateDeal(id: string, tenantId: string, dto: UpdateDealDto) {
  const existing = await prisma.deal.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const { contactIds, ...updateData } = dto;
  return prisma.deal.update({ where: { id }, data: updateData });
}

export async function moveDealStage(
  id: string,
  tenantId: string,
  newStageId: string,
  movedById: string,
  note?: string,
) {
  const deal = await prisma.deal.findFirst({ where: { id, tenantId }, include: { stage: true } });
  if (!deal) return null;

  const newStage = await prisma.stage.findFirst({ where: { id: newStageId } });
  if (!newStage) return null;

  const now = new Date();
  const timeInPrevStage = Math.floor((now.getTime() - deal.updatedAt.getTime()) / (1000 * 60));

  const updatedDeal = await prisma.deal.update({
    where: { id },
    data: {
      stageId: newStageId,
      ...(newStage.isWon || newStage.isLost ? { closedAt: now } : {}),
    },
  });

  const stageHistory = await prisma.dealStageHistory.create({
    data: { tenantId, dealId: id, previousStageId: deal.stageId, newStageId, movedById, movedAt: now, timeInPrevStage, note },
  });

  return { deal: updatedDeal, stageHistory };
}

export async function archiveDeal(id: string, tenantId: string, archiveReason?: string) {
  const existing = await prisma.deal.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  return prisma.deal.update({ where: { id }, data: { isArchived: true, archiveReason: archiveReason ?? null } });
}
