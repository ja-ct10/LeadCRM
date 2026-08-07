import prisma from '../../../config/database.config';

/** Pipeline summary — deal count and total value per stage */
export async function getPipelineSummary(tenantId: string, pipelineId?: string) {
  const pipelines = await prisma.pipeline.findMany({
    where: { tenantId, isArchived: false, ...(pipelineId ? { id: pipelineId } : {}) },
    include: {
      stages: {
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { deals: { where: { isArchived: false } } } },
        },
      },
    },
  });

  return pipelines.map((p) => ({
    pipelineId: p.id,
    name:       p.name,
    stages: p.stages.map((s) => ({
      stageId:    s.id,
      name:       s.name,
      order:      s.order,
      probability: s.probability,
      isWon:      s.isWon,
      isLost:     s.isLost,
      dealCount:  s._count.deals,
    })),
  }));
}

/** Average days to close for deals that have closedAt stamped */
export async function getDealVelocity(tenantId: string) {
  const closedDeals = await prisma.deal.findMany({
    where: { tenantId, isArchived: false, closedAt: { not: null } },
    select: { createdAt: true, closedAt: true, stage: { select: { isWon: true, isLost: true } } },
  });

  const won  = closedDeals.filter((d) => d.stage.isWon);
  const lost = closedDeals.filter((d) => d.stage.isLost);

  const avgDays = (deals: typeof closedDeals) => {
    if (deals.length === 0) return null;
    const sum = deals.reduce((acc: number, d) => {
      const ms = (d.closedAt as Date).getTime() - d.createdAt.getTime();
      return acc + ms / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(sum / deals.length);
  };

  return {
    totalClosed:      closedDeals.length,
    totalWon:         won.length,
    totalLost:        lost.length,
    avgDaysToCloseWon:  avgDays(won),
    avgDaysToCloseLost: avgDays(lost),
  };
}

/** Contact count by status */
export async function getContactStatusBreakdown(tenantId: string) {
  const groups = await prisma.contact.groupBy({
    by:    ['status'],
    where: { tenantId, isArchived: false },
    _count: { status: true },
  });
  return groups.map((g) => ({ status: g.status, count: g._count.status }));
}

/** Task completion stats */
export async function getTaskCompletion(tenantId: string) {
  const [total, completed, overdue] = await Promise.all([
    prisma.task.count({ where: { tenantId, isArchived: false } }),
    prisma.task.count({ where: { tenantId, isArchived: false, status: 'completed' } }),
    prisma.task.count({ where: { tenantId, isArchived: false, dueDate: { lt: new Date() }, status: { notIn: ['completed', 'cancelled'] } } }),
  ]);
  return { total, completed, overdue, pending: total - completed };
}

/** Campaign engagement summary */
export async function getCampaignSummary(tenantId: string) {
  const campaigns = await prisma.campaign.findMany({
    where:   { tenantId, isArchived: false },
    orderBy: { sentAt: 'desc' },
    take:    10,
    select: { id: true, name: true, type: true, status: true, sentCount: true, openedCount: true, clickedCount: true, engagement: true, sentAt: true },
  });
  return campaigns;
}
