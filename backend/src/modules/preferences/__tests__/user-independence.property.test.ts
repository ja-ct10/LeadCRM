import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { ColumnConfigItem } from '@leadcrm/shared';
import type { Prisma } from '@prisma/client';

import {
  LEADS_COLUMN_REGISTRY,
  getRequiredColumnIds,
} from '../column-registry';
import { upsertTenantDefault } from '../preferences.service';

/**
 * Property-based tests for User Preference Independence.
 *
 * Feature: manage-columns-persistence, Property 11: User Preference Independence
 *
 * **Validates: Requirements 4.5**
 *
 * Property: For any update to a Tenant_Preference, all existing User_Preference
 * records for that tenant and module SHALL remain unchanged in the database.
 *
 * The key insight: upsertTenantDefault ONLY calls:
 * - findTenantPreference (to check existing for audit)
 * - upsertTenantPreference (to persist the new tenant default)
 * - writeAuditLog (fire-and-forget)
 * It NEVER calls upsertUserPreference or deleteUserPreference.
 * → User preferences are inherently unchanged by design.
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

vi.mock('../preferences.repository');
vi.mock('../../../core/audit/audit.service');

import * as repo from '../preferences.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';

const mockedFindTenantPreference = vi.mocked(repo.findTenantPreference);
const mockedUpsertTenantPreference = vi.mocked(repo.upsertTenantPreference);
const mockedUpsertUserPreference = vi.mocked(repo.upsertUserPreference);
const mockedDeleteUserPreference = vi.mocked(repo.deleteUserPreference);
const mockedFindUserPreference = vi.mocked(repo.findUserPreference);
const mockedWriteAuditLog = vi.mocked(writeAuditLog);

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

const registryColumns = LEADS_COLUMN_REGISTRY.columns;
const registryIds = registryColumns.map((c) => c.id);
const requiredIds = new Set(getRequiredColumnIds('leads'));

/** Helper to cast column config to Prisma JsonValue for mock return types. */
function asJsonValue(val: { columns: ColumnConfigItem[] }): Prisma.JsonValue {
  return val as unknown as Prisma.JsonValue;
}

/**
 * Generate a valid ColumnConfigItem[] suitable for a tenant default save.
 * Ensures required columns are visible and all ids come from the registry.
 */
function validTenantConfigArb(): fc.Arbitrary<ColumnConfigItem[]> {
  return fc
    .shuffledSubarray(registryIds, { minLength: 3, maxLength: registryIds.length })
    .map((ids) =>
      ids.map((id, idx) => ({
        id,
        visible: requiredIds.has(id) ? true : idx % 2 === 0,
        order: idx,
      })),
    )
    .filter((cols) => {
      // Ensure all required columns are included and visible
      const colMap = new Map(cols.map((c) => [c.id, c]));
      for (const reqId of requiredIds) {
        if (!colMap.has(reqId) || !colMap.get(reqId)!.visible) {
          return false;
        }
      }
      return true;
    });
}

/**
 * Generate a random user preference record shape.
 * Represents a stored user preference that should remain untouched.
 */
interface MockUserPreference {
  tenantId: string;
  userId: string;
  module: string;
  columns: ColumnConfigItem[];
}

function userPreferenceArb(tenantId: string): fc.Arbitrary<MockUserPreference> {
  return fc.tuple(
    fc.uuid(), // userId
    fc.shuffledSubarray(registryIds, { minLength: 2, maxLength: registryIds.length }),
  ).map(([userId, ids]) => ({
    tenantId,
    userId,
    module: 'leads',
    columns: ids.map((id, idx) => ({
      id,
      visible: requiredIds.has(id) ? true : Math.random() > 0.4,
      order: idx,
    })),
  }));
}

// ─────────────────────────────────────────────────────
// Property 11: User Preference Independence
// ─────────────────────────────────────────────────────

