import type { DealStaleness } from '@leadcrm/shared';

const DAY_MS = 86_400_000;

export const staleDealCutoff = (thresholdDays: number, now: Date): Date =>
  new Date(now.getTime() - thresholdDays * DAY_MS);

/** Only stage entry (or creation for legacy records) starts the elapsed timer. */
export function dealStaleness(deal: {
  stageChangedAt: Date | null;
  createdAt: Date;
  isArchived: boolean;
  deletedAt: Date | null;
  stage: { id: string; name: string; rottenAfterDays: number | null; isWon: boolean; isLost: boolean };
  pipeline: { isArchived: boolean };
}, now: Date): DealStaleness {
  const { stage } = deal;
  const enteredAt = deal.stageChangedAt ?? deal.createdAt;
  return {
    stageId: stage.id,
    stageName: stage.name,
    thresholdDays: stage.rottenAfterDays,
    daysInStage: Math.max(0, Math.floor((now.getTime() - enteredAt.getTime()) / DAY_MS)),
    isStale: !deal.isArchived && !deal.deletedAt && !deal.pipeline.isArchived && !stage.isWon && !stage.isLost &&
      stage.rottenAfterDays !== null && enteredAt <= staleDealCutoff(stage.rottenAfterDays, now),
  };
}
