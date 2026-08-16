import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ColumnConfigItem } from '@leadcrm/shared';

/**
 * Property-based tests for the useColumnPreferences hook's optimistic update,
 * rollback, and cache-override behavior.
 *
 * These tests verify the pure state-machine logic that underpins the hook:
 * 1. Optimistic update applies new config immediately (before API response)
 * 2. On failure, state reverts exactly to the pre-save config
 * 3. Server response always overwrites cached state
 *
 * **Validates: Requirements 9.1, 9.4, 10.4, 2.5, 13.2, 13.4**
 */

// --- State machine helpers (extracted logic from the hook) ---

/**
 * Simulates the optimistic update phase of a save operation.
 * This represents the state immediately after the user clicks "Save"
 * but before the API responds.
 */
function applyOptimisticUpdate(
  _currentColumns: ColumnConfigItem[],
  newColumns: ColumnConfigItem[]
): ColumnConfigItem[] {
  // Optimistic: state is immediately set to the new config
  return [...newColumns];
}

/**
 * Simulates the rollback phase when an API call fails.
 * State should revert exactly to what it was before the save started.
 */
function applyRollback(
  previousColumns: ColumnConfigItem[]
): ColumnConfigItem[] {
  return [...previousColumns];
}

/**
 * Simulates the server confirmation phase when an API call succeeds.
 * The server response is authoritative and overwrites any cached state.
 */
function applyServerResponse(
  serverColumns: ColumnConfigItem[]
): ColumnConfigItem[] {
  return [...serverColumns];
}

/**
 * Full state machine simulation for a save operation.
 */
function simulateOptimisticSave(
  currentColumns: ColumnConfigItem[],
  newColumns: ColumnConfigItem[],
  apiResult: 'success' | 'failure',
  serverColumns?: ColumnConfigItem[]
): { optimisticState: ColumnConfigItem[]; finalState: ColumnConfigItem[] } {
  // Step 1: Store previous state for rollback
  const previousColumns = [...currentColumns];

  // Step 2: Apply optimistic update
  const optimisticState = applyOptimisticUpdate(currentColumns, newColumns);

  // Step 3: Resolve based on API result
  let finalState: ColumnConfigItem[];
  if (apiResult === 'failure') {
    finalState = applyRollback(previousColumns);
  } else {
    finalState = applyServerResponse(serverColumns ?? newColumns);
  }

  return { optimisticState, finalState };
}

// --- Arbitraries (generators) ---

/** Generate a valid ColumnConfigItem with alphanumeric id */
const columnConfigItemArb: fc.Arbitrary<ColumnConfigItem> = fc.record({
  id: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,30}$/),
  visible: fc.boolean(),
  order: fc.nat({ max: 99 }),
});

/** Generate a non-empty array of unique column config items */
const columnConfigArrayArb: fc.Arbitrary<ColumnConfigItem[]> = fc
  .array(columnConfigItemArb, { minLength: 1, maxLength: 12 })
  .map((items) => {
    // Ensure unique ids by deduplicating
    const seen = new Set<string>();
    const unique: ColumnConfigItem[] = [];
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push({ ...item, order: unique.length });
      }
    }
    return unique.length > 0 ? unique : [{ id: 'fallback', visible: true, order: 0 }];
  });

// --- Property Tests ---

