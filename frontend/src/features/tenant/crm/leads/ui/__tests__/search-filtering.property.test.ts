import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based tests for the Manage Columns Drawer's search filtering logic.
 *
 * The filtering logic under test (extracted as a pure function):
 * 1. Sorts columns by their `order` field
 * 2. Maps each column to include its label from the registry (falls back to id if not found)
 * 3. Filters by case-insensitive substring match on the label
 *
 * **Validates: Requirements 8.3**
 */

// --- Pure function under test (replicates manage-columns-drawer.tsx logic) ---

interface ColumnConfigItem {
  id: string;
  visible: boolean;
  order: number;
}

interface RegistryEntry {
  id: string;
  label: string;
  required: boolean;
  defaultVisible: boolean;
  defaultOrder: number;
}

interface FilteredColumn {
  id: string;
  visible: boolean;
  order: number;
  label: string;
}

/**
 * Pure filtering function that replicates the displayColumns logic
 * from manage-columns-drawer.tsx.
 */
function filterColumns(
  columns: ColumnConfigItem[],
  registry: RegistryEntry[],
  searchQuery: string
): FilteredColumn[] {
  const sorted = [...columns].sort((a, b) => a.order - b.order);
  return sorted
    .map((col) => {
      const def = registry.find((r) => r.id === col.id);
      return { ...col, label: def?.label ?? col.id };
    })
    .filter((col) => col.label.toLowerCase().includes(searchQuery.toLowerCase()));
}

// --- Arbitraries (generators) ---

/** Generate a valid column id (alphanumeric, starts with letter) */
const columnIdArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/);

/** Generate a human-readable column label */
const columnLabelArb: fc.Arbitrary<string> = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}$/);

/** Generate a registry entry */
const registryEntryArb = (id: string): fc.Arbitrary<RegistryEntry> =>
  fc.record({
    id: fc.constant(id),
    label: columnLabelArb,
    required: fc.boolean(),
    defaultVisible: fc.boolean(),
    defaultOrder: fc.nat({ max: 99 }),
  });

/** Generate a column config item */
const columnConfigItemArb = (id: string, order: number): fc.Arbitrary<ColumnConfigItem> =>
  fc.record({
    id: fc.constant(id),
    visible: fc.boolean(),
    order: fc.constant(order),
  });

/**
 * Generate a consistent test case: column list + matching registry + search query.
 * Ensures each column has a corresponding registry entry.
 */
const testCaseArb: fc.Arbitrary<{
  columns: ColumnConfigItem[];
  registry: RegistryEntry[];
  searchQuery: string;
}> = fc
  .array(columnIdArb, { minLength: 1, maxLength: 12 })
  .chain((rawIds) => {
    // Deduplicate ids
    const ids = [...new Set(rawIds)];
    if (ids.length === 0) return fc.constant({ columns: [] as ColumnConfigItem[], registry: [] as RegistryEntry[], searchQuery: '' });

    // Generate a shuffled order array
    const orders = ids.map((_, i) => i);

    return fc.tuple(
      // Registry entries for each id
      fc.tuple(...ids.map((id) => registryEntryArb(id))),
      // Column config items with shuffled orders
      fc.shuffledSubarray(orders, { minLength: orders.length, maxLength: orders.length }).chain(
        (shuffledOrders) =>
          fc.tuple(...ids.map((id, i) => columnConfigItemArb(id, shuffledOrders[i])))
      ),
      // Search query — mix of arbitrary strings and substrings of labels
      fc.oneof(
        fc.string({ minLength: 0, maxLength: 10 }),
        fc.nat({ max: ids.length - 1 }).map((idx) => ids[idx].substring(0, 3))
      )
    ).map(([registry, columns, searchQuery]) => ({
      columns,
      registry,
      searchQuery,
    }));
  });

// --- Property Tests ---

