import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based test for sort ordering correctness.
 *
 * **Property 2: Sort Ordering Correctness**
 * For any valid `sortBy` field and `sortOrder` (asc/desc), `findAllDeals` SHALL pass
 * the correct `orderBy: { [sortBy]: sortOrder }` to Prisma. When no `sortBy` is provided,
 * it SHALL default to `{ createdAt: 'desc' }`.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

const mockFindMany = vi.fn().mockResolvedValue([]);
const mockCount = vi.fn().mockResolvedValue(0);

vi.mock('../../../../config/database.config', () => {
  return {
    default: {
      deal: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
        count: (...args: unknown[]) => mockCount(...args),
      },
    },
  };
});

// Import after mocking
import { findAllDeals } from '../deals.repository';

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

/**
 * All valid sortBy field values from the DealsQuerySchema enum.
 */
const VALID_SORT_FIELDS = [
  'title',
  'value',
  'priority',
  'expectedCloseDate',
  'createdAt',
  'updatedAt',
  'stageId',
] as const;

type SortField = typeof VALID_SORT_FIELDS[number];

const sortFieldArb: fc.Arbitrary<SortField> = fc.constantFrom(...VALID_SORT_FIELDS);
const sortOrderArb: fc.Arbitrary<'asc' | 'desc'> = fc.constantFrom('asc' as const, 'desc' as const);
const tenantIdArb = fc.uuid();

// ─────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 2: Sort Ordering Correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  describe('explicit sortBy field passes correct orderBy to Prisma', () => {
    it('should pass orderBy: { [sortBy]: sortOrder } for any valid sortBy and sortOrder combination', async () => {
      await fc.assert(
        fc.asyncProperty(
          sortFieldArb,
          sortOrderArb,
          tenantIdArb,
          async (sortBy, sortOrder, tenantId) => {
            mockFindMany.mockClear();
            mockCount.mockClear();
            mockFindMany.mockResolvedValue([]);
            mockCount.mockResolvedValue(0);

            await findAllDeals(tenantId, {
              page: 1,
              limit: 25,
              sortBy,
              sortOrder,
              archived: 'false',
            });

            // Verify prisma.deal.findMany was called with the correct orderBy
            expect(mockFindMany).toHaveBeenCalledTimes(1);
            const callArgs = mockFindMany.mock.calls[0][0];
            expect(callArgs.orderBy).toEqual({ [sortBy]: sortOrder });
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('default sort when no sortBy is provided', () => {
    it('should default to orderBy: { createdAt: "desc" } when sortBy is undefined', async () => {
      await fc.assert(
        fc.asyncProperty(tenantIdArb, async (tenantId) => {
          mockFindMany.mockClear();
          mockCount.mockClear();
          mockFindMany.mockResolvedValue([]);
          mockCount.mockResolvedValue(0);

          await findAllDeals(tenantId, {
            page: 1,
            limit: 25,
            sortBy: undefined,
            sortOrder: 'desc',
            archived: 'false',
          });

          expect(mockFindMany).toHaveBeenCalledTimes(1);
          const callArgs = mockFindMany.mock.calls[0][0];
          expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('sort direction is preserved regardless of field', () => {
    it('should apply "asc" direction correctly for every valid sort field', async () => {
      await fc.assert(
        fc.asyncProperty(sortFieldArb, tenantIdArb, async (sortBy, tenantId) => {
          mockFindMany.mockClear();
          mockCount.mockClear();
          mockFindMany.mockResolvedValue([]);
          mockCount.mockResolvedValue(0);

          await findAllDeals(tenantId, {
            page: 1,
            limit: 25,
            sortBy,
            sortOrder: 'asc',
            archived: 'false',
          });

          expect(mockFindMany).toHaveBeenCalledTimes(1);
          const callArgs = mockFindMany.mock.calls[0][0];
          expect(callArgs.orderBy).toEqual({ [sortBy]: 'asc' });
        }),
        { numRuns: 100 },
      );
    });

    it('should apply "desc" direction correctly for every valid sort field', async () => {
      await fc.assert(
        fc.asyncProperty(sortFieldArb, tenantIdArb, async (sortBy, tenantId) => {
          mockFindMany.mockClear();
          mockCount.mockClear();
          mockFindMany.mockResolvedValue([]);
          mockCount.mockResolvedValue(0);

          await findAllDeals(tenantId, {
            page: 1,
            limit: 25,
            sortBy,
            sortOrder: 'desc',
            archived: 'false',
          });

          expect(mockFindMany).toHaveBeenCalledTimes(1);
          const callArgs = mockFindMany.mock.calls[0][0];
          expect(callArgs.orderBy).toEqual({ [sortBy]: 'desc' });
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('sort does not affect tenant scoping', () => {
    it('should always include tenantId in the where clause regardless of sort params', async () => {
      await fc.assert(
        fc.asyncProperty(
          sortFieldArb,
          sortOrderArb,
          tenantIdArb,
          async (sortBy, sortOrder, tenantId) => {
            mockFindMany.mockClear();
            mockCount.mockClear();
            mockFindMany.mockResolvedValue([]);
            mockCount.mockResolvedValue(0);

            await findAllDeals(tenantId, {
              page: 1,
              limit: 25,
              sortBy,
              sortOrder,
              archived: 'false',
            });

            expect(mockFindMany).toHaveBeenCalledTimes(1);
            const callArgs = mockFindMany.mock.calls[0][0];
            expect(callArgs.where.tenantId).toBe(tenantId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
