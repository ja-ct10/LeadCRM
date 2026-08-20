import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  BulkArchiveSchema,
  BulkReassignSchema,
  BulkStageChangeSchema,
} from '../deals.dto';

/**
 * Property-based tests for bulk operation size boundary validation.
 *
 * **Property 5: Bulk Operation Size Boundary**
 *
 * For any bulk operation request (archive, reassign, stage change) with a
 * `dealIds` array of length greater than 50, the schema SHALL reject the request.
 * For arrays of length 1 through 50, the schema SHALL accept the request.
 * Empty arrays (size 0) SHALL also be rejected.
 *
 * **Validates: Requirements 6.2, 7.4, 8.6**
 */

// ─────────────────────────────────────────────────────
// GENERATORS
// ─────────────────────────────────────────────────────

/**
 * Generate a non-empty string ID (simulates a deal UUID/CUID).
 */
const dealIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0);

/**
 * Generate an array of deal IDs with size within the accepted range (1-50).
 */
const validDealIdsArb = fc.array(dealIdArb, { minLength: 1, maxLength: 50 });

/**
 * Generate an array of deal IDs with size above the max (51-100).
 */
const oversizedDealIdsArb = fc.array(dealIdArb, { minLength: 51, maxLength: 100 });

// ─────────────────────────────────────────────────────
// Property 5: BulkArchiveSchema Size Boundary
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 5: Bulk Operation Size Boundary — BulkArchiveSchema', () => {
  it('should accept dealIds arrays of size 1-50', () => {
    fc.assert(
      fc.property(validDealIdsArb, (dealIds) => {
        const result = BulkArchiveSchema.safeParse({ dealIds });
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject dealIds arrays of size 51-100', () => {
    fc.assert(
      fc.property(oversizedDealIdsArb, (dealIds) => {
        const result = BulkArchiveSchema.safeParse({ dealIds });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject empty dealIds arrays (size 0)', () => {
    const result = BulkArchiveSchema.safeParse({ dealIds: [] });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────
// Property 5: BulkReassignSchema Size Boundary
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 5: Bulk Operation Size Boundary — BulkReassignSchema', () => {
  it('should accept dealIds arrays of size 1-50 with valid assignedUserId', () => {
    fc.assert(
      fc.property(validDealIdsArb, dealIdArb, (dealIds, assignedUserId) => {
        const result = BulkReassignSchema.safeParse({ dealIds, assignedUserId });
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject dealIds arrays of size 51-100 even with valid assignedUserId', () => {
    fc.assert(
      fc.property(oversizedDealIdsArb, dealIdArb, (dealIds, assignedUserId) => {
        const result = BulkReassignSchema.safeParse({ dealIds, assignedUserId });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject empty dealIds arrays (size 0)', () => {
    const result = BulkReassignSchema.safeParse({
      dealIds: [],
      assignedUserId: 'user-123',
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────
// Property 5: BulkStageChangeSchema Size Boundary
// ─────────────────────────────────────────────────────

describe('Feature: deals-module-modernization, Property 5: Bulk Operation Size Boundary — BulkStageChangeSchema', () => {
  it('should accept dealIds arrays of size 1-50 with valid stageId', () => {
    fc.assert(
      fc.property(validDealIdsArb, dealIdArb, (dealIds, stageId) => {
        const result = BulkStageChangeSchema.safeParse({ dealIds, stageId });
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject dealIds arrays of size 51-100 even with valid stageId', () => {
    fc.assert(
      fc.property(oversizedDealIdsArb, dealIdArb, (dealIds, stageId) => {
        const result = BulkStageChangeSchema.safeParse({ dealIds, stageId });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('should reject empty dealIds arrays (size 0)', () => {
    const result = BulkStageChangeSchema.safeParse({
      dealIds: [],
      stageId: 'stage-abc',
    });
    expect(result.success).toBe(false);
  });
});
