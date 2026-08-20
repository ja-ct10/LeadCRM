'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ColumnConfigItem, ColumnDefinition, ColumnPriority } from '@leadcrm/shared';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_ORDER: ColumnPriority[] = ['low', 'medium', 'high', 'required'];

/**
 * Reserved widths for fixed UI elements that reduce available column space.
 * These are subtracted BEFORE computing how many data columns fit.
 */
const RESERVED_WIDTHS = {
  checkbox: 44,   // Selection column width (14px checkbox + padding)
  actions: 48,    // Row action column width (icon button + padding)
  scrollbar: 17,  // Estimated scrollbar width (Windows/macOS varies)
} as const;

// ─── computeVisibleColumns (pure function) ───────────────────────────────────

export interface ComputeVisibleColumnsOptions {
  hasCheckbox?: boolean;
  hasActions?: boolean;
}

export interface ComputeVisibleColumnsResult {
  visibleColumns: ColumnConfigItem[];
  requiresHorizontalScroll: boolean;
}

/**
 * Computes which columns to show based on available container width.
 *
 * Algorithm:
 * 1. Subtract reserved widths (checkbox, action column, scrollbar) from container width
 * 2. Required columns are ALWAYS shown — calculate their total width first
 * 3. Remaining space after required columns determines how many additional columns fit
 * 4. Additional columns are included in priority order (high → medium → low)
 * 5. If required columns alone exceed available width → enable horizontal scroll, never hide them
 */
export function computeVisibleColumns(
  columns: ColumnConfigItem[],
  registry: ColumnDefinition[],
  containerWidth: number,
  columnMinWidth: number = 120,
  options: ComputeVisibleColumnsOptions = { hasCheckbox: true, hasActions: true },
): ComputeVisibleColumnsResult {
  // Step 1: Subtract reserved widths
  let availableWidth = containerWidth;
  if (options.hasCheckbox) availableWidth -= RESERVED_WIDTHS.checkbox;
  if (options.hasActions) availableWidth -= RESERVED_WIDTHS.actions;
  availableWidth -= RESERVED_WIDTHS.scrollbar;

  const visibleColumns = columns.filter((c) => c.visible);
  const registryMap = new Map(registry.map((r) => [r.id, r]));

  // Step 2: Separate required and non-required columns
  const requiredColumns = visibleColumns.filter(
    (c) => registryMap.get(c.id)?.priority === 'required',
  );
  const nonRequiredColumns = visibleColumns.filter(
    (c) => registryMap.get(c.id)?.priority !== 'required',
  );

  // Step 3: Calculate required column total width
  const requiredTotalWidth = requiredColumns.length * columnMinWidth;

  // Step 4: If required columns alone exceed available width → horizontal scroll
  if (requiredTotalWidth >= availableWidth) {
    return {
      visibleColumns: [...visibleColumns].sort((a, b) => a.order - b.order),
      requiresHorizontalScroll: true,
    };
  }

  // Step 5: Calculate remaining space for additional columns
  const remainingWidth = availableWidth - requiredTotalWidth;
  const maxAdditionalColumns = Math.floor(remainingWidth / columnMinWidth);

  // If all columns fit, no need to hide anything
  if (nonRequiredColumns.length <= maxAdditionalColumns) {
    return {
      visibleColumns: [...visibleColumns].sort((a, b) => a.order - b.order),
      requiresHorizontalScroll: false,
    };
  }

  // Step 6: Sort non-required by priority (high first, low last) and keep only what fits
  const sortedNonRequired = [...nonRequiredColumns].sort((a, b) => {
    const aPriority = registryMap.get(a.id)?.priority ?? 'low';
    const bPriority = registryMap.get(b.id)?.priority ?? 'low';
    return PRIORITY_ORDER.indexOf(bPriority) - PRIORITY_ORDER.indexOf(aPriority);
  });

  const kept = [...requiredColumns, ...sortedNonRequired.slice(0, maxAdditionalColumns)];
  return {
    visibleColumns: kept.sort((a, b) => a.order - b.order),
    requiresHorizontalScroll: false,
  };
}

// ─── useResponsiveColumns Hook ───────────────────────────────────────────────

export interface UseResponsiveColumnsOptions extends ComputeVisibleColumnsOptions {
  columnMinWidth?: number;
}

export interface UseResponsiveColumnsReturn {
  visibleColumns: ColumnConfigItem[];
  requiresHorizontalScroll: boolean;
}

/**
 * Hook that observes a container element's width via ResizeObserver
 * and recomputes visible columns using priority-based hiding.
 *
 * @param containerRef - React ref pointing to the container element to observe
 * @param columns - Current column config items (from useColumnPreferences)
 * @param registry - Column definitions from the module's column registry
 * @param options - Optional overrides for checkbox/actions presence and min column width
 */
export function useResponsiveColumns(
  containerRef: React.RefObject<HTMLElement | null>,
  columns: ColumnConfigItem[],
  registry: ColumnDefinition[],
  options: UseResponsiveColumnsOptions = {},
): UseResponsiveColumnsReturn {
  const { columnMinWidth = 120, hasCheckbox = true, hasActions = true } = options;

  const [result, setResult] = useState<ComputeVisibleColumnsResult>(() =>
    computeVisibleColumns(columns, registry, 0, columnMinWidth, { hasCheckbox, hasActions }),
  );

  // Keep a ref to the latest columns/registry to avoid stale closures in ResizeObserver callback
  const columnsRef = useRef(columns);
  const registryRef = useRef(registry);
  columnsRef.current = columns;
  registryRef.current = registry;

  const compute = useCallback(
    (width: number) => {
      const computed = computeVisibleColumns(
        columnsRef.current,
        registryRef.current,
        width,
        columnMinWidth,
        { hasCheckbox, hasActions },
      );
      setResult(computed);
    },
    [columnMinWidth, hasCheckbox, hasActions],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // Compute initial value
    compute(element.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        compute(width);
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [containerRef, compute]);

  // Recompute when columns or registry change (without waiting for resize)
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    compute(element.clientWidth);
  }, [columns, registry, containerRef, compute]);

  return result;
}
