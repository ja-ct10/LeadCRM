import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based test for forecast computation correctness.
 *
 * **Property 9: Forecast Computation Correctness**
 * For any set of non-archived, non-won, non-lost deals in a tenant, the forecast total
 * SHALL equal the sum of `deal.value × stage.probability / 100` for each deal in the set.
 * Deals where `value` is null contribute 0 to the sum.
 *
 * **Validates: Requirements 12.1**
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

vi.mock('../../../../config/database.config', () => {
  return {
    default: {
      deal: {
        findMany: vi.fn(),
      },
      pipeline: {
        findFirst: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
      },
    },
  };
});

import prisma from '../../../../config/database.config';
import { computeForecast } from '../forecast.service';

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

/** Generator for a deal value — nullable number (0 to ~10M range) */
const dealValueArb = fc.oneof(
  fc.constant(null),
  fc.double({ min: 0, max: 10_000_000, noNaN: true, noDefaultInfinity: true }),
);

/** Generator for stage probability (0 to 100 integer) */
const probabilityArb = fc.integer({ min: 0, max: 100 });

/** Generator for a pipeline ID (limited set to allow grouping) */
const pipelineIdArb = fc.constantFrom('pipeline-1', 'pipeline-2', 'pipeline-3');

/** Generator for a pipeline name */
const pipelineNameArb = fc.constantFrom('Sales Pipeline', 'Enterprise', 'SMB Pipeline');

/** Generator for a single deal with value and stage probability */
const dealArb = fc.record({
  value: dealValueArb,
  probability: probabilityArb,
  pipelineId: pipelineIdArb,
  pipelineName: pipelineNameArb,
});

/** Generator for an array of deals (1 to 50) */
const dealsArrayArb = fc.array(dealArb, { minLength: 0, maxLength: 50 });

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

interface GeneratedDeal {
  value: number | null;
  probability: number;
  pipelineId: string;
  pipelineName: string;
}

/**
 * Compute the expected forecast total manually.
 * Each deal contributes: (value ?? 0) * (probability / 100)
 */
function computeExpectedTotal(deals: GeneratedDeal[]): number {
  let total = 0;
  for (const deal of deals) {
    total += (deal.value ?? 0) * (deal.probability / 100);
  }
  return total;
}

/**
 * Compute expected byPipeline grouping manually.
 */
function computeExpectedByPipeline(deals: GeneratedDeal[]): Map<string, { name: string; total: number }> {
  const map = new Map<string, { name: string; total: number }>();
  for (const deal of deals) {
    const weighted = (deal.value ?? 0) * (deal.probability / 100);
    const entry = map.get(deal.pipelineId) ?? { name: deal.pipelineName, total: 0 };
    entry.total += weighted;
    map.set(deal.pipelineId, entry);
  }
  return map;
}

/**
 * Transform generated deals into the shape returned by prisma.deal.findMany
 * as expected by the forecast service.
 */
function toMockPrismaDeals(deals: GeneratedDeal[]) {
  return deals.map((deal) => ({
    value: deal.value,
    pipelineId: deal.pipelineId,
    stage: { probability: deal.probability },
    pipeline: { id: deal.pipelineId, name: deal.pipelineName, currency: 'PHP' },
  }));
}