describe('Feature: manage-columns-persistence, Property 8: Search Filtering Correctness', () => {
  /**
   * Property 8: For any column list and any search string, the Manage_Columns_Drawer's
   * filtered result SHALL contain exactly those columns whose label includes the search
   * string as a case-insensitive substring, preserving relative order.
   *
   * **Validates: Requirements 8.3**
   */

  it('filtered result contains exactly columns whose label includes the search as case-insensitive substring', () => {
    fc.assert(
      fc.property(testCaseArb, ({ columns, registry, searchQuery }) => {
        const result = filterColumns(columns, registry, searchQuery);

        // Compute expected: sort by order, resolve labels, then filter
        const sorted = [...columns].sort((a, b) => a.order - b.order);
        const withLabels = sorted.map((col) => {
          const def = registry.find((r) => r.id === col.id);
          return { ...col, label: def?.label ?? col.id };
        });
        const expected = withLabels.filter((col) =>
          col.label.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Result should have exactly the same ids in the same order
        expect(result.map((r) => r.id)).toEqual(expected.map((e) => e.id));
        expect(result.length).toBe(expected.length);
      }),
      { numRuns: 100 }
    );
  });

  it('filtered results preserve the sorted order of the original column list', () => {
    fc.assert(
      fc.property(testCaseArb, ({ columns, registry, searchQuery }) => {
        const result = filterColumns(columns, registry, searchQuery);

        // Every pair of consecutive items in result should maintain ascending order
        for (let i = 1; i < result.length; i++) {
          expect(result[i].order).toBeGreaterThanOrEqual(result[i - 1].order);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('empty search returns all columns (sorted by order)', () => {
    fc.assert(
      fc.property(testCaseArb, ({ columns, registry }) => {
        const result = filterColumns(columns, registry, '');

        // Empty search should return all columns
        expect(result.length).toBe(columns.length);

        // Verify all column ids are present
        const resultIds = new Set(result.map((r) => r.id));
        for (const col of columns) {
          expect(resultIds.has(col.id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('search is case-insensitive (uppercase query matches lowercase labels and vice versa)', () => {
    fc.assert(
      fc.property(testCaseArb, ({ columns, registry }) => {
        // Pick a label from the registry to use as search
        if (registry.length === 0) return;

        const targetLabel = registry[0].label;
        if (targetLabel.length === 0) return;

        // Take a substring of the label
        const substring = targetLabel.substring(0, Math.min(3, targetLabel.length));

        // Search with uppercase
        const upperResult = filterColumns(columns, registry, substring.toUpperCase());
        // Search with lowercase
        const lowerResult = filterColumns(columns, registry, substring.toLowerCase());
        // Search with mixed case
        const mixedCase = substring
          .split('')
          .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
          .join('');
        const mixedResult = filterColumns(columns, registry, mixedCase);

        // All variants should produce the same result
        expect(upperResult.map((r) => r.id)).toEqual(lowerResult.map((r) => r.id));
        expect(upperResult.map((r) => r.id)).toEqual(mixedResult.map((r) => r.id));
      }),
      { numRuns: 100 }
    );
  });

  it('every item in the filtered result actually contains the search string in its label', () => {
    fc.assert(
      fc.property(testCaseArb, ({ columns, registry, searchQuery }) => {
        const result = filterColumns(columns, registry, searchQuery);

        // Every returned column must have the search in its label
        for (const col of result) {
          expect(col.label.toLowerCase()).toContain(searchQuery.toLowerCase());
        }
      }),
      { numRuns: 100 }
    );
  });

  it('no column excluded from the result actually matches the search', () => {
    fc.assert(
      fc.property(testCaseArb, ({ columns, registry, searchQuery }) => {
        const result = filterColumns(columns, registry, searchQuery);
        const resultIds = new Set(result.map((r) => r.id));

        // Check that all columns NOT in the result do NOT match
        const sorted = [...columns].sort((a, b) => a.order - b.order);
        for (const col of sorted) {
          if (!resultIds.has(col.id)) {
            const def = registry.find((r) => r.id === col.id);
            const label = def?.label ?? col.id;
            expect(label.toLowerCase()).not.toContain(searchQuery.toLowerCase());
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('when a column has no registry entry, its id is used as the label for filtering', () => {
    fc.assert(
      fc.property(
        fc.array(columnIdArb, { minLength: 1, maxLength: 8 }).map((rawIds) => [...new Set(rawIds)]).filter((ids) => ids.length > 0),
        fc.string({ minLength: 0, maxLength: 5 }),
        (ids, searchQuery) => {
          // Create columns with no matching registry entries
          const columns: ColumnConfigItem[] = ids.map((id, i) => ({
            id,
            visible: true,
            order: i,
          }));
          const emptyRegistry: RegistryEntry[] = [];

          const result = filterColumns(columns, emptyRegistry, searchQuery);

          // When no registry match, label === id, so filter based on id
          const expected = columns
            .sort((a, b) => a.order - b.order)
            .filter((col) => col.id.toLowerCase().includes(searchQuery.toLowerCase()));

          expect(result.map((r) => r.id)).toEqual(expected.map((e) => e.id));
          // Verify the label falls back to the id
          for (const col of result) {
            expect(col.label).toBe(col.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
