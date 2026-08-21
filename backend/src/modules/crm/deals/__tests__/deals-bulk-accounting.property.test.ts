import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based test for bulk operation accounting invariant.
 *
 * **Property 6: Bulk Operation Accounting Invariant**
 *
 * For any bulk operation request, the response SHALL satisfy the invariant:
 * `succeeded + failed === dealIds.length`. No deal ID is counted in both,
 * and no deal ID is uncounted.
 *
 * **Validates: Requirements 6.4**
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

vi.mock('../../../../config/database.config', () => {
  return {
    default: {
      deal: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

vi.mock('../../../../core/audit/audit.service', () => {
  return {
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

import prisma from '../../../../config/database.config';
import { bulkArchive } from '../bulk-deals.service';

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

/**
 * Generate a non-empty string ID (simulates a deal UUID/CUID).
 */
const dealIdArb = fc.uuid();

/**
 * Generate an array of deal IDs within the accepted range (1-50).
 */
const dealIdsArb = fc.array(dealIdArb, { minLength: 1, maxLength: 50 });

/**
 * Generate a set of indices that represent "found" deals in the batch.
 * For a given array length, produces a random subset of indices
 * where prisma.deal.findFirst will return a deal (the rest return null).
 */
function foundIndicesArb(length: number): fc.Arbitrary<Set<number>> {
  return fc
    .array(fc.boolean(), { minLength: length, maxLength: length })
    .map((booleans) => {
      const indices = new Set<number>();
      booleans.forEach((found, index) => {
        if (found) indices.add(index);
      });
      return indices;
    });
}

// ─────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 6: Bulk Operation Accounting Invariant', () => {
  const tenantId = 'tenant-001';
  const userId = 'user-001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should satisfy succeeded + failed === dealIds.length for any mix of found/not-found deals', async () => {
    await fc.assert(
      fc.asyncProperty(dealIdsArb, async (dealIds) => {
        // Generate a random set of "found" indices for this run
        const foundSet = await fc.sample(foundIndicesArb(dealIds.length), 1)[0];

        // Configure prisma mock: return a deal for "found" IDs, null for others
        let callIndex = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma.deal.findFirst as any).mockImplementation(async () => {
          const isFound = foundSet.has(callIndex);
          callIndex++;
          if (isFound) {
            return {
              id: dealIds[callIndex - 1],
              tenantId,
              title: 'Test Deal',
              isArchived: false,
              assignedUserId: null,
              stageId: 'stage-1',
              pipelineId: 'pipeline-1',
              value: 1000,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          return null;
        });

        vi.mocked(prisma.deal.update).mockResolvedValue({} as never);

        const result = await bulkArchive(tenantId, userId, { dealIds });

        // THE INVARIANT: succeeded + failed must always equal dealIds.length
        expect(result.succeeded + result.failed).toBe(dealIds.length);
      }),
      { numRuns: 100 },
    );
  });

  it('should count all deals as failed when none are found in the tenant', async () => {
    await fc.assert(
      fc.asyncProperty(dealIdsArb, async (dealIds) => {
        // All findFirst calls return null (no deals found)
        vi.mocked(prisma.deal.findFirst).mockResolvedValue(null as never);

        const result = await bulkArchive(tenantId, userId, { dealIds });

        expect(result.succeeded).toBe(0);
        expect(result.failed).toBe(dealIds.length);
        expect(result.succeeded + result.failed).toBe(dealIds.length);
      }),
      { numRuns: 100 },
    );
  });

  it('should count all deals as succeeded when all are found in the tenant', async () => {
    await fc.assert(
      fc.asyncProperty(dealIdsArb, async (dealIds) => {
        // All findFirst calls return a deal
        vi.mocked(prisma.deal.findFirst).mockResolvedValue({
          id: 'deal-found',
          tenantId,
          title: 'Test Deal',
          isArchived: false,
          assignedUserId: null,
          stageId: 'stage-1',
          pipelineId: 'pipeline-1',
          value: 1000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never);
        vi.mocked(prisma.deal.update).mockResolvedValue({} as never);

        const result = await bulkArchive(tenantId, userId, { dealIds });

        expect(result.succeeded).toBe(dealIds.length);
        expect(result.failed).toBe(0);
        expect(result.succeeded + result.failed).toBe(dealIds.length);
      }),
      { numRuns: 100 },
    );
  });

  it('should count update failures as failed (not double-counted)', async () => {
    await fc.assert(
      fc.asyncProperty(dealIdsArb, async (dealIds) => {
        // All deals are found but update throws for some
        const failOnUpdate = await fc.sample(
          fc.array(fc.boolean(), { minLength: dealIds.length, maxLength: dealIds.length }),
          1,
        )[0];

        vi.mocked(prisma.deal.findFirst).mockResolvedValue({
          id: 'deal-found',
          tenantId,
          title: 'Test Deal',
          isArchived: false,
          assignedUserId: null,
          stageId: 'stage-1',
          pipelineId: 'pipeline-1',
          value: 1000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never);

        let updateCallIndex = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma.deal.update as any).mockImplementation(async () => {
          const shouldFail = failOnUpdate[updateCallIndex];
          updateCallIndex++;
          if (shouldFail) {
            throw new Error('Simulated update failure');
          }
          return {};
        });

        const result = await bulkArchive(tenantId, userId, { dealIds });

        // The invariant MUST hold regardless of update failures
        expect(result.succeeded + result.failed).toBe(dealIds.length);
      }),
      { numRuns: 100 },
    );
  });
});
