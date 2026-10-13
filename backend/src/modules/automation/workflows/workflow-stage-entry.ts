import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../../config/database.config';
import { AppError } from '../../../shared/errors/app-error';
import { ValidationError, NotFoundError } from '../../../shared/errors/http-error';

export const STAGE_ENTRY_SUPERSEDED = 'WORKFLOW_STAGE_ENTRY_SUPERSEDED';
export const isStageEvent = (trigger: string): boolean => ['deal.stage_changed', 'deal.closed_won', 'deal.closed_lost'].includes(trigger);

/** Event provenance comes from a real immutable history row, never a selected stage alone. */
export async function workflowStageEvent(tenantId: string, dealId: string, trigger: string, historyId: string,
  client: Prisma.TransactionClient = prisma): Promise<{ eventId: string; context: Record<string, unknown> }> {
  if (!isStageEvent(trigger)) throw new ValidationError('A recorded stage transition requires a Deal stage or outcome trigger.');
  if (!z.string().uuid().safeParse(historyId).success) throw new ValidationError('Choose a recorded Deal stage transition.');
  const history = await client.dealStageHistory.findFirst({ where: { tenantId, dealId, id: historyId },
    include: { newStage: true, previousStage: true } });
  if (!history) throw new NotFoundError('Recorded Deal stage transition');
  if (!history.previousStageId || history.previousStageId === history.newStageId) throw new ValidationError('Choose a genuine recorded stage change, rather than Deal creation.');
  if (history.newStage.tenantId !== tenantId || history.previousStage?.tenantId !== tenantId) throw new ValidationError('Stage transition references are unavailable in this workspace.');
  if (trigger === 'deal.closed_won' && !history.newStage.isWon || trigger === 'deal.closed_lost' && !history.newStage.isLost) {
    throw new ValidationError('The recorded transition does not match this Workflow outcome trigger.');
  }
  return { eventId: `${trigger}:${history.id}`, context: {
    'event.stageHistoryId': history.id, 'event.previousStageId': history.previousStageId, 'event.newStageId': history.newStageId,
  } };
}

export async function assertCurrentStageEntry(tenantId: string, dealId: string, historyId: string,
  client: Prisma.TransactionClient = prisma): Promise<void> {
  const deal = await client.deal.findFirst({ where: { tenantId, id: dealId, isArchived: false, deletedAt: null },
    select: { stageId: true, currentStageHistoryId: true } });
  if (!deal) throw new AppError('The triggering Deal is no longer available. This stage entry was skipped.', 409, STAGE_ENTRY_SUPERSEDED);
  if (!deal.currentStageHistoryId) throw new AppError('This Deal’s current stage entry needs history verification. This execution was skipped.', 409, STAGE_ENTRY_SUPERSEDED);
  if (deal.currentStageHistoryId !== historyId) throw new AppError('This stage entry was superseded by a later Deal transition. This execution was skipped.', 409, STAGE_ENTRY_SUPERSEDED);
  const history = await client.dealStageHistory.findFirst({ where: { id: historyId, tenantId, dealId, newStageId: deal.stageId }, select: { id: true } });
  if (!history) throw new ValidationError('The current stage entry does not match this Deal’s persisted history.');
}

export function isSupersededStageEntry(error: unknown): error is AppError {
  return error instanceof AppError && error.code === STAGE_ENTRY_SUPERSEDED;
}
