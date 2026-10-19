import type { Deal, Pipeline } from '@/store/types';

/** An unavailable assigned pipeline must never silently fall back to another. */
export function dealStagePipeline(deal: Pick<Deal, 'pipelineId'>, pipelines: Pipeline[]): Pipeline | undefined {
  if (deal.pipelineId) return pipelines.find(pipeline => pipeline.id === deal.pipelineId && !pipeline.isArchived);
  const defaults = pipelines.filter(pipeline => !pipeline.isArchived && pipeline.name.trim().toLowerCase() === 'sales pipeline');
  return defaults.length === 1 ? defaults[0] : undefined;
}

/** Visibility is a property of the actual stage configuration, never engagement. */
export function dealStageValueVisibility(pipeline: Pipeline, stageId: string) {
  const stage = pipeline.stages.find(stage => stage.id === stageId);
  if (!stage) return { header: false, card: false };
  if (pipeline.name.trim().toLowerCase() !== 'sales pipeline') return { header: true, card: true };
  const qualified = !stage.isWon && !stage.isLost && stage.name.trim().toLowerCase() === 'qualified';
  return { header: qualified || !!stage.isWon, card: qualified };
}
