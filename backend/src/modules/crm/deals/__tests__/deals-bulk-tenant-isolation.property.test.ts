import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based test for bulk tenant isolation.
 *
 * **Property 7: Bulk Tenant Isolation**
 *
 * For any bulk operation where some deal IDs belong to the authenticated tenant and
 * some do not, the operation SHALL process only tenant-owned deals and silently skip
 * (count as failed) non-tenant deals without revealing their existence.
 *
 * **Validates: Requirements 6.3, 8.5**
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
      user: {
        findFirst: vi.fn(),
      },
      stage: {
        findFirst: vi.fn(),
      },
      dealStageHistory: {
        create: vi.fn(),
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
import { writeAuditLog } from '../../../../core/audit/audit.service';
import { bulkArchive, bulkReassign, bulkStageChange } from '../bulk-deals.service';

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

/** Generate a non-empty deal ID */
const dealIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0);

/**
 * Generate an array of deal IDs split into tenant-owned and non-tenant sets.
 * At least 1 deal total, up to 50 (bulk limit). Each ID is either owned or not.
 */
const mixedDealIdsArb = fc
  .array(
    fc.record({
      id: dealIdArb,
      isOwnedByTenant: fc.boolean(),
    }),
    { minLength: 1, maxLength: 50 },
  )
  .filter((arr) => {
    // Ensure unique IDs
    const ids = arr.map((d) => d.id);
    return new Set(ids).size === ids.length;
  });

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

const TENANT_ID = 'tenant-test-isolation';
const USER_ID = 'user-test-123';

interface DealIdRecord {
  id: string;
  isOwnedByTenant: boolean;
}

/**
 * Set up prisma.deal.findFirst mock based on which deal IDs are tenant-owned.
 * Tenant-owned deals return a deal object; non-tenant deals return null.
 */
function setupFindFirstMock(records: DealIdRecord[]): void {
  const ownedIds = new Set(records.filter((r) => r.isOwnedByTenant).map((r) => r.id));

  vi.mocked(prisma.deal.findFirst).mockImplementation(((args: { where: { id: string; tenantId: string } }) => {
    const dealId = args.where.id;
    if (ownedIds.has(dealId)) {
      return Promise.resolve({
        id: dealId,
        tenantId: TENANT_ID,
        title: `Deal ${dealId}`,
        stageId: 'stage-current',
        pipelineId: 'pipeline-1',
        assignedUserId: 'user-old',
        isArchived: false,
        value: 1000,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
        stage: { id: 'stage-current', name: 'Current', probability: 50, requiredFields: [] },
      });
    }
    return Promise.resolve(null);
  }) as never);
}