// ─────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 9: Forecast Computation Correctness', () => {
  const TENANT_ID = 'tenant-test-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Total forecast calculation', () => {
    it('forecast total equals sum of deal.value × stage.probability / 100 for any set of deals', async () => {
      await fc.assert(
        fc.asyncProperty(dealsArrayArb, async (generatedDeals) => {
          // Arrange: mock Prisma to return generated deals
          const mockDeals = toMockPrismaDeals(generatedDeals);
          vi.mocked(prisma.deal.findMany).mockResolvedValue(mockDeals as never);
          vi.mocked(prisma.pipeline.findFirst).mockResolvedValue(null);

          // Act: call computeForecast
          const result = await computeForecast(TENANT_ID);

          // Assert: total matches manual calculation
          const expectedTotal = computeExpectedTotal(generatedDeals);

          // Use approximate equality due to floating-point arithmetic
          expect(result.total).toBeCloseTo(expectedTotal, 6);
        }),
        { numRuns: 100 },
      );
    });

    it('deals with null value contribute 0 to the forecast total', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              value: fc.constant(null),
              probability: probabilityArb,
              pipelineId: pipelineIdArb,
              pipelineName: pipelineNameArb,
            }),
            { minLength: 1, maxLength: 20 },
          ),
          async (nullValueDeals) => {
            const mockDeals = toMockPrismaDeals(nullValueDeals);
            vi.mocked(prisma.deal.findMany).mockResolvedValue(mockDeals as never);
            vi.mocked(prisma.pipeline.findFirst).mockResolvedValue(null);

            const result = await computeForecast(TENANT_ID);

            expect(result.total).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('deals with 0% probability contribute 0 to the forecast total', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              value: fc.double({ min: 1, max: 10_000_000, noNaN: true, noDefaultInfinity: true }),
              probability: fc.constant(0),
              pipelineId: pipelineIdArb,
              pipelineName: pipelineNameArb,
            }),
            { minLength: 1, maxLength: 20 },
          ),
          async (zeroProbDeals) => {
            const mockDeals = toMockPrismaDeals(zeroProbDeals);
            vi.mocked(prisma.deal.findMany).mockResolvedValue(mockDeals as never);
            vi.mocked(prisma.pipeline.findFirst).mockResolvedValue(null);

            const result = await computeForecast(TENANT_ID);

            expect(result.total).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('deals with 100% probability contribute their full value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              value: fc.double({ min: 0.01, max: 10_000_000, noNaN: true, noDefaultInfinity: true }),
              probability: fc.constant(100),
              pipelineId: pipelineIdArb,
              pipelineName: pipelineNameArb,
            }),
            { minLength: 1, maxLength: 20 },
          ),
          async (fullProbDeals) => {
            const mockDeals = toMockPrismaDeals(fullProbDeals);
            vi.mocked(prisma.deal.findMany).mockResolvedValue(mockDeals as never);
            vi.mocked(prisma.pipeline.findFirst).mockResolvedValue(null);

            const result = await computeForecast(TENANT_ID);

            const expectedTotal = fullProbDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0);
            expect(result.total).toBeCloseTo(expectedTotal, 6);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('empty deal set produces forecast total of 0', async () => {
      vi.mocked(prisma.deal.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValue(null);

      const result = await computeForecast(TENANT_ID);

      expect(result.total).toBe(0);
      expect(result.byPipeline).toEqual([]);
    });
  });

  describe('byPipeline grouping correctness', () => {
    it('byPipeline totals sum to the overall forecast total', async () => {
      await fc.assert(
        fc.asyncProperty(dealsArrayArb, async (generatedDeals) => {
          const mockDeals = toMockPrismaDeals(generatedDeals);
          vi.mocked(prisma.deal.findMany).mockResolvedValue(mockDeals as never);
          vi.mocked(prisma.pipeline.findFirst).mockResolvedValue(null);

          const result = await computeForecast(TENANT_ID);

          // Sum of all byPipeline totals should equal the overall total
          const pipelineSum = result.byPipeline.reduce((sum, p) => sum + p.total, 0);
          expect(pipelineSum).toBeCloseTo(result.total, 6);
        }),
        { numRuns: 100 },
      );
    });

    it('each pipeline total matches the manual calculation for its deals', async () => {
      await fc.assert(
        fc.asyncProperty(dealsArrayArb, async (generatedDeals) => {
          const mockDeals = toMockPrismaDeals(generatedDeals);
          vi.mocked(prisma.deal.findMany).mockResolvedValue(mockDeals as never);
          vi.mocked(prisma.pipeline.findFirst).mockResolvedValue(null);

          const result = await computeForecast(TENANT_ID);

          // Compute expected byPipeline
          const expectedMap = computeExpectedByPipeline(generatedDeals);

          // Every pipeline in the result should have the correct total
          for (const pipelineResult of result.byPipeline) {
            const expected = expectedMap.get(pipelineResult.pipelineId);
            expect(expected).toBeDefined();
            expect(pipelineResult.total).toBeCloseTo(expected!.total, 6);
            expect(pipelineResult.name).toBe(expected!.name);
          }

          // No extra pipelines in result that shouldn't be there
          // (pipelines with 0 total from all-null-value deals may still appear)
          expect(result.byPipeline.length).toBe(expectedMap.size);
        }),
        { numRuns: 100 },
      );
    });

    it('number of pipeline groups equals number of distinct pipelineIds in the deals', async () => {
      await fc.assert(
        fc.asyncProperty(dealsArrayArb, async (generatedDeals) => {
          const mockDeals = toMockPrismaDeals(generatedDeals);
          vi.mocked(prisma.deal.findMany).mockResolvedValue(mockDeals as never);
          vi.mocked(prisma.pipeline.findFirst).mockResolvedValue(null);

          const result = await computeForecast(TENANT_ID);

          const distinctPipelines = new Set(generatedDeals.map((d) => d.pipelineId));
          expect(result.byPipeline.length).toBe(distinctPipelines.size);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Currency resolution', () => {
    it('returns PHP as default currency when no pipeline currency is configured', async () => {
      vi.mocked(prisma.deal.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValue(null);

      const result = await computeForecast(TENANT_ID);

      expect(result.currency).toBe('PHP');
    });

    it('uses pipeline currency when pipelineId is provided and pipeline has currency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('USD', 'EUR', 'GBP', 'JPY', 'SGD'),
          async (currency) => {
            vi.mocked(prisma.deal.findMany).mockResolvedValue([] as never);
            vi.mocked(prisma.pipeline.findFirst).mockResolvedValue({ currency } as never);

            const result = await computeForecast(TENANT_ID, 'specific-pipeline');

            expect(result.currency).toBe(currency);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
