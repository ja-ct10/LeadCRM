import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based test for bulk audit correspondence.
 *
 * **Property 8: Bulk Audit Correspondence**
 *
 * For any bulk archive operation, the number of audit log entries written SHALL
 * equal the `succeeded` count in the returned result. That is, every successfully
 * archived deal produces exactly one audit entry, and failed deals produce none.
 *
 * **Validates: Requirements 6.5, 7.5**
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

const mockWriteAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../config/database.config', () => {
  return {
    default: {
      deal: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
    },
  };
});

vi.mock('../../../../core/audit/audit.service', () => {
  return {
    writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
  };
});

// Import after mocking
import prisma from '../../../../config/database.config';
import { bulkArchive } from '../bulk-deals.service';

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

/**
 * Generate a UUID-like deal ID.
 */
const dealIdArb = fc.uuid();

/**
 * Generate an array of deal IDs (1-50, valid range for bulk operations).
 */
const dealIdsArb = fc.array(dealIdArb, { minLength: 1, maxLength: 50 });

/**
 * Generate a tenant ID.
 */
const tenantIdArb = fc.uuid();

/**
 * Generate a user ID.
 */
const userIdArb = fc.uuid();

/**
 * For each deal ID, generate whether it belongs to the tenant (true) or not (false).
 * This simulates mixed ownership in the array.
 */
const ownershipBoolArb = fc.boolean();

// ─────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 8: Bulk Audit Correspondence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call writeAuditLog exactly `succeeded` times for bulkArchive', async () => {
    await fc.assert(
      fc.asyncProperty(
        dealIdsArb,
        tenantIdArb,
        userIdArb,
        fc.array(ownershipBoolArb, { minLength: 1, maxLength: 50 }),
        async (dealIds, tenantId, userId, ownershipFlags) => {
          vi.clearAllMocks();

          // For each deal ID, decide if it belongs to the tenant based on the ownership flag
          vi.mocked(prisma.deal.findFirst).mockImplementation(
            (args: unknown) => {
              const { where } = args as { where: { id: string; tenantId: string } };
              const index = dealIds.indexOf(where.id);
              // Use the ownership flag at the deal's index (wrap around if needed)
              const belongsToTenant = ownershipFlags[index % ownershipFlags.length];

              if (belongsToTenant) {
                return Promise.resolve({
                  id: where.id,
                  tenantId: where.tenantId,
                  isArchived: false,
                  title: 'Test Deal',
                }) as never;
              }
              return Promise.resolve(null) as never;
            },
          );

          // update always succeeds for owned deals
          vi.mocked(prisma.deal.update).mockResolvedValue({} as never);

          const result = await bulkArchive(tenantId, userId, { dealIds });

          // The core property: audit calls === succeeded count
          expect(mockWriteAuditLog).toHaveBeenCalledTimes(result.succeeded);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should produce zero audit entries when no deals belong to the tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        dealIdsArb,
        tenantIdArb,
        userIdArb,
        async (dealIds, tenantId, userId) => {
          vi.clearAllMocks();

          // All deals are "not found" (not belonging to tenant)
          vi.mocked(prisma.deal.findFirst).mockResolvedValue(null as never);

          const result = await bulkArchive(tenantId, userId, { dealIds });

          expect(result.succeeded).toBe(0);
          expect(mockWriteAuditLog).toHaveBeenCalledTimes(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should produce audit entries equal to dealIds.length when all deals belong to the tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        dealIdsArb,
        tenantIdArb,
        userIdArb,
        async (dealIds, tenantId, userId) => {
          vi.clearAllMocks();

          // All deals belong to the tenant
          vi.mocked(prisma.deal.findFirst).mockImplementation(
            (args: unknown) => {
              const { where } = args as { where: { id: string; tenantId: string } };
              return Promise.resolve({
                id: where.id,
                tenantId: where.tenantId,
                isArchived: false,
                title: 'Test Deal',
              }) as never;
            },
          );

          vi.mocked(prisma.deal.update).mockResolvedValue({} as never);

          const result = await bulkArchive(tenantId, userId, { dealIds });

          expect(result.succeeded).toBe(dealIds.length);
          expect(mockWriteAuditLog).toHaveBeenCalledTimes(dealIds.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should write each audit entry with the correct deal ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        dealIdsArb,
        tenantIdArb,
        userIdArb,
        async (dealIds, tenantId, userId) => {
          vi.clearAllMocks();

          // All deals found
          vi.mocked(prisma.deal.findFirst).mockImplementation(
            (args: unknown) => {
              const { where } = args as { where: { id: string; tenantId: string } };
              return Promise.resolve({
                id: where.id,
                tenantId: where.tenantId,
                isArchived: false,
                title: 'Test Deal',
              }) as never;
            },
          );

          vi.mocked(prisma.deal.update).mockResolvedValue({} as never);

          await bulkArchive(tenantId, userId, { dealIds });

          // Each audit call should reference the correct entity
          const auditedDealIds = mockWriteAuditLog.mock.calls.map(
            (call) => (call[0] as { entityId: string }).entityId,
          );

          // All successfully processed deal IDs appear in audit calls
          expect(auditedDealIds.sort()).toEqual([...dealIds].sort());
        },
      ),
      { numRuns: 100 },
    );
  });
});
