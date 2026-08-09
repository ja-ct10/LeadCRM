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
    ...(query.stageId        ? { stageId:        String(query.stageId) }        : {}),
    ...(query.pipelineId     ? { pipelineId:     String(query.pipelineId) }     : {}),
    ...(query.assignedUserId ? { assignedUserId: String(query.assignedUserId) } : {}),
    ...(query.search ? { title: { contains: String(query.search), mode: 'insensitive' as const } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        stage:        true,
        pipeline:     true,
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        leadDeals: {
          include: { lead: { select: { id: true, firstName: true, lastName: true } } },
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
      leadDeals: {
        include: { lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
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
  const { leadIds, ...dealData } = dto as CreateDealDto & { leadIds?: string[] };

  const deal = await prisma.deal.create({
    data: { ...dealData, tenantId, ownerId } as never,
  });

  if (leadIds && leadIds.length > 0) {
    await prisma.leadDeal.createMany({
      data: leadIds.map((leadId) => ({ leadId, dealId: deal.id, tenantId, addedById: ownerId })),
      skipDuplicates: true,
    });
  }

  return deal;
}

export async function updateDeal(id: string, tenantId: string, dto: UpdateDealDto) {
  const existing = await prisma.deal.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const { leadIds: _leadIds, ...updateData } = dto as UpdateDealDto & { leadIds?: string[] };
  return prisma.deal.update({ where: { id }, data: updateData as never });
}

export async function moveDealStage(
  id: string,
  tenantId: string,
  newStageId: string,
  movedById: string,
  note?: string,
  handoff?: { assignOwnerId?: string; kickoffDate?: string; notes?: string; createServiceOrder?: boolean },
) {
  const deal = await prisma.deal.findFirst({
    where: { id, tenantId },
    include: { stage: true, organization: true, leadDeals: true },
  });
  if (!deal) return null;

  // SEC-1: stage must belong to same tenant
  const newStage = await prisma.stage.findFirst({ where: { id: newStageId, tenantId } });
  if (!newStage) return null;

  const now = new Date();

  const lastHistory = await prisma.dealStageHistory.findFirst({
    where: { dealId: id, tenantId },
    orderBy: { movedAt: 'desc' },
  });
  const referenceTime = lastHistory ? lastHistory.movedAt : deal.createdAt;
  const timeInPrevStage = Math.floor((now.getTime() - referenceTime.getTime()) / (1000 * 60));

  const result = await prisma.$transaction(async (tx) => {
    const updatedDeal = await tx.deal.update({
      where: { id },
      data: {
        stageId:    newStageId,
        pipelineId: newStage.pipelineId,
        ...(newStage.isWon || newStage.isLost ? { closedAt: now } : {}),
      },
    });

    const stageHistory = await tx.dealStageHistory.create({
      data: {
        tenantId, dealId: id,
        previousStageId: deal.stageId, newStageId, movedById,
        movedAt: now, timeInPrevStage, note,
      },
    });

    // Activity for every stage change
    await tx.activity.create({
      data: {
        tenantId, createdById: movedById,
        type:  'stage_change',
        title: `Deal moved from "${deal.stage.name}" to "${newStage.name}"`,
        dealId: deal.id,
        accountId: deal.accountId || undefined,
      },
    });

    // Post-sale handoff on Won
    if (newStage.isWon) {
      const activeProducts = deal.productInterests || [];

      if (deal.accountId) {
        const org = deal.organization!;
        const updatedProducts = Array.from(new Set([...(org.activeProducts || []), ...activeProducts]));
        await tx.account.update({
          where: { id: deal.accountId },
          data: {
            customerType:   'Active Customer',
            customerSince:  org.customerSince || now,
            activeProducts: updatedProducts,
          },
        });
      }

      if (deal.leadDeals.length > 0) {
        // Single query instead of N findUnique+update pairs
        await tx.lead.updateMany({
          where: { id: { in: deal.leadDeals.map((ld) => ld.leadId) } },
          data: { status: 'Active Customer' },
        });
      }

      if (handoff?.createServiceOrder) {
        await tx.serviceOrder.create({
          data: {
            tenantId, dealId: deal.id,
            accountId:             deal.accountId,
            assignedTechnicianId:  handoff.assignOwnerId || movedById,
            title:       `Onboarding: ${deal.title}`,
            description: handoff.notes || `Post-sale onboarding for Deal: ${deal.title}`,
            status:        'pending',
            scheduledDate: handoff.kickoffDate ? new Date(handoff.kickoffDate) : now,
          },
        });
      }
    }

    return { deal: updatedDeal, stageHistory };
  });

  return result;
}

export async function archiveDeal(id: string, tenantId: string, archiveReason?: string) {
  const existing = await prisma.deal.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.deal.update({ where: { id }, data: { isArchived: true, archiveReason: archiveReason ?? null } });
}
