import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ColumnConfig, ColumnConfigItem } from '@leadcrm/shared';

import {
  LEADS_COLUMN_REGISTRY,
  getRequiredColumnIds,
} from '../column-registry';
import { validateAgainstRegistry } from '../preferences.service';

/**
 * Property-based tests for validation logic in validateAgainstRegistry.
 *
 * **Validates: Requirements 5.2, 5.5, 15.1, 15.2, 15.4, 15.5**
 */

// ─────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────

const registryColumns = LEADS_COLUMN_REGISTRY.columns;
const registryIds = registryColumns.map((c) => c.id);
const registrySize = registryColumns.length; // 12
const requiredColumnIds = getRequiredColumnIds('leads'); // ['firstName', 'lastName', 'status']
const nonRequiredIds = registryIds.filter((id) => !new Set(requiredColumnIds).has(id));

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

/**
 * Generate a valid ColumnConfigItem for a given id with a valid order value.
 */
function validColumnItem(id: string, order: number, visible = true): ColumnConfigItem {
  return { id, visible, order };
}

/**
 * Generate a base valid config that includes all required columns as visible,
 * plus a random subset of non-required columns.
 */
function baseValidConfigArb(): fc.Arbitrary<ColumnConfigItem[]> {
  return fc
    .shuffledSubarray(nonRequiredIds, { minLength: 0, maxLength: nonRequiredIds.length })
    .map((selectedNonRequired) => {
      const allIds = [...requiredColumnIds, ...selectedNonRequired];
      return allIds.map((id, idx) => validColumnItem(id, idx, true));
    });
}

// ─────────────────────────────────────────────────────
// Property 3: Required Column Visibility Enforcement
// ─────────────────────────────────────────────────────

