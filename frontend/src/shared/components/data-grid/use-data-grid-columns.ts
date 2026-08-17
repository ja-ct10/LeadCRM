/**
 * useDataGridColumns — Bridge hook that converts the existing column preference
 * system (ColumnDefinition[] + ColumnConfigItem[]) into DataGridColumnDef[].
 *
 * This hook enables the DataGrid to work seamlessly with:
 * - The column registry (LEADS_COLUMN_REGISTRY, etc.)
 * - The useColumnPreferences hook (effectiveColumns)
 * - Custom cell renderers per column ID
 *
 * ## Usage
 *
 * ```tsx
 * const { gridColumns, visibleColumns } = useDataGridColumns({
 *   registry: LEADS_COLUMN_REGISTRY,
 *   effectiveColumns,
 *   cellRenderers: {
 *     firstName: (value, row) => <NameCell lead={row} />,
 *     status: (value) => <StatusBadge label={value} />,
 *   },
 *   pinnedColumns: ['firstName'],
 *   sortableColumns: ['firstName', 'status', 'createdAt', 'source'],
 * });
 * ```
 */

'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ColumnConfigItem, ColumnDefinition } from '@leadcrm/shared';
import type { DataGridColumnDef, PinPosition } from './types';

// ─── Cell Renderer Map ───────────────────────────────────────────────────────

export type CellRendererFn<T = Record<string, unknown>> = (
  value: unknown,
  row: T,
) => ReactNode;

export type CellRendererMap<T = Record<string, unknown>> = Record<string, CellRendererFn<T>>;

// ─── Options ─────────────────────────────────────────────────────────────────

interface UseDataGridColumnsOptions<T = Record<string, unknown>> {
  /** The full column registry for the module */
  registry: ColumnDefinition[];
  /** Effective columns from useColumnPreferences (visibility + order) */
  effectiveColumns: ColumnConfigItem[];
  /** Map of column ID → custom cell renderer */
  cellRenderers?: CellRendererMap<T>;
  /** Column IDs that should be pinned to the left */
  pinnedColumns?: string[];
  /** Column IDs that are sortable */
  sortableColumns?: string[];
  /** Column IDs that are resizable (default: all) */
  resizableColumns?: string[] | 'all';
  /** Default column widths override map */
  defaultWidths?: Record<string, number>;
}

interface UseDataGridColumnsReturn<T = Record<string, unknown>> {
  /** Full DataGridColumnDef array (only visible columns, in order) */
  gridColumns: DataGridColumnDef<T>[];
  /** The computed visible ColumnConfigItems (for compatibility) */
  visibleColumns: ColumnConfigItem[];
}

export function useDataGridColumns<T = Record<string, unknown>>({
  registry,
  effectiveColumns,
  cellRenderers = {},
  pinnedColumns = [],
  sortableColumns = [],
  resizableColumns = 'all',
  defaultWidths = {},
}: UseDataGridColumnsOptions<T>): UseDataGridColumnsReturn<T> {
  const visibleColumns = useMemo((): ColumnConfigItem[] => {
    if (effectiveColumns.length === 0) {
      // Fallback to system defaults
      return registry
        .filter((col) => col.defaultVisible)
        .sort((a, b) => a.defaultOrder - b.defaultOrder)
        .map((col) => ({ id: col.id, visible: true, order: col.defaultOrder }));
    }
    return [...effectiveColumns]
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order);
  }, [effectiveColumns, registry]);

  const gridColumns = useMemo((): DataGridColumnDef<T>[] => {
    const registryMap = new Map(registry.map((r) => [r.id, r]));
    const pinnedSet = new Set(pinnedColumns);
    const sortableSet = new Set(sortableColumns);
    const resizableSet = resizableColumns === 'all'
      ? null
      : new Set(resizableColumns);

    return visibleColumns.map((colConfig): DataGridColumnDef<T> => {
      const def = registryMap.get(colConfig.id);
      const colId = colConfig.id;
      const label = def?.label ?? colId;

      let pinned: PinPosition = null;
      if (pinnedSet.has(colId)) pinned = 'left';

      const isSortable = sortableSet.has(colId);
      const isResizable = resizableSet === null || resizableSet.has(colId);

      const cellRenderer = cellRenderers[colId];
      // Priority: saved preference width → defaultWidths map → fallback 180
      const width = colConfig.width ?? defaultWidths[colId] ?? 180;

      return {
        id: colId,
        header: label,
        accessor: (row: T) => (row as Record<string, unknown>)[colId],
        cell: cellRenderer
          ? (value: unknown, row: T) => cellRenderer(value, row)
          : undefined,
        pinned,
        width,
        minWidth: 100,
        sortable: isSortable,
        resizable: isResizable,
        required: def?.required ?? false,
        responsivePriority: def?.priority ?? 'medium',
        truncate: true,
      };
    });
  }, [visibleColumns, registry, pinnedColumns, sortableColumns, resizableColumns, cellRenderers, defaultWidths]);

  return { gridColumns, visibleColumns };
}
