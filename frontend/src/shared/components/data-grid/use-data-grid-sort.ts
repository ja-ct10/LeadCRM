/**
 * useDataGridSort — hook for managing multi-column sort state.
 *
 * Handles the header-click cycle: none → asc → desc → none.
 * Provides a client-side sort comparator for in-memory sorting.
 */

'use client';

import { useCallback, useMemo } from 'react';
import type { SortState, SortDirection, DataGridColumnDef } from './types';

interface UseDataGridSortOptions<T> {
  /** Current sort state */
  sort: SortState | null;
  /** Sort change handler */
  onSortChange: (sort: SortState | null) => void;
  /** Column definitions (for custom comparators) */
  columns: DataGridColumnDef<T>[];
  /** Data to sort */
  data: T[];
}

interface UseDataGridSortReturn<T> {
  /** Sorted data array */
  sortedData: T[];
  /** Handle header click — cycles through sort states */
  handleHeaderClick: (columnId: string) => void;
  /** Get current sort direction for a column (null if not sorted) */
  getSortDirection: (columnId: string) => SortDirection | null;
}

export function useDataGridSort<T>({
  sort,
  onSortChange,
  columns,
  data,
}: UseDataGridSortOptions<T>): UseDataGridSortReturn<T> {
  const handleHeaderClick = useCallback(
    (columnId: string) => {
      const column = columns.find((col) => col.id === columnId);
      if (!column?.sortable) return;

      if (!sort || sort.field !== columnId) {
        // New column → ascending
        onSortChange({ field: columnId, direction: 'asc' });
      } else if (sort.direction === 'asc') {
        // Same column asc → descending
        onSortChange({ field: columnId, direction: 'desc' });
      } else {
        // Same column desc → clear sort
        onSortChange(null);
      }
    },
    [sort, onSortChange, columns],
  );

  const getSortDirection = useCallback(
    (columnId: string): SortDirection | null => {
      if (!sort || sort.field !== columnId) return null;
      return sort.direction;
    },
    [sort],
  );

  const sortedData = useMemo(() => {
    if (!sort) return data;

    const column = columns.find((col) => col.id === sort.field);
    if (!column) return data;

    const sorted = [...data].sort((a, b) => {
      // Use custom comparator if provided
      if (column.comparator) {
        const result = column.comparator(a, b);
        return sort.direction === 'asc' ? result : -result;
      }

      // Default string comparison via accessor
      const aVal = column.accessor(a);
      const bVal = column.accessor(b);

      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Numeric comparison for numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String comparison with locale-aware sorting
      const comparison = String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sort.direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [data, sort, columns]);

  return { sortedData, handleHeaderClick, getSortDirection };
}
