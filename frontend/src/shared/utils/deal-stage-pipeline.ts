import type { Deal, Pipeline } from '@/store/types';

/** An unavailable assigned pipeline must never silently fall back to another. */
export function dealStagePipeline(deal: Pick<Deal, 'pipelineId'>, pipelines: Pipeline[]): Pipeline | undefined {
  if (deal.pipelineId) return pipelines.find(pipeline => pipeline.id === deal.pipelineId && !pipeline.isArchived);
  const defaults = pipelines.filter(pipeline => !pipeline.isArchived && pipeline.name.trim().toLowerCase() === 'sales pipeline');
  return defaults.length === 1 ? defaults[0] : undefined;
}
