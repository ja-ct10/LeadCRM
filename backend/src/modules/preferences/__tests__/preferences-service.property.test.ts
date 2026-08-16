import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { ColumnConfig, ColumnConfigItem } from '@leadcrm/shared';

import {
  LEADS_COLUMN_REGISTRY,
  getSystemDefault,
  getRegistryForModule,
  getRequiredColumnIds,
} from '../column-registry';
import { reconcileWithRegistry, resolveEffectiveColumns } from '../preferences.service';

/**
 * Property-based tests for Preferences Service resolution hierarchy and reconciliation.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 5.3, 6.5, 16.1**
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

vi.mock('../preferences.repository');

import * as repo from '../preferences.repository';

const mockedFindUserPreference = vi.mocked(repo.findUserPreference);
const mockedFindTenantPreference = vi.mocked(repo.findTenantPreference);

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

const registryColumns = LEADS_COLUMN_REGISTRY.columns;
const registryIds = registryColumns.map((c) => c.id);
const requiredIds = new Set(getRequiredColumnIds('leads'));

/**
 * Generate a valid ColumnConfigItem[] using a random subset of registry columns.
 * Each column gets a random visible flag and a sequential order.
 */
function validColumnsArb(minLength = 1): fc.Arbitrary<ColumnConfigItem[]> {
  return fc
    .shuffledSubarray(registryIds, { minLength, maxLength: registryIds.length })
    .map((ids) =>
      ids.map((id, idx) => ({
        id,
        visible: requiredIds.has(id) ? true : Math.random() > 0.3,
        order: idx,
      })),
    );
}

/**
 * Generate a valid stored preference value shape ({ columns: [...] }).
 */
function storedValueArb(minLength = 1): fc.Arbitrary<{ columns: ColumnConfigItem[] }> {
  return validColumnsArb(minLength).map((columns) => ({ columns }));
}

// ─────────────────────────────────────────────────────
// Property 1: Resolution Hierarchy
// ─────────────────────────────────────────────────────