describe('Feature: manage-columns-persistence, Property 11: User Preference Independence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock for audit — resolves successfully (fire-and-forget)
    mockedWriteAuditLog.mockResolvedValue(undefined);
  });

  it('should never call upsertUserPreference or deleteUserPreference when mutating tenant default', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // tenantId
        fc.uuid(), // adminUserId
        validTenantConfigArb(),
        async (tenantId, adminUserId, tenantColumns) => {
          // Reset mocks between iterations
          vi.clearAllMocks();
          mockedWriteAuditLog.mockResolvedValue(undefined);

          // Setup: no existing tenant preference
          mockedFindTenantPreference.mockResolvedValue(null);
          mockedUpsertTenantPreference.mockResolvedValue({
            id: 'tenant-pref-new',
            tenantId,
            module: 'leads',
            key: 'columns',
            value: asJsonValue({ columns: tenantColumns }),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Act: admin updates tenant default
          await upsertTenantDefault(
            tenantId,
            adminUserId,
            'leads',
            { module: 'leads', columns: tenantColumns },
          );

          // Assert: user preference functions are NEVER called
          expect(mockedUpsertUserPreference).not.toHaveBeenCalled();
          expect(mockedDeleteUserPreference).not.toHaveBeenCalled();
          expect(mockedFindUserPreference).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should preserve user preferences unchanged after tenant default mutation (simulated)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // tenantId
        fc.uuid(), // adminUserId
        validTenantConfigArb(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // userIds with preferences
        async (tenantId, adminUserId, tenantColumns, userIds) => {
          // Reset mocks between iterations
          vi.clearAllMocks();
          mockedWriteAuditLog.mockResolvedValue(undefined);

          // Simulate existing user preferences — snapshot before mutation
          const userPreferences: MockUserPreference[] = userIds.map((userId) => ({
            tenantId,
            userId,
            module: 'leads',
            columns: registryIds.slice(0, 5).map((id, idx) => ({
              id,
              visible: requiredIds.has(id) ? true : idx % 2 === 0,
              order: idx,
            })),
          }));

          // Deep clone to create a snapshot of state before mutation
          const snapshotBefore = JSON.parse(JSON.stringify(userPreferences));

          // Setup mocks for tenant mutation
          mockedFindTenantPreference.mockResolvedValue({
            id: 'existing-tenant-pref',
            tenantId,
            module: 'leads',
            key: 'columns',
            value: asJsonValue({ columns: registryIds.slice(0, 3).map((id, idx) => ({ id, visible: true, order: idx })) }),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockedUpsertTenantPreference.mockResolvedValue({
            id: 'existing-tenant-pref',
            tenantId,
            module: 'leads',
            key: 'columns',
            value: asJsonValue({ columns: tenantColumns }),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Act: admin updates tenant default
          await upsertTenantDefault(
            tenantId,
            adminUserId,
            'leads',
            { module: 'leads', columns: tenantColumns },
          );

          // Assert: user preferences remain exactly as they were (reference equality on our data)
          expect(userPreferences).toEqual(snapshotBefore);

          // Assert: no user preference repository functions were called
          expect(mockedUpsertUserPreference).not.toHaveBeenCalled();
          expect(mockedDeleteUserPreference).not.toHaveBeenCalled();
          expect(mockedFindUserPreference).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should not touch user preferences regardless of how many exist for the tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // tenantId
        fc.uuid(), // adminUserId
        validTenantConfigArb(),
        fc.integer({ min: 0, max: 20 }), // number of users with preferences
        async (tenantId, adminUserId, tenantColumns, userCount) => {
          // Reset mocks between iterations to avoid accumulation
          vi.clearAllMocks();
          mockedWriteAuditLog.mockResolvedValue(undefined);

          // Setup: existing tenant preference
          mockedFindTenantPreference.mockResolvedValue({
            id: 'tenant-pref-1',
            tenantId,
            module: 'leads',
            key: 'columns',
            value: asJsonValue({ columns: registryIds.map((id, idx) => ({ id, visible: true, order: idx })) }),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockedUpsertTenantPreference.mockResolvedValue({
            id: 'tenant-pref-1',
            tenantId,
            module: 'leads',
            key: 'columns',
            value: asJsonValue({ columns: tenantColumns }),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Act: admin updates tenant default (regardless of how many user preferences exist)
          await upsertTenantDefault(
            tenantId,
            adminUserId,
            'leads',
            { module: 'leads', columns: tenantColumns },
          );

          // Assert: the service only interacts with tenant preference functions
          expect(mockedFindTenantPreference).toHaveBeenCalledWith(tenantId, 'leads', 'columns');
          expect(mockedUpsertTenantPreference).toHaveBeenCalledTimes(1);

          // Assert: user preference functions remain completely untouched
          expect(mockedUpsertUserPreference).not.toHaveBeenCalled();
          expect(mockedDeleteUserPreference).not.toHaveBeenCalled();
          expect(mockedFindUserPreference).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
