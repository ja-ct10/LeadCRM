import { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';
import * as repo from './deals.repository';
import { writeAuditLog, buildChangeset } from '../../../core/audit/audit.service';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/http-error';
import { enforcePlanLimit } from '../../../config/database.config';
import { CreateDealDto, UpdateDealDto, MoveDealStageDto, DealsQueryParams } from './deals.dto';
import { paginate } from '../../../shared/helpers/pagination';
import { fireDealCreated, fireDealStageChanged } from '../../automation/triggers/triggers.service';

/**
 * Maps known Prisma constraint/infrastructure errors to appropriate HTTP errors.
 * - P2002 (unique constraint) → ConflictError (409)
 * - P2003 (foreign key constraint) → ValidationError (400)
 * - Connection/infrastructure errors → logged server-side, then re-thrown for global handler (500)
 */
function mapRepositoryError(error: unknown, context: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[])?.join(', ') || 'field';
      throw new ConflictError(`A deal with the same ${target} already exists`);
    }
    if (error.code === 'P2003') {
      const field = (error.meta?.field_name as string) || 'reference';
      throw new ValidationError(`Invalid ${field}: referenced record does not exist`);
    }
  }

  // Infrastructure/connection errors — log server-side with context, then propagate to global handler
  console.error(`[DealsService] Infrastructure error in ${context}:`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  throw error;
}

