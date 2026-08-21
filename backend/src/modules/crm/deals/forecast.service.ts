import { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';

export interface ForecastResult {
  total: number;
  currency: string;
  byPipeline: Array<{ pipelineId: string; name: string; total: number }>;
}

export async function computeForecast(tenantId: string, pipelineId?: string): Promise<ForecastResult> {
  const where: Prisma.DealWhereInput = {
    tenantId,
    isArchived: false,
    stage: { isWon: false, isLost: false },
    ...(pipelineId ? { pipelineId } : {}),
  };

  const deals = await prisma.deal.findMany({
    where,
    select: {
      value: true,
      pipelineId: true,
      stage: { select: { probability: true } },
      pipeline: { select: { id: true, name: true, currency: true } },
    },
  });

  // Resolve currency from pipeline (Pipeline model holds the currency field).
  // If a specific pipelineId was provided, use that pipeline's currency.
  // Otherwise, use the currency from the first deal's pipeline, defaulting to 'PHP'.
  let currency = 'PHP';
  if (pipelineId) {
    const pipeline = await prisma.pipeline.findFirst({ where: { id: pipelineId, tenantId }, select: { currency: true } });
    currency = pipeline?.currency || 'PHP';
  } else if (deals.length > 0) {
    currency = deals[0].pipeline.currency || 'PHP';
  }

  // Compute weighted total
  let total = 0;
  const byPipelineMap = new Map<string, { name: string; total: number }>();

  for (const deal of deals) {
    const weighted = (deal.value ?? 0) * ((deal.stage?.probability ?? 0) / 100);
    total += weighted;

    const entry = byPipelineMap.get(deal.pipelineId) ?? { name: deal.pipeline.name, total: 0 };
    entry.total += weighted;
    byPipelineMap.set(deal.pipelineId, entry);
  }

  const byPipeline = Array.from(byPipelineMap.entries()).map(([pipelineId, v]) => ({
    pipelineId, name: v.name, total: v.total,
  }));

  return { total, currency, byPipeline };
}
