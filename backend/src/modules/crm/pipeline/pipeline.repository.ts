import prisma from '../../../config/database.config';
import { CreatePipelineDto, UpdatePipelineDto, CreateStageDto, UpdateStageDto } from './pipeline.dto';

export async function findAllPipelines(tenantId: string) {
  return prisma.pipeline.findMany({
    where: { tenantId, isArchived: false },
    orderBy: { createdAt: 'asc' },
    include: {
      stages: {
        orderBy: { order: 'asc' },
        include: { _count: { select: { deals: { where: { isArchived: false } } } } },
      },
    },
  });
}

export async function findPipelineById(id: string, tenantId: string) {
  return prisma.pipeline.findFirst({
    where: { id, tenantId, isArchived: false },
    include: {
      stages: {
        orderBy: { order: 'asc' },
        include: { _count: { select: { deals: { where: { isArchived: false } } } } },
      },
    },
  });
}

export async function createPipeline(tenantId: string, dto: CreatePipelineDto) {
  return prisma.pipeline.create({ data: { ...dto, tenantId } });
}

export async function updatePipeline(id: string, tenantId: string, dto: UpdatePipelineDto) {
  const existing = await prisma.pipeline.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.pipeline.update({ where: { id }, data: dto });
}

export async function deletePipeline(id: string, tenantId: string) {
  const existing = await prisma.pipeline.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const activeDeals = await prisma.deal.count({ where: { pipelineId: id, tenantId, isArchived: false } });
  if (activeDeals > 0) return { hasActiveDeals: true as const };

  await prisma.pipeline.update({ where: { id }, data: { isArchived: true } });
  return { deleted: true as const };
}

export async function createStage(tenantId: string, dto: CreateStageDto) {
  const pipeline = await prisma.pipeline.findFirst({ where: { id: dto.pipelineId, tenantId } });
  if (!pipeline) return null;
  return prisma.stage.create({ data: dto });
}

export async function updateStage(id: string, tenantId: string, dto: UpdateStageDto) {
  const stage = await prisma.stage.findFirst({ where: { id }, include: { pipeline: true } });
  if (!stage || stage.pipeline.tenantId !== tenantId) return null;
  return prisma.stage.update({ where: { id }, data: dto });
}

export async function deleteStage(id: string, tenantId: string) {
  const stage = await prisma.stage.findFirst({ where: { id }, include: { pipeline: true } });
  if (!stage || stage.pipeline.tenantId !== tenantId) return null;

  const activeDeals = await prisma.deal.count({ where: { stageId: id, tenantId, isArchived: false } });
  if (activeDeals > 0) return { hasActiveDeals: true as const };

  await prisma.stage.delete({ where: { id } });
  return { deleted: true as const };
}

export async function reorderStages(pipelineId: string, tenantId: string, stageIds: string[]) {
  const pipeline = await prisma.pipeline.findFirst({ where: { id: pipelineId, tenantId } });
  if (!pipeline) return null;

  await prisma.$transaction(
    stageIds.map((stageId, index) =>
      prisma.stage.update({ where: { id: stageId }, data: { order: index + 1 } }),
    ),
  );

  return findPipelineById(pipelineId, tenantId);
}
