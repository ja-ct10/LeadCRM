'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SELECTION = 100;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseBulkSelectionOptions {
  /** Current page number — selection resets on change */
  currentPage: number;
  /** Current search term — selection resets on change */
  searchTerm?: string;
  /** Current sort key/direction — selection resets on change */
  sortKey?: string | null;
  /** Active filter hash/string — selection resets on change */
  filterHash?: string;
}

export interface UseBulkSelectionReturn {
  /** Currently selected record IDs */
  selectedIds: Set<string>;
  /** Number of selected records */
  selectedCount: number;
  /** Whether a specific record is selected */
  isSelected: (id: string) => boolean;
  /** Toggle a single record selection */
  toggle: (id: string) => void;
  /** Select a single record */
  select: (id: string) => void;
  /** Deselect a single record */
  deselect: (id: string) => void;
  /** Select all IDs on current page (up to MAX_SELECTION total) */
  selectAll: (pageIds: string[]) => void;
  /** Clear all selections */
  clearAll: () => void;
  /** Whether all given page IDs are selected */
  isAllSelected: (pageIds: string[]) => boolean;
  /** Whether some but not all given page IDs are selected */
  isIndeterminate: (pageIds: string[]) => boolean;
  /** Remove specific IDs from selection (e.g. after successful bulk action) */
  removeIds: (ids: string[]) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useBulkSelection — session-state-only selection management for CRM tables.
 *
 * Behavior:
 * - Tracks selected IDs in Set<string> (max 100)
 * - Resets on page navigation, filter/sort/search change, browser refresh
 * - Preserves across view switches, column changes, display mode changes
 * - Shows info toast when selection cap (100) is reached
 *
 * Requirements: 14.1, 14.2, 14.4
 */
export function useBulkSelection({
  currentPage,
  searchTerm = '',
  sortKey = null,
  filterHash = '',
}: UseBulkSelectionOptions): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Track previous reset-trigger values to detect changes
  const prevResetKeyRef = useRef<string>('');

  // Build a composite key from reset triggers
  const resetKey = `${currentPage}|${searchTerm}|${sortKey ?? ''}|${filterHash}`;

  // Reset selection when page/search/sort/filter changes
  useEffect(() => {
    if (prevResetKeyRef.current && prevResetKeyRef.current !== resetKey) {
      setSelectedIds(new Set());
    }
    prevResetKeyRef.current = resetKey;
  }, [resetKey]);

  const isSelected = useCallback(
    (id: string): boolean => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECTION) {
          toast.info(`Selection limit reached (${MAX_SELECTION} records maximum)`, {
            duration: 3000,
          });
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }, []);

  const select = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      if (prev.size >= MAX_SELECTION) {
        toast.info(`Selection limit reached (${MAX_SELECTION} records maximum)`, {
          duration: 3000,
        });
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const deselect = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((pageIds: string[]): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      let added = 0;
      for (const id of pageIds) {
        if (next.size >= MAX_SELECTION) {
          toast.info(`Selection limit reached (${MAX_SELECTION} records maximum)`, {
            duration: 3000,
          });
          break;
        }
        if (!next.has(id)) {
          next.add(id);
          added++;
        }
      }
      if (added === 0 && next.size === prev.size) return prev;
      return next;
    });
  }, []);

  const clearAll = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useCallback(
    (pageIds: string[]): boolean => {
      if (pageIds.length === 0) return false;
      return pageIds.every((id) => selectedIds.has(id));
    },
    [selectedIds],
  );

  const isIndeterminate = useCallback(
    (pageIds: string[]): boolean => {
      if (pageIds.length === 0) return false;
      const someSelected = pageIds.some((id) => selectedIds.has(id));
      const allSelected = pageIds.every((id) => selectedIds.has(id));
      return someSelected && !allSelected;
    },
    [selectedIds],
  );

  const removeIds = useCallback((ids: string[]): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (next.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggle,
    select,
    deselect,
    selectAll,
    clearAll,
    isAllSelected,
    isIndeterminate,
    removeIds,
  };
}
