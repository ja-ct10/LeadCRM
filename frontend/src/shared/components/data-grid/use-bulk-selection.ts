/**
 * useBulkSelection — hook for managing row selection state.
 *
 * Provides select all, toggle individual, clear, and computed state
 * (allSelected, someSelected, count).
 *
 * Enforces a maximum selection cap of 100 records (R01).
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

const MAX_SELECTION = 100;

interface UseBulkSelectionOptions<T> {
  /** All row data (to support "select all") */
  data: T[];
  /** Row ID extractor */
  getRowId: (row: T) => string;
  /** External selected IDs (controlled mode) */
  selectedIds?: Set<string>;
  /** External selection change handler (controlled mode) */
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

interface UseBulkSelectionReturn {
  /** Current set of selected IDs */
  selectedIds: Set<string>;
  /** Whether all rows are selected */
  allSelected: boolean;
  /** Whether some (but not all) rows are selected */
  someSelected: boolean;
  /** Number of selected rows */
  selectedCount: number;
  /** Whether selection has reached the maximum cap */
  isAtCap: boolean;
  /** Toggle a single row's selection */
  toggleRow: (id: string) => void;
  /** Select or deselect all rows */
  toggleAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if a specific row is selected */
  isSelected: (id: string) => boolean;
}

export function useBulkSelection<T>({
  data,
  getRowId,
  selectedIds: controlledIds,
  onSelectionChange,
}: UseBulkSelectionOptions<T>): UseBulkSelectionReturn {
  const [internalIds, setInternalIds] = useState<Set<string>>(new Set());

  // Use controlled or internal state
  const selectedIds = controlledIds ?? internalIds;

  const setSelectedIds = useCallback(
    (next: Set<string>) => {
      if (onSelectionChange) {
        onSelectionChange(next);
      } else {
        setInternalIds(next);
      }
    },
    [onSelectionChange],
  );

  const allSelected = useMemo(
    () => data.length > 0 && data.every((row) => selectedIds.has(getRowId(row))),
    [data, selectedIds, getRowId],
  );

  const someSelected = useMemo(
    () => !allSelected && data.some((row) => selectedIds.has(getRowId(row))),
    [data, selectedIds, getRowId, allSelected],
  );

  const selectedCount = selectedIds.size;

  const isAtCap = selectedIds.size >= MAX_SELECTION;

  const toggleRow = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // About to add a new record — check cap
        if (selectedIds.size >= MAX_SELECTION) {
          toast.info(`Selection is limited to ${MAX_SELECTION} records`, {
            duration: 3000,
            id: 'selection-cap',
          });
          return;
        }
        next.add(id);
      }
      setSelectedIds(next);
    },
    [selectedIds, setSelectedIds],
  );

  const toggleAll = useCallback(() => {
    if (allSelected) {
      // Deselect all current page rows
      const pageIds = new Set(data.map((row) => getRowId(row)));
      const next = new Set(selectedIds);
      for (const id of pageIds) {
        next.delete(id);
      }
      setSelectedIds(next);
    } else {
      // Select all current page rows — respect cap
      const pageIds = data.map((row) => getRowId(row));
      const remaining = MAX_SELECTION - selectedIds.size;

      if (remaining <= 0) {
        toast.info(`Selection is limited to ${MAX_SELECTION} records`, {
          duration: 3000,
          id: 'selection-cap',
        });
        return;
      }

      const toAdd = pageIds.filter((id) => !selectedIds.has(id)).slice(0, remaining);
      const next = new Set([...selectedIds, ...toAdd]);

      if (toAdd.length < pageIds.filter((id) => !selectedIds.has(id)).length) {
        toast.info(`Selection limited to ${MAX_SELECTION} records. ${next.size} selected.`, {
          duration: 3000,
          id: 'selection-cap',
        });
      }

      setSelectedIds(next);
    }
  }, [allSelected, data, getRowId, selectedIds, setSelectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, [setSelectedIds]);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  return {
    selectedIds,
    allSelected,
    someSelected,
    selectedCount,
    isAtCap,
    toggleRow,
    toggleAll,
    clearSelection,
    isSelected,
  };
}
