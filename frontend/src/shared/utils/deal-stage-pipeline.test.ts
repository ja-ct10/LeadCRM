import { describe, expect, it } from 'vitest';
import { dealStageValueVisibility } from './deal-stage-pipeline';
import type { Pipeline } from '@/store/types';

const pipeline: Pipeline = { id: 'pipeline', tenantId: 'tenant', name: 'Sales Pipeline', stages: [
  { id: 'a', name: 'Lead', order: 0 }, { id: 'b', name: 'Contacted', order: 1 }, { id: 'c', name: 'Qualified', order: 2 },
  { id: 'd', name: 'Closed Deal', order: 3, isWon: true }, { id: 'e', name: 'Cancelled', order: 4, isLost: true },
] };
describe('stage amount presentation', () => {
  it.each([['a', false, false], ['b', false, false], ['c', true, true], ['d', true, false], ['e', false, false]] as const)('shows amounts correctly for stage ID %s', (id, header, card) => {
    expect(dealStageValueVisibility(pipeline, id)).toEqual({ header, card });
  });
  it('fails closed for missing stages and preserves unrelated pipelines', () => {
    expect(dealStageValueVisibility(pipeline, 'missing')).toEqual({ header: false, card: false });
    expect(dealStageValueVisibility({ ...pipeline, name: 'Other Pipeline' }, 'a')).toEqual({ header: true, card: true });
  });
});
