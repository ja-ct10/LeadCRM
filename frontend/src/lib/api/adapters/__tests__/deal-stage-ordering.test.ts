import { expect, it } from 'vitest';
import { toFrontendDeal } from '../deal.adapter';

const createdAt = '2020-01-01T00:00:00.000Z';
const history = [
  { movedAt: '2026-10-20T02:00:00.000Z', newStage: { id: 'qualified' } },
  { movedAt: '2026-10-18T02:00:00.000Z', newStage: { id: 'qualified' } },
  { movedAt: '2026-10-19T02:00:00.000Z', newStage: { id: 'lead' } },
];

it('prefers the server movement date while preserving creation and detailed history', () => {
  const raw = { id: 'deal', createdAt, lastStageChangeDate: '2026-10-21T02:00:00.000Z', stageHistories: history };
  const before = structuredClone(raw);
  const deal = toFrontendDeal(raw);
  expect(deal.lastStageChangeDate).toBe(raw.lastStageChangeDate);
  expect(deal.createdAt).toBe(createdAt);
  expect(deal.history.map((entry: { timestamp: string }) => entry.timestamp)).toEqual(history.map(entry => entry.movedAt));
  expect(raw).toEqual(before);
});

it('uses the latest historical movement independently of history array order', () => {
  const deal = toFrontendDeal({ id: 'deal', createdAt, stageHistories: [...history].reverse() });
  expect(deal.lastStageChangeDate).toBe(history[0].movedAt);
});

it.each([undefined, []])('uses creation without history and ignores unrelated update and stage snapshot dates: %j', stageHistories => {
  const deal = toFrontendDeal({ id: 'deal', createdAt, stageHistories,
    updatedAt: '2099-01-01T00:00:00.000Z', stageChangedAt: '2099-02-01T00:00:00.000Z' });
  expect(deal.lastStageChangeDate).toBe(createdAt);
});