// ─────────────────────────────────────────────────────
// TESTS — bulkArchive
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 7: Bulk Tenant Isolation — bulkArchive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
  });

  it('only processes tenant-owned deals; non-tenant deals are silently skipped (counted as failed)', async () => {
    await fc.assert(
      fc.asyncProperty(mixedDealIdsArb, async (records) => {
        // Arrange
        setupFindFirstMock(records);
        vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
        vi.mocked(writeAuditLog).mockResolvedValue(undefined as never);

        const dealIds = records.map((r) => r.id);
        const ownedCount = records.filter((r) => r.isOwnedByTenant).length;
        const nonOwnedCount = records.filter((r) => !r.isOwnedByTenant).length;

        // Act
        const result = await bulkArchive(TENANT_ID, USER_ID, { dealIds });

        // Assert: succeeded equals tenant-owned count
        expect(result.succeeded).toBe(ownedCount);

        // Assert: failed equals non-tenant count
        expect(result.failed).toBe(nonOwnedCount);
      }),
      { numRuns: 100 },
    );
  });

  it('non-tenant deal IDs do NOT trigger update calls', async () => {
    await fc.assert(
      fc.asyncProperty(mixedDealIdsArb, async (records) => {
        // Arrange
        vi.clearAllMocks();
        setupFindFirstMock(records);
        vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
        vi.mocked(writeAuditLog).mockResolvedValue(undefined as never);

        const dealIds = records.map((r) => r.id);
        const ownedCount = records.filter((r) => r.isOwnedByTenant).length;

        // Act
        await bulkArchive(TENANT_ID, USER_ID, { dealIds });

        // Assert: update called only for tenant-owned deals
        expect(prisma.deal.update).toHaveBeenCalledTimes(ownedCount);

        // Assert: non-tenant deal IDs were never passed to update
        const nonOwnedIds = new Set(records.filter((r) => !r.isOwnedByTenant).map((r) => r.id));
        const updateCalls = vi.mocked(prisma.deal.update).mock.calls;
        for (const call of updateCalls) {
          const updatedId = (call[0] as { where: { id: string } }).where.id;
          expect(nonOwnedIds.has(updatedId)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('non-tenant deals appear in errors array with "Not found" reason (no existence leak)', async () => {
    await fc.assert(
      fc.asyncProperty(mixedDealIdsArb, async (records) => {
        // Arrange
        setupFindFirstMock(records);
        vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
        vi.mocked(writeAuditLog).mockResolvedValue(undefined as never);

        const dealIds = records.map((r) => r.id);
        const nonOwnedIds = new Set(records.filter((r) => !r.isOwnedByTenant).map((r) => r.id));

        // Act
        const result = await bulkArchive(TENANT_ID, USER_ID, { dealIds });

        // Assert: every non-owned ID is in errors with "Not found" reason
        for (const errorEntry of result.errors) {
          expect(nonOwnedIds.has(errorEntry.id)).toBe(true);
          expect(errorEntry.reason).toBe('Not found');
        }

        // Assert: error entries count matches non-owned count
        expect(result.errors.length).toBe(nonOwnedIds.size);
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────
// TESTS — bulkReassign
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 7: Bulk Tenant Isolation — bulkReassign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock target user found in tenant
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-target', tenantId: TENANT_ID } as never);
    vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
  });

  it('only reassigns tenant-owned deals; non-tenant deals are silently skipped', async () => {
    await fc.assert(
      fc.asyncProperty(mixedDealIdsArb, async (records) => {
        // Arrange
        vi.clearAllMocks();
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-target', tenantId: TENANT_ID } as never);
        vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
        vi.mocked(writeAuditLog).mockResolvedValue(undefined as never);
        setupFindFirstMock(records);

        const dealIds = records.map((r) => r.id);
        const ownedCount = records.filter((r) => r.isOwnedByTenant).length;
        const nonOwnedCount = records.filter((r) => !r.isOwnedByTenant).length;

        // Act
        const result = await bulkReassign(TENANT_ID, USER_ID, {
          dealIds,
          assignedUserId: 'user-target',
        });

        // Assert
        expect(result.succeeded).toBe(ownedCount);
        expect(result.failed).toBe(nonOwnedCount);
      }),
      { numRuns: 100 },
    );
  });

  it('non-tenant deal IDs do NOT trigger update calls for reassign', async () => {
    await fc.assert(
      fc.asyncProperty(mixedDealIdsArb, async (records) => {
        // Arrange
        vi.clearAllMocks();
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-target', tenantId: TENANT_ID } as never);
        vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
        vi.mocked(writeAuditLog).mockResolvedValue(undefined as never);
        setupFindFirstMock(records);

        const dealIds = records.map((r) => r.id);
        const ownedCount = records.filter((r) => r.isOwnedByTenant).length;

        // Act
        await bulkReassign(TENANT_ID, USER_ID, {
          dealIds,
          assignedUserId: 'user-target',
        });

        // Assert: update only called for owned deals
        expect(prisma.deal.update).toHaveBeenCalledTimes(ownedCount);

        // Assert: non-owned IDs never passed to update
        const nonOwnedIds = new Set(records.filter((r) => !r.isOwnedByTenant).map((r) => r.id));
        const updateCalls = vi.mocked(prisma.deal.update).mock.calls;
        for (const call of updateCalls) {
          const updatedId = (call[0] as { where: { id: string } }).where.id;
          expect(nonOwnedIds.has(updatedId)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────
// TESTS — bulkStageChange
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 7: Bulk Tenant Isolation — bulkStageChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock target stage found in tenant (non-lost, non-won, no required fields)
    vi.mocked(prisma.stage.findFirst).mockResolvedValue({
      id: 'stage-target',
      tenantId: TENANT_ID,
      isLost: false,
      isWon: false,
      requiredFields: [],
    } as never);
    vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
    vi.mocked(prisma.dealStageHistory.create).mockResolvedValue({} as never);
  });

  it('only changes stage for tenant-owned deals; non-tenant deals are silently skipped', async () => {
    await fc.assert(
      fc.asyncProperty(mixedDealIdsArb, async (records) => {
        // Arrange
        vi.clearAllMocks();
        vi.mocked(prisma.stage.findFirst).mockResolvedValue({
          id: 'stage-target',
          tenantId: TENANT_ID,
          isLost: false,
          isWon: false,
          requiredFields: [],
        } as never);
        vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
        vi.mocked(prisma.dealStageHistory.create).mockResolvedValue({} as never);
        vi.mocked(writeAuditLog).mockResolvedValue(undefined as never);
        setupFindFirstMock(records);

        const dealIds = records.map((r) => r.id);
        const ownedCount = records.filter((r) => r.isOwnedByTenant).length;
        const nonOwnedCount = records.filter((r) => !r.isOwnedByTenant).length;

        // Act
        const result = await bulkStageChange(TENANT_ID, USER_ID, {
          dealIds,
          stageId: 'stage-target',
        });

        // Assert
        expect(result.succeeded).toBe(ownedCount);
        expect(result.failed).toBe(nonOwnedCount);
      }),
      { numRuns: 100 },
    );
  });

  it('non-tenant deal IDs do NOT trigger update or history creation calls', async () => {
    await fc.assert(
      fc.asyncProperty(mixedDealIdsArb, async (records) => {
        // Arrange
        vi.clearAllMocks();
        vi.mocked(prisma.stage.findFirst).mockResolvedValue({
          id: 'stage-target',
          tenantId: TENANT_ID,
          isLost: false,
          isWon: false,
          requiredFields: [],
        } as never);
        vi.mocked(prisma.deal.update).mockResolvedValue({} as never);
        vi.mocked(prisma.dealStageHistory.create).mockResolvedValue({} as never);
        vi.mocked(writeAuditLog).mockResolvedValue(undefined as never);
        setupFindFirstMock(records);

        const dealIds = records.map((r) => r.id);
        const ownedCount = records.filter((r) => r.isOwnedByTenant).length;

        // Act
        await bulkStageChange(TENANT_ID, USER_ID, {
          dealIds,
          stageId: 'stage-target',
        });

        // Assert: update and history only called for owned deals
        expect(prisma.deal.update).toHaveBeenCalledTimes(ownedCount);
        expect(prisma.dealStageHistory.create).toHaveBeenCalledTimes(ownedCount);

        // Assert: non-owned IDs never passed
        const nonOwnedIds = new Set(records.filter((r) => !r.isOwnedByTenant).map((r) => r.id));
        const updateCalls = vi.mocked(prisma.deal.update).mock.calls;
        for (const call of updateCalls) {
          const updatedId = (call[0] as { where: { id: string } }).where.id;
          expect(nonOwnedIds.has(updatedId)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