export async function getDeals(tenantId: string, query: DealsQueryParams) {
  const result = await repo.findAllDeals(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getDealsGroupedByStage(tenantId: string, pipelineId: string, stagePageMap?: Record<string, number>) {
  return repo.findDealsGroupedByStage(tenantId, pipelineId, stagePageMap);
}

export async function getDealById(id: string, tenantId: string) {
  const deal = await repo.findDealById(id, tenantId);
  if (!deal) throw new NotFoundError('Deal');
  return deal;
}

export async function createDeal(tenantId: string, userId: string, dto: CreateDealDto) {
  await enforcePlanLimit(tenantId, 'deals');

  let deal;
  try {
    deal = await repo.createDeal(tenantId, userId, dto);
  } catch (error) {
    mapRepositoryError(error, 'createDeal');
  }

  await writeAuditLog({
    tenantId, userId,
    action: 'deal.created', entityType: 'Deal', entityId: deal.id,
    after: { title: dto.title, pipelineId: dto.pipelineId, stageId: dto.stageId, value: dto.value },
  });

  // Fire workflow trigger (non-blocking — never fails the request)
  fireDealCreated({ tenantId, deal }).catch(() => {});

  return deal;
}

export async function updateDeal(id: string, tenantId: string, userId: string, dto: UpdateDealDto) {
  const before = await repo.findDealById(id, tenantId);
  if (!before) throw new NotFoundError('Deal');

  let deal;
  try {
    deal = await repo.updateDeal(id, tenantId, dto);
  } catch (error) {
    mapRepositoryError(error, 'updateDeal');
  }
  if (!deal) throw new NotFoundError('Deal');

  // After deal update succeeds, sync contact associations if provided
  if (dto.contactIds) {
    await repo.syncContactAssociations(id, tenantId, dto.contactIds, userId);
  }

  const { before: changedBefore, after: changedAfter } = buildChangeset(
    before as unknown as Record<string, unknown>,
    deal  as unknown as Record<string, unknown>,
  );

  await writeAuditLog({
    tenantId, userId,
    action: 'deal.updated', entityType: 'Deal', entityId: id,
    before: changedBefore, after: changedAfter,
  });

  return deal;
}

export async function moveDealStage(id: string, tenantId: string, userId: string, dto: MoveDealStageDto) {
  // SEC-1 fix: Resolve stage within the tenant boundary via pipeline
  const newStage = await prisma.stage.findFirst({
    where: { id: dto.stageId, tenantId },
  });
  if (!newStage) throw new NotFoundError('Stage');

  if (newStage.isLost && !dto.lostReason) {
    throw new ValidationError('Lost reason is required when closing a deal as lost');
  }

  // BW-5 / REQ089: Enforce stage entry requirements before allowing transition
  if (newStage.requiredFields && newStage.requiredFields.length > 0) {
    const deal = await prisma.deal.findFirst({ where: { id, tenantId } });
    if (!deal) throw new NotFoundError('Deal');

    const missingFields: string[] = [];
    for (const field of newStage.requiredFields) {
      const value = (deal as Record<string, unknown>)[field];
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        missingFields.push(field);
      }
    }
    if (missingFields.length > 0) {
      throw new ValidationError(
        `Cannot advance to "${newStage.name}": missing required fields — ${missingFields.join(', ')}`
      );
    }
  }

  const result = await repo.moveDealStage(id, tenantId, dto.stageId, userId, dto.note, dto.handoff);
  if (!result) throw new NotFoundError('Deal');

  if (dto.lostReason) {
    await prisma.deal.update({ where: { id }, data: { lostReason: dto.lostReason } });
  }

  await writeAuditLog({
    tenantId, userId,
    action: 'deal.stage_changed', entityType: 'Deal', entityId: id,
    after: { newStageId: dto.stageId, isWon: newStage.isWon, isLost: newStage.isLost, note: dto.note, lostReason: dto.lostReason },
  });

  // Fire workflow trigger (non-blocking)
  fireDealStageChanged({
    tenantId,
    deal: result.deal,
    newStageId:   newStage.id,
    newStageName: newStage.name,
    isWon:        newStage.isWon,
    isLost:       newStage.isLost,
    prevStageId:  result.stageHistory.previousStageId ?? undefined,
  }).catch(() => {});

  return result;
}

export async function archiveDeal(id: string, tenantId: string, userId: string, archiveReason?: string) {
  let deal;
  try {
    deal = await repo.archiveDeal(id, tenantId, archiveReason);
  } catch (error) {
    mapRepositoryError(error, 'archiveDeal');
  }
  if (!deal) throw new NotFoundError('Deal');

  await writeAuditLog({
    tenantId, userId,
    action: 'deal.archived', entityType: 'Deal', entityId: id,
    after: { isArchived: true, archiveReason },
  });

  return deal;
}

export async function restoreDeal(id: string, tenantId: string, userId: string) {
  const deal = await repo.findDealById(id, tenantId);
  if (!deal) throw new NotFoundError('Deal');
  if (!deal.isArchived) throw new ValidationError('Deal is not archived');

  const restored = await prisma.deal.update({
    where: { id },
    data: { isArchived: false, archiveReason: null },
  });

  await writeAuditLog({
    tenantId, userId,
    action: 'deal.restored', entityType: 'Deal', entityId: id,
    before: { isArchived: true, archiveReason: deal.archiveReason },
    after: { isArchived: false, archiveReason: null },
  });

  return restored;
}

export async function duplicateDeal(id: string, tenantId: string, userId: string) {
  await enforcePlanLimit(tenantId, 'deals');

  const source = await repo.findDealById(id, tenantId);
  if (!source) throw new NotFoundError('Deal');

  // Destructure to exclude fields that shouldn't be copied
  const {
    id: _id, createdAt: _c, updatedAt: _u, closedAt: _cl, lostReason: _lr,
    isArchived: _a, deletedAt: _d,
    // Exclude relation fields that Prisma won't accept in create
    stage: _stage, pipeline: _pipeline, organization: _org, assignedUser: _au,
    owner: _owner, leadDeals: _ld, stageHistories: _sh,
    ...copyData
  } = source as Record<string, unknown>;

  const newDeal = await prisma.deal.create({
    data: {
      ...copyData,
      title: `${source.title} (Copy)`,
      tenantId,
      ownerId: userId,
      isArchived: false,
      closedAt: null,
      lostReason: null,
    } as never,
  });

  // Copy contact associations from source deal
  const associations = await prisma.leadDeal.findMany({ where: { dealId: id, tenantId } });
  if (associations.length > 0) {
    await prisma.leadDeal.createMany({
      data: associations.map(a => ({ leadId: a.leadId, dealId: newDeal.id, tenantId, addedById: userId })),
      skipDuplicates: true,
    });
  }

  await writeAuditLog({
    tenantId, userId,
    action: 'deal.duplicated', entityType: 'Deal', entityId: newDeal.id,
    after: { sourceId: id, title: newDeal.title },
  });

  return newDeal;
}
