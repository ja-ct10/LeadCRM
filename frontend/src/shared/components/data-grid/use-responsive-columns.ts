/**
 * useResponsiveColumns — Responsive column hiding hook for DataGrid.
 *
 * Monitors the DataGrid container width via ResizeObserver and determines
 * which columns should be visible based on their responsive priority.
 *
 * Algorithm:
 * 1. Measure container width via ResizeObserver (debounced 200ms)
 * 2. Subtract fixed widths (checkbox, actions, scrollbar, settings)
 * 3. Always include `responsivePriority: 'required'` columns
 * 4. Add remaining columns in priority order: high → medium → low
 * 5. Stop adding when available width is exhausted
 * 6. If required columns alone exceed width → enable horizontal scroll
 *
 * @example
 * ```tsx
 * const { visibleColumns, hiddenCount } = useResponsiveColumns({
 *   columns: gridColumns,
 *   containerRef,
 *   fixedWidths: { checkbox: 44, actions: 100, scrollbar: 17 },
 *   enabled: true,
 * });
 * ```
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { DataGridColumnDef } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 200;
const DEFAULT_COLUMN_WIDTH = 180;
const SETTINGS_WIDTH = 36;

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseResponsiveColumnsOptions<T = Record<string, unknown>> {
  /** All columns to consider for responsive hiding */
  columns: DataGridColumnDef<T>[];
  /** Ref to the DataGrid container element */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Fixed widths to subtract from available space */
  fixedWidths: { checkbox: number; actions: number; scrollbar: number };
  /** Whether responsive column hiding is enabled */
  enabled: boolean;
}

interface UseResponsiveColumnsReturn<T = Record<string, unknown>> {
  /** Columns that fit within the available width */
  visibleColumns: DataGridColumnDef<T>[];
  /** Number of columns hidden due to space constraints */
  hiddenCount: number;
}

// ─── Priority Order Map ──────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  required: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Hook Implementation ─────────────────────────────────────────────────────

export function useResponsiveColumns<T = Record<string, unknown>>({
  columns,
  containerRef,
  fixedWidths,
  enabled,
}: UseResponsiveColumnsOptions<T>): UseResponsiveColumnsReturn<T> {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── ResizeObserver with debounce ──────────────────────────────────────
  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const element = containerRef.current;
    const observer = new ResizeObserver(handleResize);
    observer.observe(element);

    // Set initial width
    setContainerWidth(element.getBoundingClientRect().width);

    return () => {
      observer.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, containerRef, handleResize]);

  // ─── Column Calculation ────────────────────────────────────────────────

  if (!enabled || containerWidth === 0) {
    return { visibleColumns: columns, hiddenCount: 0 };
  }

  // Subtract fixed widths from available space
  const availableWidth =
    containerWidth -
    fixedWidths.checkbox -
    fixedWidths.actions -
    fixedWidths.scrollbar -
    SETTINGS_WIDTH;

  // Separate required columns from optional ones
  const requiredColumns: DataGridColumnDef<T>[] = [];
  const optionalColumns: DataGridColumnDef<T>[] = [];

  for (const col of columns) {
    if (col.responsivePriority === 'required' || col.required) {
      requiredColumns.push(col);
    } else {
      optionalColumns.push(col);
    }
  }

  // Calculate total width of required columns
  const requiredWidth = requiredColumns.reduce(
    (sum, col) => sum + (col.width ?? DEFAULT_COLUMN_WIDTH),
    0,
  );

  // If required columns alone exceed width → show all required, enable scroll
  if (requiredWidth >= availableWidth) {
    return {
      visibleColumns: requiredColumns,
      hiddenCount: optionalColumns.length,
    };
  }

  // Sort optional columns by priority order (high → medium → low)
  const sortedOptional = [...optionalColumns].sort((a, b) => {
    const priorityA = PRIORITY_ORDER[a.responsivePriority ?? 'medium'] ?? 2;
    const priorityB = PRIORITY_ORDER[b.responsivePriority ?? 'medium'] ?? 2;
    return priorityA - priorityB;
  });

  // Add optional columns in priority order until width is exhausted
  let remainingWidth = availableWidth - requiredWidth;
  const fittingOptional: DataGridColumnDef<T>[] = [];

  for (const col of sortedOptional) {
    const colWidth = col.width ?? DEFAULT_COLUMN_WIDTH;
    if (colWidth <= remainingWidth) {
      fittingOptional.push(col);
      remainingWidth -= colWidth;
    }
  }

  // Reconstruct visible columns preserving original order
  const visibleIds = new Set([
    ...requiredColumns.map((c) => c.id),
    ...fittingOptional.map((c) => c.id),
  ]);

  const visibleColumns = columns.filter((col) => visibleIds.has(col.id));
  const hiddenCount = columns.length - visibleColumns.length;

  return { visibleColumns, hiddenCount };
}