describe('Feature: manage-columns-persistence, Property 3: Required Column Visibility Enforcement', () => {
  it('should reject configs where at least one required column has visible: false', () => {
    // Generate configs that hide at least one required column
    const configWithHiddenRequiredArb = fc
      .record({
        // Pick at least 1 required column to hide
        hiddenRequired: fc.shuffledSubarray(requiredColumnIds, {
          minLength: 1,
          maxLength: requiredColumnIds.length,
        }),
        // Pick some non-required columns to include
        includedNonRequired: fc.shuffledSubarray(nonRequiredIds, {
          minLength: 0,
          maxLength: nonRequiredIds.length,
        }),
      })
      .map(({ hiddenRequired, includedNonRequired }) => {
        const columns: ColumnConfigItem[] = [];
        let order = 0;

        // Add all required columns — hidden ones get visible: false
        const hiddenSet = new Set(hiddenRequired);
        for (const reqId of requiredColumnIds) {
          columns.push({
            id: reqId,
            visible: !hiddenSet.has(reqId),
            order: order++,
          });
        }

        // Add non-required columns as visible
        for (const nrId of includedNonRequired) {
          columns.push({
            id: nrId,
            visible: true,
            order: order++,
          });
        }

        return columns;
      });

    fc.assert(
      fc.property(configWithHiddenRequiredArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = validateAgainstRegistry(config, 'leads');

        // Must be rejected
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        // At least one error should mention a required column being hidden
        const hasRequiredError = result.errors.some(
          (err) => err.reason.includes('required') && err.reason.includes('cannot be hidden'),
        );
        expect(hasRequiredError).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('should accept configs where all required columns have visible: true', () => {
    // Generate valid configs where required columns are visible
    const validConfigArb = baseValidConfigArb();

    fc.assert(
      fc.property(validConfigArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = validateAgainstRegistry(config, 'leads');

        // Should not have any required-column visibility errors
        const requiredVisibilityErrors = result.errors.filter(
          (err) => err.reason.includes('required') && err.reason.includes('cannot be hidden'),
        );
        expect(requiredVisibilityErrors).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────
// Property 12: Duplicate Column Rejection
// ─────────────────────────────────────────────────────

describe('Feature: manage-columns-persistence, Property 12: Duplicate Column Rejection', () => {
  it('should reject configs with duplicate column ids', () => {
    // Generate configs where at least one column id appears more than once
    const configWithDuplicatesArb = fc
      .record({
        // Pick a subset of columns for the base
        baseColumns: fc.shuffledSubarray(registryIds, {
          minLength: 2,
          maxLength: registryIds.length,
        }),
        // Pick at least one column to duplicate
        duplicateIndex: fc.nat(),
      })
      .map(({ baseColumns, duplicateIndex }) => {
        const columns: ColumnConfigItem[] = baseColumns.map((id, idx) => ({
          id,
          visible: true,
          order: idx,
        }));

        // Duplicate one column at the end
        const idxToDuplicate = duplicateIndex % baseColumns.length;
        columns.push({
          id: baseColumns[idxToDuplicate],
          visible: true,
          order: columns.length,
        });

        return columns;
      });

    fc.assert(
      fc.property(configWithDuplicatesArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = validateAgainstRegistry(config, 'leads');

        // Must be rejected
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        // At least one error should mention "Duplicate"
        const hasDuplicateError = result.errors.some((err) =>
          err.reason.toLowerCase().includes('duplicate'),
        );
        expect(hasDuplicateError).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('should accept configs with all unique column ids', () => {
    // Generate configs with unique ids (subsets of registry)
    const uniqueConfigArb = baseValidConfigArb();

    fc.assert(
      fc.property(uniqueConfigArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = validateAgainstRegistry(config, 'leads');

        // Should not have any duplicate errors
        const duplicateErrors = result.errors.filter((err) =>
          err.reason.toLowerCase().includes('duplicate'),
        );
        expect(duplicateErrors).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────
// Property 13: Payload Constraint Validation
// ─────────────────────────────────────────────────────

describe('Feature: manage-columns-persistence, Property 13: Payload Constraint Validation', () => {
  it('should reject configs with negative order values', () => {
    // Generate configs where at least one column has a negative order
    const configWithNegativeOrderArb = fc
      .record({
        baseColumns: fc.shuffledSubarray(registryIds, {
          minLength: 3,
          maxLength: registryIds.length,
        }),
        negativeOrder: fc.integer({ min: -1000, max: -1 }),
        negativeIndex: fc.nat(),
      })
      .map(({ baseColumns, negativeOrder, negativeIndex }) => {
        const columns: ColumnConfigItem[] = baseColumns.map((id, idx) => ({
          id,
          visible: true,
          order: idx,
        }));

        // Set one column to have a negative order
        const targetIdx = negativeIndex % columns.length;
        columns[targetIdx] = { ...columns[targetIdx], order: negativeOrder };

        return columns;
      });

    fc.assert(
      fc.property(configWithNegativeOrderArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = validateAgainstRegistry(config, 'leads');

        // Must be rejected
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        // At least one error should mention order
        const hasOrderError = result.errors.some(
          (err) => err.field.includes('order') && err.reason.includes('non-negative'),
        );
        expect(hasOrderError).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject configs with order values exceeding registry size', () => {
    // Generate configs where at least one column has order > registrySize
    const configWithExcessOrderArb = fc
      .record({
        baseColumns: fc.shuffledSubarray(registryIds, {
          minLength: 3,
          maxLength: registryIds.length,
        }),
        excessOrder: fc.integer({ min: registrySize + 1, max: 1000 }),
        excessIndex: fc.nat(),
      })
      .map(({ baseColumns, excessOrder, excessIndex }) => {
        const columns: ColumnConfigItem[] = baseColumns.map((id, idx) => ({
          id,
          visible: true,
          order: idx,
        }));

        // Set one column to have an order exceeding registry size
        const targetIdx = excessIndex % columns.length;
        columns[targetIdx] = { ...columns[targetIdx], order: excessOrder };

        return columns;
      });

    fc.assert(
      fc.property(configWithExcessOrderArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = validateAgainstRegistry(config, 'leads');

        // Must be rejected
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        // At least one error should mention order exceeding registry column count
        const hasExcessOrderError = result.errors.some(
          (err) => err.field.includes('order') && err.reason.includes('exceeds'),
        );
        expect(hasExcessOrderError).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject configs with more columns than registry size', () => {
    // Generate configs with column count > registrySize (12)
    // We achieve this by including all registry columns plus duplicates
    const configWithExcessColumnsArb = fc
      .integer({ min: 1, max: 10 })
      .map((extraCount) => {
        // Start with all registry columns
        const columns: ColumnConfigItem[] = registryIds.map((id, idx) => ({
          id,
          visible: true,
          order: idx,
        }));

        // Add extra columns (these will be invalid ids, but the size check happens first)
        for (let i = 0; i < extraCount; i++) {
          columns.push({
            id: `extraColumn${i}`,
            visible: true,
            order: registrySize + i,
          });
        }

        return columns;
      });

    fc.assert(
      fc.property(configWithExcessColumnsArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = validateAgainstRegistry(config, 'leads');

        // Must be rejected (either for excess columns or invalid ids — both are validation failures)
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        // Should have an error mentioning the column count exceeding registry size
        const hasExcessCountError = result.errors.some(
          (err) =>
            err.field === 'columns' &&
            err.reason.includes('registry only defines'),
        );
        expect(hasExcessCountError).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('should accept configs with valid order values within bounds', () => {
    // Generate configs where all orders are within [0, registrySize]
    const validOrderConfigArb = fc
      .shuffledSubarray(registryIds, { minLength: 3, maxLength: registryIds.length })
      .chain((ids) => {
        // Generate valid order values for each column
        return fc
          .array(fc.integer({ min: 0, max: registrySize }), {
            minLength: ids.length,
            maxLength: ids.length,
          })
          .map((orders) =>
            ids.map((id, idx) => ({
              id,
              visible: true,
              order: orders[idx],
            })),
          );
      });

    fc.assert(
      fc.property(validOrderConfigArb, (columns) => {
        const config: ColumnConfig = { module: 'leads', columns };
        const result = validateAgainstRegistry(config, 'leads');

        // Should not have any order-related errors
        const orderErrors = result.errors.filter((err) => err.field.includes('order'));
        expect(orderErrors).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});
