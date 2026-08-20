/**
 * Shared responsive column utilities for preference-driven tables.
 * Used by any module's list/table view to determine which columns to hide at breakpoints.
 */

import type { ColumnConfigItem, ColumnDefinition } from '@leadcrm/shared';

/**
 * Determines the responsive CSS class for a column based on its position
 * among non-required visible columns.
 *
 * - Required columns: always visible (no hiding class)
 * - Non-required index 0-1 (first 2): always visible
 * - Non-required index 2-3 (3rd & 4th): hidden below md (768px)
 * - Non-required index 4+ (5th+): hidden below lg (1024px)
 */
export function getResponsiveColumnClass(
  colId: string,
  visibleColumns: ColumnConfigItem[],
  registry: ColumnDefinition[],
): string {
  const regDef = registry.find((r) => r.id === colId);
  if (regDef?.required) return ''; // Required columns are always visible

  // Find this column's index among non-required visible columns
  const nonRequiredVisible = visibleColumns.filter((c) => {
    const def = registry.find((r) => r.id === c.id);
    return !def?.required;
  });
  const idx = nonRequiredVisible.findIndex((c) => c.id === colId);

  if (idx < 0) return 'hidden'; // Not in visible list
  if (idx < 2) return ''; // First 2 non-required: always visible
  if (idx < 4) return 'hidden md:block'; // 3rd-4th: visible at md+ (768px+)
  return 'hidden lg:block'; // 5th+: visible at lg+ (1024px+)
}

/**
 * Get the label for a column from the registry.
 */
export function getColumnLabel(colId: string, registry: ColumnDefinition[]): string {
  const def = registry.find((r) => r.id === colId);
  return def?.label ?? colId;
}

/**
 * Get the system-default visible columns for a module (used as fallback).
 */
export function getDefaultVisibleColumns(registry: ColumnDefinition[]): ColumnConfigItem[] {
  return registry
    .filter((col) => col.defaultVisible)
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map((col) => ({ id: col.id, visible: true, order: col.defaultOrder }));
}
