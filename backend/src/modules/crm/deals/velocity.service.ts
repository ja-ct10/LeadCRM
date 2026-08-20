import { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';

export interface VelocityStage {
  stageId: string;
  name: string;
  avgMinutes: number;
  dealCount: number;
}

export interface VelocityResult {
  stages: VelocityStage[];
  avgTotalMinutes: number;
}

export async function computeVelocity(
  tenantId: string,
  opts?: { pipelineId?: string; dateFrom?: string; dateTo?: string }
): Promise<VelocityResult> {
  const where: Prisma.DealStageHistoryWhereInput = {
    tenantId,
    timeInPrevStage: { not: null },
    ...(opts?.pipelineId ? { deal: { pipelineId: opts.pipelineId } } : {}),
    ...(opts?.dateFrom || opts?.dateTo ? {
      movedAt: {
        ...(opts?.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
        ...(opts?.dateTo   ? { lte: new Date(opts.dateTo) }   : {}),
      },
    } : {}),
  };

  const histories = await prisma.dealStageHistory.findMany({
    where,
    select: {
      previousStageId: true,
      timeInPrevStage: true,
      previousStage: { select: { id: true, name: true } },
    },
  });

  // Group by previousStageId and compute averages
  const stageMap = new Map<string, { name: string; totalMinutes: number; count: number }>();

  for (const h of histories) {
    if (!h.previousStageId || h.timeInPrevStage === null) continue;
    const entry = stageMap.get(h.previousStageId) ?? { name: h.previousStage?.name ?? '', totalMinutes: 0, count: 0 };
    entry.totalMinutes += h.timeInPrevStage;
    entry.count += 1;
    stageMap.set(h.previousStageId, entry);
  }

  const stages: VelocityStage[] = Array.from(stageMap.entries()).map(([stageId, v]) => ({
    stageId,
    name: v.name,
    avgMinutes: Math.round(v.totalMinutes / v.count),
    dealCount: v.count,
  }));

  const totalMinutes = stages.reduce((sum, s) => sum + s.avgMinutes, 0);
  const avgTotalMinutes = stages.length > 0 ? Math.round(totalMinutes / stages.length) : 0;

  return { stages, avgTotalMinutes };
}