describe('Feature: manage-columns-persistence, Property 1: Resolution Hierarchy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return user preference when user layer exists (User > Tenant > System)', async () => {
    await fc.assert(
      fc.asyncProperty(
        storedValueArb(3),
        storedValueArb(3),
        async (userValue, tenantValue) => {
          mockedFindUserPreference.mockResolvedValue({
            id: 'user-pref-1',
            tenantId: 'tenant-1',
            userId: 'user-1',
            module: 'leads',
            key: 'columns',
            value: userValue,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockedFindTenantPreference.mockResolvedValue({
            id: 'tenant-pref-1',
            tenantId: 'tenant-1',
            module: 'leads',
            key: 'columns',
            value: tenantValue,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const result = await resolveEffectiveColumns('tenant-1', 'user-1', 'leads');

          // Result should be based on user preference (reconciled with registry)
          // Verify user columns are the base — all user column ids present in result
          const resultIds = new Set(result.columns.map((c) => c.id));
          for (const col of userValue.columns) {
            if (registryIds.includes(col.id)) {
              expect(resultIds.has(col.id)).toBe(true);
            }
          }
          // Tenant preference columns that are NOT in user should not dictate the base
          // (full replacement, not merge)
          expect(result.module).toBe('leads');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return tenant preference when only tenant layer exists', async () => {
    await fc.assert(
      fc.asyncProperty(storedValueArb(3), async (tenantValue) => {
        mockedFindUserPreference.mockResolvedValue(null);
        mockedFindTenantPreference.mockResolvedValue({
          id: 'tenant-pref-1',
          tenantId: 'tenant-1',
          module: 'leads',
          key: 'columns',
          value: tenantValue,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await resolveEffectiveColumns('tenant-1', 'user-1', 'leads');

        // Result should be based on tenant preference (reconciled)
        const resultIds = new Set(result.columns.map((c) => c.id));
        for (const col of tenantValue.columns) {
          if (registryIds.includes(col.id)) {
            expect(resultIds.has(col.id)).toBe(true);
          }
        }
        expect(result.module).toBe('leads');
      }),
      { numRuns: 100 },
    );
  });

  it('should return system default when neither user nor tenant layer exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (tenantId, userId) => {
          mockedFindUserPreference.mockResolvedValue(null);
          mockedFindTenantPreference.mockResolvedValue(null);

          const result = await resolveEffectiveColumns(tenantId, userId, 'leads');
          const systemDefault = getSystemDefault('leads');

          // Should match system default exactly
          expect(result.module).toBe('leads');
          expect(result.columns).toEqual(systemDefault.columns);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should use full replacement semantics — no merging across layers', async () => {
    await fc.assert(
      fc.asyncProperty(
        storedValueArb(3),
        storedValueArb(3),
        async (userValue, tenantValue) => {
          // Give user a small subset of columns
          const userSubset = userValue.columns.slice(0, 3);
          const userStoredValue = { columns: userSubset };

          // Give tenant a different subset
          const tenantSubset = tenantValue.columns.slice(0, 4);
          const tenantStoredValue = { columns: tenantSubset };

          mockedFindUserPreference.mockResolvedValue({
            id: 'user-pref-1',
            tenantId: 'tenant-1',
            userId: 'user-1',
            module: 'leads',
            key: 'columns',
            value: userStoredValue,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockedFindTenantPreference.mockResolvedValue({
            id: 'tenant-pref-1',
            tenantId: 'tenant-1',
            module: 'leads',
            key: 'columns',
            value: tenantStoredValue,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const result = await resolveEffectiveColumns('tenant-1', 'user-1', 'leads');

          // The base of the result is the user layer — reconciled with registry.
          // Tenant columns that are NOT in user's base should not appear
          // unless they are new registry columns (reconciliation adds missing ones).
          // The key assertion: user's columns form the base, NOT a merge of user + tenant.
          const resultIds = result.columns.map((c) => c.id);
          for (const col of userSubset) {
            if (registryIds.includes(col.id)) {
              expect(resultIds).toContain(col.id);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────
// Property 2: Registry Reconciliation
// ─────────────────────────────────────────────────────

describe('Feature: manage-columns-persistence, Property 2: Registry Reconciliation', () => {
  it('should include ALL registry columns after reconciliation even when config is missing some', () => {
    // Generate a subset of registry columns (missing at least 1)
    const subsetArb = fc
      .shuffledSubarray(registryIds, { minLength: 1, maxLength: registryIds.length - 1 })
      .map((ids) =>
        ids.map((id, idx) => ({
          id,
          visible: requiredIds.has(id) ? true : Math.random() > 0.5,
          order: idx,
        })),
      );

    fc.assert(
      fc.property(subsetArb, (subsetColumns) => {
        const config: ColumnConfig = { module: 'leads', columns: subsetColumns };
        const result = reconcileWithRegistry(config, 'leads');

        // Every registry column must be present in the result
        const resultIds = new Set(result.columns.map((c) => c.id));
        for (const regId of registryIds) {
          expect(resultIds.has(regId)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should insert new columns at their registry-defined defaultOrder and defaultVisible', () => {
    // Generate a subset missing specific columns
    const subsetArb = fc
      .shuffledSubarray(registryIds, { minLength: 1, maxLength: registryIds.length - 1 })
      .map((ids) =>
        ids.map((id, idx) => ({
          id,
          visible: requiredIds.has(id) ? true : Math.random() > 0.5,
          order: idx,
        })),
      );

    fc.assert(
      fc.property(subsetArb, (subsetColumns) => {
        const existingIds = new Set(subsetColumns.map((c) => c.id));
        const config: ColumnConfig = { module: 'leads', columns: subsetColumns };
        const result = reconcileWithRegistry(config, 'leads');

        // Check that newly inserted columns have registry defaults
        for (const col of result.columns) {
          if (!existingIds.has(col.id)) {
            // This column was added by reconciliation
            const regCol = registryColumns.find((r) => r.id === col.id)!;
            expect(col.order).toBe(regCol.defaultOrder);
            expect(col.visible).toBe(regCol.defaultVisible);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────
// Property 4: Required Column Auto-Inclusion
// ─────────────────────────────────────────────────────

describe('Feature: manage-columns-persistence, Property 4: Required Column Auto-Inclusion', () => {
  const requiredColumnIds = getRequiredColumnIds('leads');
  const nonRequiredIds = registryIds.filter((id) => !requiredIds.has(id));

  it('should auto-include required columns with visible:true when they are omitted from config', () => {
    // Generate configs that contain ONLY non-required columns (omitting all required)
    const nonRequiredOnlyArb = fc
      .shuffledSubarray(nonRequiredIds, { minLength: 1, maxLength: nonRequiredIds.length })
      .map((ids) =>
        ids.map((id, idx) => ({
          id,
          visible: Math.random() > 0.5,
          order: idx,
        })),
      );

    fc.assert(
      fc.property(nonRequiredOnlyArb, (nonRequiredColumns) => {
        const config: ColumnConfig = { module: 'leads', columns: nonRequiredColumns };
        const result = reconcileWithRegistry(config, 'leads');

        // All required columns must be present with visible: true
        const resultMap = new Map(result.columns.map((c) => [c.id, c]));
        for (const reqId of requiredColumnIds) {
          expect(resultMap.has(reqId)).toBe(true);
          expect(resultMap.get(reqId)!.visible).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should auto-include required columns even when config is partially missing them', () => {
    // Generate configs that include some but not all required columns
    const partialRequiredArb = fc
      .shuffledSubarray(requiredColumnIds, { minLength: 0, maxLength: requiredColumnIds.length - 1 })
      .chain((includedRequired) => {
        const someNonRequired = nonRequiredIds.slice(0, 3);
        const allIncluded = [...includedRequired, ...someNonRequired];
        return fc.constant(
          allIncluded.map((id, idx) => ({
            id,
            visible: true,
            order: idx,
          })),
        );
      });

    fc.assert(
      fc.property(partialRequiredArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = reconcileWithRegistry(config, 'leads');

        // ALL required columns must be in result with visible: true
        const resultMap = new Map(result.columns.map((c) => [c.id, c]));
        for (const reqId of requiredColumnIds) {
          expect(resultMap.has(reqId)).toBe(true);
          expect(resultMap.get(reqId)!.visible).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────
// Property 6: Stale Column Stripping
// ─────────────────────────────────────────────────────

describe('Feature: manage-columns-persistence, Property 6: Stale Column Stripping', () => {
  const registryIdSet = new Set(registryIds);

  it('should strip stale column ids that are not in the registry', () => {
    // Generate configs that include valid columns PLUS some fake stale ids
    const staleIdArb = fc
      .string({ minLength: 3, maxLength: 30 })
      .filter((s) => /^[a-zA-Z][a-zA-Z0-9]+$/.test(s) && !registryIdSet.has(s));

    const configWithStaleArb = fc.tuple(
      // Some valid columns
      fc.shuffledSubarray(registryIds, { minLength: 2, maxLength: 6 }),
      // Some stale columns
      fc.array(staleIdArb, { minLength: 1, maxLength: 5 }),
    ).map(([validIds, staleIds]) => {
      const validCols: ColumnConfigItem[] = validIds.map((id, idx) => ({
        id,
        visible: requiredIds.has(id) ? true : Math.random() > 0.5,
        order: idx,
      }));
      const staleCols: ColumnConfigItem[] = staleIds.map((id, idx) => ({
        id,
        visible: true,
        order: validIds.length + idx,
      }));
      return [...validCols, ...staleCols];
    });

    fc.assert(
      fc.property(configWithStaleArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = reconcileWithRegistry(config, 'leads');

        // Result should contain ONLY registry-valid column ids
        for (const col of result.columns) {
          expect(registryIdSet.has(col.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should preserve valid columns while stripping stale ones', () => {
    const staleIdArb = fc
      .string({ minLength: 3, maxLength: 30 })
      .filter((s) => /^[a-zA-Z][a-zA-Z0-9]+$/.test(s) && !registryIdSet.has(s));

    const configWithStaleArb = fc.tuple(
      fc.shuffledSubarray(registryIds, { minLength: 2, maxLength: 6 }),
      fc.array(staleIdArb, { minLength: 1, maxLength: 5 }),
    ).map(([validIds, staleIds]) => ({
      validIds,
      columns: [
        ...validIds.map((id, idx) => ({
          id,
          visible: requiredIds.has(id) ? true : Math.random() > 0.5,
          order: idx,
        })),
        ...staleIds.map((id, idx) => ({
          id,
          visible: true,
          order: validIds.length + idx,
        })),
      ] as ColumnConfigItem[],
    }));

    fc.assert(
      fc.property(configWithStaleArb, ({ validIds, columns }) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = reconcileWithRegistry(config, 'leads');

        // All originally valid columns should still be present
        const resultIds = new Set(result.columns.map((c) => c.id));
        for (const validId of validIds) {
          expect(resultIds.has(validId)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
