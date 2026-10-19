import { describe, expect, it } from 'vitest';
import { dealStaleness } from '../deal-staleness';

const now = new Date('2026-10-19T04:23:45.678Z');
const day = 86_400_000;
const base = {
  createdAt: new Date(+now - 100 * day), stageChangedAt: new Date(+now - 14 * day),
  isArchived: false, deletedAt: null,
  stage: { id: 'qualified', name: 'Qualified', rottenAfterDays: 14, isWon: false, isLost: false },
  pipeline: { isArchived: false },
};

describe('elapsed stage staleness', () => {
  it.each([3, 7, 10, 14, 23])('uses the configured %i day threshold, inclusive to the millisecond', threshold => {
    const deal = { ...base, stage: { ...base.stage, rottenAfterDays: threshold } };
    const boundary = +now - threshold * day;
    expect(dealStaleness({ ...deal, stageChangedAt: new Date(boundary + 1) }, now).isStale).toBe(false);
    expect(dealStaleness({ ...deal, stageChangedAt: new Date(boundary) }, now)).toMatchObject({ isStale: true, daysInStage: threshold });
    expect(dealStaleness({ ...deal, stageChangedAt: new Date(boundary - day) }, now)).toMatchObject({ isStale: true, daysInStage: threshold + 1 });
  });
  it('falls back only to createdAt when stageChangedAt is absent', () => {
    const deal = { ...base, stageChangedAt: null, createdAt: new Date(+now - 14 * day), updatedAt: now };
    expect(dealStaleness(deal, now).isStale).toBe(true);
    expect(dealStaleness({ ...deal, stageChangedAt: now }, now).isStale).toBe(false);
  });
  it('disables null thresholds and excludes both terminal flags, archived/deleted Deals and archived pipelines', () => {
    for (const deal of [
      { ...base, stage: { ...base.stage, rottenAfterDays: null } },
      { ...base, stage: { ...base.stage, isWon: true } },
      { ...base, stage: { ...base.stage, isLost: true } },
      { ...base, isArchived: true }, { ...base, deletedAt: now },
      { ...base, pipeline: { isArchived: true } },
    ]) expect(dealStaleness(deal, now).isStale).toBe(false);
  });
  it('does not mutate stage, value or customer status when evaluating a stale Deal', () => {
    const deal = { ...base, value: 1500, lead: { status: 'Hot' }, contact: { status: 'COLD' } };
    const before = structuredClone(deal);
    expect(dealStaleness(deal, now).isStale).toBe(true);
    expect(deal).toEqual(before);
  });
});
