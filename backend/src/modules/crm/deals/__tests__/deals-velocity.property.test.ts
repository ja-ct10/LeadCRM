import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based test for velocity average correctness.
 *
 * **Property 14: Velocity Average Correctness**
 * For any set of DealStageHistory records within the query window, the average time-in-stage
 * for each stage SHALL equal the arithmetic mean of `timeInPrevStage` values for records
 * with that `previousStageId`.
 *
 * **Validates: Requirements 19.1, 19.4**
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

// Mock prisma before importing the service
vi.mock('../../../../config/database.config', () => {
  return {
    default: {
      dealStageHistory: {
        findMany: vi.fn(),
      },
    },
  };
});

// Import after mocking
import prisma from '../../../../config/database.config';
import { computeVelocity } from '../velocity.service';

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

/**
 * A small set of stage IDs to simulate realistic grouping.
 */
const STAGE_IDS = ['stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5'];
const STAGE_NAMES: Record<string, string> = {
  'stage-1': 'Discovery',
  'stage-2': 'Proposal',
  'stage-3': 'Negotiation',
  'stage-4': 'Closing',
  'stage-5': 'Onboarding',
};

/**
 * Generate a single DealStageHistory record with random previousStageId and timeInPrevStage.
 */
const historyRecordArb = fc.record({
  previousStageId: fc.constantFrom(...STAGE_IDS),
  timeInPrevStage: fc.integer({ min: 1, max: 100_000 }),
}).map((rec) => ({
  previousStageId: rec.previousStageId,
  timeInPrevStage: rec.timeInPrevStage,
  previousStage: { id: rec.previousStageId, name: STAGE_NAMES[rec.previousStageId] },
}));

/**
 * Generate a non-empty array of history records (1 to 50 records).
 */
const historyArrayArb = fc.array(historyRecordArb, { minLength: 1, maxLength: 50 });

const tenantIdArb = fc.uuid();

// ─────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 14: Velocity Average Correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('avgMinutes per stage equals arithmetic mean of timeInPrevStage', () => {
    it('should compute avgMinutes as Math.round(sum / count) for each previousStageId', async () => {
      await fc.assert(
        fc.asyncProperty(tenantIdArb, historyArrayArb, async (tenantId, histories) => {
          vi.mocked(prisma.dealStageHistory.findMany).mockResolvedValue(histories as never);

          const result = await computeVelocity(tenantId);

          // Manually compute expected averages
          const expectedMap = new Map<string, { totalMinutes: number; count: number }>();
          for (const h of histories) {
            const entry = expectedMap.get(h.previousStageId) ?? { totalMinutes: 0, count: 0 };
            entry.totalMinutes += h.timeInPrevStage;
            entry.count += 1;
            expectedMap.set(h.previousStageId, entry);
          }

          // Verify each stage's avgMinutes
          for (const stage of result.stages) {
            const expected = expectedMap.get(stage.stageId);
            expect(expected).toBeDefined();
            const expectedAvg = Math.round(expected!.totalMinutes / expected!.count);
            expect(stage.avgMinutes).toBe(expectedAvg);
            expect(stage.dealCount).toBe(expected!.count);
          }

          // Verify all stages from history are represented
          expect(result.stages.length).toBe(expectedMap.size);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('avgTotalMinutes equals mean of all stage averages', () => {
    it('should compute avgTotalMinutes as Math.round(sum of avgMinutes / numStages)', async () => {
      await fc.assert(
        fc.asyncProperty(tenantIdArb, historyArrayArb, async (tenantId, histories) => {
          vi.mocked(prisma.dealStageHistory.findMany).mockResolvedValue(histories as never);

          const result = await computeVelocity(tenantId);

          // Compute expected avgTotalMinutes from the result stages
          if (result.stages.length === 0) {
            expect(result.avgTotalMinutes).toBe(0);
          } else {
            const totalMinutes = result.stages.reduce((sum, s) => sum + s.avgMinutes, 0);
            const expectedAvgTotal = Math.round(totalMinutes / result.stages.length);
            expect(result.avgTotalMinutes).toBe(expectedAvgTotal);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('stage names are correctly preserved', () => {
    it('should map stage names from the previousStage relation for each stage', async () => {
      await fc.assert(
        fc.asyncProperty(tenantIdArb, historyArrayArb, async (tenantId, histories) => {
          vi.mocked(prisma.dealStageHistory.findMany).mockResolvedValue(histories as never);

          const result = await computeVelocity(tenantId);

          for (const stage of result.stages) {
            expect(stage.name).toBe(STAGE_NAMES[stage.stageId]);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('empty history returns empty stages and zero avgTotalMinutes', () => {
    it('should return empty stages array and avgTotalMinutes of 0 when no history records exist', async () => {
      await fc.assert(
        fc.asyncProperty(tenantIdArb, async (tenantId) => {
          vi.mocked(prisma.dealStageHistory.findMany).mockResolvedValue([]);

          const result = await computeVelocity(tenantId);

          expect(result.stages).toEqual([]);
          expect(result.avgTotalMinutes).toBe(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('single stage — avgMinutes equals mean of all timeInPrevStage values', () => {
    it('should correctly average when all records belong to the same stage', async () => {
      const singleStageHistoryArb = fc.array(
        fc.integer({ min: 1, max: 100_000 }).map((time) => ({
          previousStageId: 'stage-1',
          timeInPrevStage: time,
          previousStage: { id: 'stage-1', name: 'Discovery' },
        })),
        { minLength: 1, maxLength: 50 },
      );

      await fc.assert(
        fc.asyncProperty(tenantIdArb, singleStageHistoryArb, async (tenantId, histories) => {
          vi.mocked(prisma.dealStageHistory.findMany).mockResolvedValue(histories as never);

          const result = await computeVelocity(tenantId);

          expect(result.stages.length).toBe(1);

          const totalTime = histories.reduce((sum, h) => sum + h.timeInPrevStage, 0);
          const expectedAvg = Math.round(totalTime / histories.length);

          expect(result.stages[0].avgMinutes).toBe(expectedAvg);
          expect(result.stages[0].dealCount).toBe(histories.length);
          // With single stage, avgTotalMinutes equals that stage's avgMinutes
          expect(result.avgTotalMinutes).toBe(expectedAvg);
        }),
        { numRuns: 100 },
      );
    });
  });
});
