import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based tests for visible column rendering logic.
 *
 * The rendering logic under test (extracted from leads-page.tsx):
 * Given an effectiveColumns array, the table renders exactly those columns
 * where `visible === true`, sorted in ascending order of their `order` field.
 *
 * **Validates: Requirements 17.1**
 */

// --- Pure function under test (replicates leads-page.tsx visibleColumns logic) ---

interface ColumnConfigItem {
  id: string;
  visible: boolean;
  order: number;
}

/**
 * Pure function that computes which columns should be rendered in the table.
 * Extracted from the useMemo in leads-page.tsx (non-fallback path).
 */
function computeVisibleColumns(effectiveColumns: ColumnConfigItem[]): ColumnConfigItem[] {
  return [...effectiveColumns]
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order);
}

// --- Arbitraries (generators) ---

/** Generate a valid column id (alphanumeric, starts with letter) */
const columnIdArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/);

/** Generate a single column config item with a given id and order */
const columnConfigItemArb = (id: string, order: number): fc.Arbitrary<ColumnConfigItem> =>
  fc.record({
    id: fc.constant(id),
    visible: fc.boolean(),
    order: fc.constant(order),
  });

/**
 * Generate a valid effectiveColumns config: array of unique columns with
 * unique order values and mixed visibility states.
 */
const effectiveColumnsArb: fc.Arbitrary<ColumnConfigItem[]> = fc
  .array(columnIdArb, { minLength: 1, maxLength: 20 })
  .map((rawIds) => [...new Set(rawIds)])
  .filter((ids) => ids.length > 0)
  .chain((ids) => {
    // Generate shuffled unique order values for each column
    return fc
      .shuffledSubarray(
        Array.from({ length: ids.length }, (_, i) => i),
        { minLength: ids.length, maxLength: ids.length }
      )
      .chain((orders) =>
        fc.tuple(...ids.map((id, i) => columnConfigItemArb(id, orders[i])))
      );
  });

/**
 * Generate effectiveColumns that guarantee at least one visible column.
 */
const effectiveColumnsWithVisibleArb: fc.Arbitrary<ColumnConfigItem[]> = effectiveColumnsArb
  .map((cols) => {
    // Ensure at least one column is visible
    if (cols.every((c) => !c.visible) && cols.length > 0) {
      return [{ ...cols[0], visible: true }, ...cols.slice(1)];
    }
    return cols;
  });

/**
 * Generate effectiveColumns where ALL columns are hidden.
 */
const allHiddenColumnsArb: fc.Arbitrary<ColumnConfigItem[]> = fc
  .array(columnIdArb, { minLength: 1, maxLength: 12 })
  .map((rawIds) => [...new Set(rawIds)])
  .filter((ids) => ids.length > 0)
  .map((ids) =>
    ids.map((id, i) => ({ id, visible: false, order: i }))
  );

// --- Property Tests ---

describe('Feature: manage-columns-persistence, Property 14: Visible Column Rendering', () => {
  /**
   * Property 14: For any Effective_Columns configuration, the Leads table SHALL
   * render exactly the columns where visible === true, in ascending order of
   * their order field, and no other columns.
   *
   * **Validates: Requirements 17.1**
   */

  it('rendered columns are EXACTLY those with visible === true', () => {
    fc.assert(
      fc.property(effectiveColumnsArb, (effectiveColumns) => {
        const result = computeVisibleColumns(effectiveColumns);

        // Result should contain exactly the visible columns
        const expectedIds = new Set(
          effectiveColumns.filter((col) => col.visible).map((col) => col.id)
        );
        const resultIds = new Set(result.map((col) => col.id));

        expect(resultIds).toEqual(expectedIds);
      }),
      { numRuns: 100 }
    );
  });

  it('rendered columns are in ascending order of their order field', () => {
    fc.assert(
      fc.property(effectiveColumnsWithVisibleArb, (effectiveColumns) => {
        const result = computeVisibleColumns(effectiveColumns);

        // Every consecutive pair should be in ascending order
        for (let i = 1; i < result.length; i++) {
          expect(result[i].order).toBeGreaterThanOrEqual(result[i - 1].order);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('no column with visible === false appears in the rendered list', () => {
    fc.assert(
      fc.property(effectiveColumnsArb, (effectiveColumns) => {
        const result = computeVisibleColumns(effectiveColumns);

        // Every item in the result must have visible === true
        for (const col of result) {
          expect(col.visible).toBe(true);
        }

        // No hidden column id should appear in the result
        const hiddenIds = new Set(
          effectiveColumns.filter((col) => !col.visible).map((col) => col.id)
        );
        for (const col of result) {
          expect(hiddenIds.has(col.id)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all columns with visible === true appear in the rendered list', () => {
    fc.assert(
      fc.property(effectiveColumnsArb, (effectiveColumns) => {
        const result = computeVisibleColumns(effectiveColumns);
        const resultIds = new Set(result.map((col) => col.id));

        // Every visible column from the input must be present
        const visibleColumns = effectiveColumns.filter((col) => col.visible);
        for (const col of visibleColumns) {
          expect(resultIds.has(col.id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('length of rendered columns equals the count of columns with visible === true', () => {
    fc.assert(
      fc.property(effectiveColumnsArb, (effectiveColumns) => {
        const result = computeVisibleColumns(effectiveColumns);

        const visibleCount = effectiveColumns.filter((col) => col.visible).length;
        expect(result.length).toBe(visibleCount);
      }),
      { numRuns: 100 }
    );
  });

  it('when all columns are hidden, rendered list is empty', () => {
    fc.assert(
      fc.property(allHiddenColumnsArb, (effectiveColumns) => {
        const result = computeVisibleColumns(effectiveColumns);
        expect(result.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('computeVisibleColumns does not mutate the original array', () => {
    fc.assert(
      fc.property(effectiveColumnsArb, (effectiveColumns) => {
        const original = effectiveColumns.map((col) => ({ ...col }));

        computeVisibleColumns(effectiveColumns);

        // Original array should remain unchanged
        expect(effectiveColumns).toEqual(original);
      }),
      { numRuns: 100 }
    );
  });
});