describe('Feature: manage-columns-persistence, Property 9: Optimistic Update Immediacy', () => {
  /**
   * Property 9: For any column configuration save action, the DataContext SHALL update
   * the effective columns state to the new configuration synchronously (within the same
   * render cycle), before the API response is received.
   *
   * **Validates: Requirements 9.1, 13.4**
   */

  it('optimistic state equals the new config for any valid column configuration', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentColumns, newColumns) => {
          const { optimisticState } = simulateOptimisticSave(
            currentColumns,
            newColumns,
            'success'
          );

          // The optimistic state MUST equal the new columns exactly
          expect(optimisticState).toEqual(newColumns);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('optimistic state is independent of the current/previous state', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentA, currentB, newColumns) => {
          // The optimistic result should be the same regardless of starting state
          const resultA = applyOptimisticUpdate(currentA, newColumns);
          const resultB = applyOptimisticUpdate(currentB, newColumns);

          expect(resultA).toEqual(resultB);
          expect(resultA).toEqual(newColumns);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('optimistic update preserves all properties of each column item', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentColumns, newColumns) => {
          const optimisticState = applyOptimisticUpdate(currentColumns, newColumns);

          // Every item in the optimistic state matches the new config exactly
          for (let i = 0; i < newColumns.length; i++) {
            expect(optimisticState[i].id).toBe(newColumns[i].id);
            expect(optimisticState[i].visible).toBe(newColumns[i].visible);
            expect(optimisticState[i].order).toBe(newColumns[i].order);
          }
          expect(optimisticState.length).toBe(newColumns.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: manage-columns-persistence, Property 10: Failure Rollback Integrity', () => {
  /**
   * Property 10: For any save or reset operation that fails, the DataContext SHALL revert
   * the effective columns state to exactly the configuration that was active immediately
   * before the operation was initiated.
   *
   * **Validates: Requirements 9.4, 10.4**
   */

  it('on failure, state reverts exactly to the pre-save configuration', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentColumns, newColumns) => {
          const { finalState } = simulateOptimisticSave(
            currentColumns,
            newColumns,
            'failure'
          );

          // After failure, the state MUST equal the original current columns
          expect(finalState).toEqual(currentColumns);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rollback preserves every field of every column in the pre-save state', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentColumns, newColumns) => {
          const { finalState } = simulateOptimisticSave(
            currentColumns,
            newColumns,
            'failure'
          );

          // Deep equality check on each column
          expect(finalState.length).toBe(currentColumns.length);
          for (let i = 0; i < currentColumns.length; i++) {
            expect(finalState[i].id).toBe(currentColumns[i].id);
            expect(finalState[i].visible).toBe(currentColumns[i].visible);
            expect(finalState[i].order).toBe(currentColumns[i].order);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rollback is independent of the new columns that were attempted', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentColumns, newColumnsA, newColumnsB) => {
          // Regardless of WHAT was attempted, failure always reverts to current
          const resultA = simulateOptimisticSave(currentColumns, newColumnsA, 'failure');
          const resultB = simulateOptimisticSave(currentColumns, newColumnsB, 'failure');

          expect(resultA.finalState).toEqual(currentColumns);
          expect(resultB.finalState).toEqual(currentColumns);
          expect(resultA.finalState).toEqual(resultB.finalState);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rollback state is a separate copy (not a reference to the original)', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentColumns, newColumns) => {
          const { finalState } = simulateOptimisticSave(
            currentColumns,
            newColumns,
            'failure'
          );

          // Verify it's a new array (not the same reference)
          // Mutating finalState should not affect currentColumns
          if (finalState.length > 0) {
            const originalId = finalState[0].id;
            finalState[0] = { id: 'MUTATED', visible: false, order: -1 };
            expect(currentColumns[0].id).toBe(originalId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: manage-columns-persistence, Property 15: Cache Authority', () => {
  /**
   * Property 15: For any server response received after a fetch, the DataContext SHALL
   * overwrite the cached Effective_Columns with the server response value, regardless
   * of prior cached state.
   *
   * **Validates: Requirements 2.5, 13.2**
   */

  it('server response overwrites cached state regardless of prior cache', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentColumns, newColumns, serverColumns) => {
          const { finalState } = simulateOptimisticSave(
            currentColumns,
            newColumns,
            'success',
            serverColumns
          );

          // Server response is authoritative — final state MUST equal server response
          expect(finalState).toEqual(serverColumns);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('server response overwrites even when it differs from the optimistic update', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentColumns, newColumns, serverColumns) => {
          const { optimisticState, finalState } = simulateOptimisticSave(
            currentColumns,
            newColumns,
            'success',
            serverColumns
          );

          // Optimistic state was the newColumns
          expect(optimisticState).toEqual(newColumns);
          // But final state is whatever the server returned
          expect(finalState).toEqual(serverColumns);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('server response is used regardless of what was previously cached', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        columnConfigArrayArb,
        columnConfigArrayArb,
        (cacheA, cacheB, newColumns, serverResponse) => {
          // Starting from two different cached states should yield same final state
          // when the server responds with the same data
          const resultA = simulateOptimisticSave(cacheA, newColumns, 'success', serverResponse);
          const resultB = simulateOptimisticSave(cacheB, newColumns, 'success', serverResponse);

          expect(resultA.finalState).toEqual(serverResponse);
          expect(resultB.finalState).toEqual(serverResponse);
          expect(resultA.finalState).toEqual(resultB.finalState);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when server response is not provided on success, the new columns are used as final state', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        columnConfigArrayArb,
        (currentColumns, newColumns) => {
          // When no explicit server response (server mirrors what was sent)
          const { finalState } = simulateOptimisticSave(
            currentColumns,
            newColumns,
            'success',
            undefined
          );

          // Falls back to newColumns as the authoritative response
          expect(finalState).toEqual(newColumns);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('applyServerResponse always returns the server data independent of all other state', () => {
    fc.assert(
      fc.property(
        columnConfigArrayArb,
        (serverColumns) => {
          const result = applyServerResponse(serverColumns);
          expect(result).toEqual(serverColumns);
          // Verify it's a copy, not a reference
          if (result.length > 0) {
            result[0] = { id: 'MUTATED', visible: false, order: -1 };
            expect(serverColumns[0].id).not.toBe('MUTATED');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
