/**
 * useBulkSelection — Unit tests for bulk selection hook.
 *
 * Validates:
 * - Requirement 13.4: Maximum selection cap of 100 records
 * - Deduplicated toast notification on cap reached (3 seconds)
 * - Reject additional selections without modifying state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from '../use-bulk-selection';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
  },
}));

import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TestRow {
  id: string;
  name: string;
}

function createRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    name: `Row ${i}`,
  }));
}

function getRowId(row: TestRow): string {
  return row.id;
}

describe('useBulkSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic selection', () => {
    it('starts with empty selection', () => {
      const data = createRows(5);
      const { result } = renderHook(() =>
        useBulkSelection({ data, getRowId }),
      );

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.allSelected).toBe(false);
      expect(result.current.someSelected).toBe(false);
    });

    it('toggleRow selects a row', () => {
      const data = createRows(5);
      const { result } = renderHook(() =>
        useBulkSelection({ data, getRowId }),
      );

      act(() => {
        result.current.toggleRow('row-0');
      });

      expect(result.current.selectedCount).toBe(1);
      expect(result.current.isSelected('row-0')).toBe(true);
    });

    it('toggleRow deselects an already selected row', () => {
      const data = createRows(5);
      const { result } = renderHook(() =>
        useBulkSelection({ data, getRowId }),
      );

      act(() => {
        result.current.toggleRow('row-0');
      });
      act(() => {
        result.current.toggleRow('row-0');
      });

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isSelected('row-0')).toBe(false);
    });

    it('toggleAll selects all rows on current page', () => {
      const data = createRows(5);
      const { result } = renderHook(() =>
        useBulkSelection({ data, getRowId }),
      );

      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.selectedCount).toBe(5);
      expect(result.current.allSelected).toBe(true);
    });

    it('toggleAll deselects all when all are selected', () => {
      const data = createRows(5);
      const { result } = renderHook(() =>
        useBulkSelection({ data, getRowId }),
      );

      act(() => {
        result.current.toggleAll();
      });
      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.allSelected).toBe(false);
    });

    it('clearSelection removes all selections', () => {
      const data = createRows(5);
      const { result } = renderHook(() =>
        useBulkSelection({ data, getRowId }),
      );

      act(() => {
        result.current.toggleRow('row-0');
        result.current.toggleRow('row-1');
      });
      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('100-record cap enforcement', () => {
    it('allows selecting up to 100 records', () => {
      const data = createRows(100);
      const { result } = renderHook(() =>
        useBulkSelection({ data, getRowId }),
      );

      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.selectedCount).toBe(100);
      expect(result.current.isAtCap).toBe(true);
    });

    it('rejects selection beyond 100 via toggleRow', () => {
      const data = createRows(101);
      const selectedIds = new Set(
        Array.from({ length: 100 }, (_, i) => `row-${i}`),
      );
      const onSelectionChange = vi.fn();

      const { result } = renderHook(() =>
        useBulkSelection({
          data,
          getRowId,
          selectedIds,
          onSelectionChange,
        }),
      );

      act(() => {
        result.current.toggleRow('row-100');
      });

      // Should NOT call onSelectionChange — selection rejected
      expect(onSelectionChange).not.toHaveBeenCalled();
      expect(result.current.selectedCount).toBe(100);
    });

    it('shows toast notification when cap reached via toggleRow', () => {
      const data = createRows(101);
      const selectedIds = new Set(
        Array.from({ length: 100 }, (_, i) => `row-${i}`),
      );

      const { result } = renderHook(() =>
        useBulkSelection({
          data,
          getRowId,
          selectedIds,
          onSelectionChange: vi.fn(),
        }),
      );

      act(() => {
        result.current.toggleRow('row-100');
      });

      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining('100'),
        expect.objectContaining({
          duration: 3000,
          id: 'selection-cap',
        }),
      );
    });

    it('toast is deduplicated via id field', () => {
      const data = createRows(105);
      const selectedIds = new Set(
        Array.from({ length: 100 }, (_, i) => `row-${i}`),
      );

      const { result } = renderHook(() =>
        useBulkSelection({
          data,
          getRowId,
          selectedIds,
          onSelectionChange: vi.fn(),
        }),
      );

      // Attempt multiple selections beyond cap
      act(() => {
        result.current.toggleRow('row-100');
      });
      act(() => {
        result.current.toggleRow('row-101');
      });

      // All calls use the same 'selection-cap' id for deduplication
      const calls = (toast.info as ReturnType<typeof vi.fn>).mock.calls;
      for (const call of calls) {
        expect(call[1]).toHaveProperty('id', 'selection-cap');
      }
    });

    it('rejects toggleAll when already at cap', () => {
      const data = createRows(50);
      const selectedIds = new Set(
        Array.from({ length: 100 }, (_, i) => `external-${i}`),
      );
      const onSelectionChange = vi.fn();

      const { result } = renderHook(() =>
        useBulkSelection({
          data,
          getRowId,
          selectedIds,
          onSelectionChange,
        }),
      );

      act(() => {
        result.current.toggleAll();
      });

      // Should NOT modify state — already at cap
      expect(onSelectionChange).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining('100'),
        expect.objectContaining({ duration: 3000 }),
      );
    });

    it('toggleAll respects cap by selecting only up to remaining slots', () => {
      const data = createRows(50);
      const selectedIds = new Set(
        Array.from({ length: 90 }, (_, i) => `external-${i}`),
      );
      const onSelectionChange = vi.fn();

      const { result } = renderHook(() =>
        useBulkSelection({
          data,
          getRowId,
          selectedIds,
          onSelectionChange,
        }),
      );

      act(() => {
        result.current.toggleAll();
      });

      // Should add only 10 records (remaining = 100 - 90 = 10)
      expect(onSelectionChange).toHaveBeenCalled();
      const newSelection = onSelectionChange.mock.calls[0][0] as Set<string>;
      expect(newSelection.size).toBe(100);
    });

    it('allows deselection when at cap', () => {
      const data = createRows(100);
      const selectedIds = new Set(
        Array.from({ length: 100 }, (_, i) => `row-${i}`),
      );
      const onSelectionChange = vi.fn();

      const { result } = renderHook(() =>
        useBulkSelection({
          data,
          getRowId,
          selectedIds,
          onSelectionChange,
        }),
      );

      act(() => {
        result.current.toggleRow('row-50');
      });

      // Should allow deselection
      expect(onSelectionChange).toHaveBeenCalled();
      const newSelection = onSelectionChange.mock.calls[0][0] as Set<string>;
      expect(newSelection.size).toBe(99);
      expect(newSelection.has('row-50')).toBe(false);
    });

    it('isAtCap is true at exactly 100 selections', () => {
      const data = createRows(100);
      const selectedIds = new Set(
        Array.from({ length: 100 }, (_, i) => `row-${i}`),
      );

      const { result } = renderHook(() =>
        useBulkSelection({
          data,
          getRowId,
          selectedIds,
          onSelectionChange: vi.fn(),
        }),
      );

      expect(result.current.isAtCap).toBe(true);
    });

    it('isAtCap is false below 100 selections', () => {
      const data = createRows(50);
      const selectedIds = new Set(
        Array.from({ length: 99 }, (_, i) => `row-${i}`),
      );

      const { result } = renderHook(() =>
        useBulkSelection({
          data,
          getRowId,
          selectedIds,
          onSelectionChange: vi.fn(),
        }),
      );

      expect(result.current.isAtCap).toBe(false);
    });
  });
});
