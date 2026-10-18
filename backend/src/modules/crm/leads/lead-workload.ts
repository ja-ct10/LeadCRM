import type { Prisma } from '@prisma/client';
import { LEAD_WORKLOAD_WEIGHTS, normalizeCrmStatus } from '@leadcrm/shared';

export async function weightedLeadScores(tx: Prisma.TransactionClient, tenantId: string, userIds: string[], excludeId?: string) {
  const rows = await tx.lead.groupBy({ by: ['assignedUserId', 'status'],
    where: { tenantId, assignedUserId: { in: userIds }, isArchived: false, deletedAt: null, convertedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    _count: { _all: true },
  });
  const scores = new Map(userIds.map(id => [id, 0]));
  for (const row of rows) if (row.assignedUserId) scores.set(row.assignedUserId,
    (scores.get(row.assignedUserId) ?? 0) + row._count._all * LEAD_WORKLOAD_WEIGHTS[normalizeCrmStatus(row.status)]);
  return scores;
}

export function lowestWorkloadRotation<T extends { id: string }>(users: T[], scores: Map<string, number>, lastId: string): T | undefined {
  if (!users.length) return;
  const minimum = Math.min(...users.map(user => scores.get(user.id) ?? 0));
  const tied = users.filter(user => (scores.get(user.id) ?? 0) === minimum).sort((a, b) => a.id.localeCompare(b.id));
  return tied.find(user => user.id > lastId) ?? tied[0];
}
