/**
 * useColumnDragReorder — reusable hook for drag-and-drop column reordering in DataGrid.
 *
 * Uses @dnd-kit/core + @dnd-kit/sortable to enable header cell dragging.
 * Integrates with the column preference system — calls onReorder callback
 * with the new column order after a drop.
 *
 * Usage:
 *   const { sensors, handleDragEnd, columnIds } = useColumnDragReorder({
 *     columns: gridColumns,
 *     onReorder: (newColumnOrder) => saveColumns(newColumnOrder),
 *   });
 *
 *   // Wrap header row in DndContext + SortableContext
 */

'use client';

import { useCallback, useMemo } from 'react';
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import type { ColumnConfigItem } from '@leadcrm/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseColumnDragReorderOptions {
  /** Current effective columns (visible, sorted by order) */
  effectiveColumns: ColumnConfigItem[];
  /** Callback when columns are reordered — receives full updated columns array */
  onReorder: (columns: ColumnConfigItem[]) => void;
  /** Column IDs that cannot be dragged (e.g. pinned/required columns) */
  lockedColumns?: string[];
  /** Disable drag entirely */
  disabled?: boolean;
}

export interface UseColumnDragReorderReturn {
  /** DnD sensors configured for pointer + keyboard */
  sensors: ReturnType<typeof useSensors>;
  /** Handler for DragEnd event — computes new order and calls onReorder */
  handleDragEnd: (event: DragEndEvent) => void;
  /** Ordered column IDs for SortableContext items prop */
  sortableColumnIds: string[];
  /** Whether a specific column is draggable */
  isDraggable: (columnId: string) => boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useColumnDragReorder({
  effectiveColumns,
  onReorder,
  lockedColumns = [],
  disabled = false,
}: UseColumnDragReorderOptions): UseColumnDragReorderReturn {
  // Configure sensors with 5px activation distance to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Sortable IDs — only include draggable (non-locked) columns
  const sortableColumnIds = useMemo(
    () => effectiveColumns.map((col) => col.id),
    [effectiveColumns],
  );

  const lockedSet = useMemo(() => new Set(lockedColumns), [lockedColumns]);

  const isDraggable = useCallback(
    (columnId: string): boolean => {
      if (disabled) return false;
      return !lockedSet.has(columnId);
    },
    [disabled, lockedSet],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // Don't allow dragging locked columns or dropping onto locked positions
      if (lockedSet.has(activeId) || lockedSet.has(overId)) return;

      const oldIndex = effectiveColumns.findIndex((col) => col.id === activeId);
      const newIndex = effectiveColumns.findIndex((col) => col.id === overId);

      if (oldIndex === -1 || newIndex === -1) return;

      // Compute reordered array
      const reordered = arrayMove(effectiveColumns, oldIndex, newIndex);

      // Reassign sequential order values (0-based)
      const updated: ColumnConfigItem[] = reordered.map((col, idx) => ({
        ...col,
        order: idx,
      }));

      onReorder(updated);
    },
    [effectiveColumns, onReorder, lockedSet],
  );

  return {
    sensors,
    handleDragEnd,
    sortableColumnIds,
    isDraggable,
  };
}
