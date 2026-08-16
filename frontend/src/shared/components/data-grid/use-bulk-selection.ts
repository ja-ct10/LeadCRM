/**
 * useBulkSelection — hook for managing row selection state.
 *
 * Provides select all, toggle individual, clear, and computed state
 * (allSelected, someSelected, count).
 */

'use client';

import { useState, useCallback, useMemo } from 'react';

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

  const toggleRow = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setSelectedIds(next);
    },
    [selectedIds, setSelectedIds],
  );

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(data.map((row) => getRowId(row)));
      setSelectedIds(allIds);
    }
  }, [allSelected, data, getRowId, setSelectedIds]);

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
    toggleRow,
    toggleAll,
    clearSelection,
    isSelected,
  };
}
