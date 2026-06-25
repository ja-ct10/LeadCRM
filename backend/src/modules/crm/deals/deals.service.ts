import prisma from '../../../config/database.config';
import * as repo from './deals.repository';
import { writeAuditLog, buildChangeset } from '../../../core/audit/audit.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { enforcePlanLimit } from '../../../config/database.config';
import { CreateDealDto, UpdateDealDto, MoveDealStageDto } from './deals.dto';
import { paginate } from '../../../shared/helpers/pagination';

export async function getDeals(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllDeals(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getDealById(id: string, tenantId: string) {
  const deal = await repo.findDealById(id, tenantId);
  if (!deal) throw new NotFoundError('Deal');
  return deal;
}

export async function createDeal(tenantId: string, userId: string, dto: CreateDealDto) {
  await enforcePlanLimit(tenantId, 'deals');

  const deal = await repo.createDeal(tenantId, userId, dto);

  await writeAuditLog({
    tenantId, userId,
    action: 'deal.created', entityType: 'Deal', entityId: deal.id,
    after: { title: dto.title, pipelineId: dto.pipelineId, stageId: dto.stageId, value: dto.value },
  });

  return deal;
}

export async function updateDeal(id: string, tenantId: string, userId: string, dto: UpdateDealDto) {
  const before = await repo.findDealById(id, tenantId);
  if (!before) throw new NotFoundError('Deal');

  const deal = await repo.updateDeal(id, tenantId, dto);
  if (!deal) throw new NotFoundError('Deal');

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
  const newStage = await prisma.stage.findFirst({ where: { id: dto.stageId } });
  if (!newStage) throw new NotFoundError('Stage');

  if (newStage.isLost && !dto.lostReason) {
    throw new ValidationError('Lost reason is required when closing a deal as lost');
  }

  const result = await repo.moveDealStage(id, tenantId, dto.stageId, userId, dto.note);
  if (!result) throw new NotFoundError('Deal');

  if (dto.lostReason) {
    await prisma.deal.update({ where: { id }, data: { lostReason: dto.lostReason } });
  }

  await writeAuditLog({
    tenantId, userId,
    action: 'deal.stage_changed', entityType: 'Deal', entityId: id,
    after: { newStageId: dto.stageId, isWon: newStage.isWon, isLost: newStage.isLost, note: dto.note, lostReason: dto.lostReason },
  });

  return result;
}

export async function archiveDeal(id: string, tenantId: string, userId: string, archiveReason?: string) {
  const deal = await repo.archiveDeal(id, tenantId, archiveReason);
  if (!deal) throw new NotFoundError('Deal');

  await writeAuditLog({
    tenantId, userId,
    action: 'deal.archived', entityType: 'Deal', entityId: id,
    after: { isArchived: true, archiveReason },
  });

  return deal;
}
