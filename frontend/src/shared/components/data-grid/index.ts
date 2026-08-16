/**
 * DataGrid — Reusable data-grid component for LeadCRM.
 *
 * Public API:
 * - `DataGrid` — the core table component
 * - `DataGridColumnDef` — column definition type (with cell renderer support)
 * - `QuickAction` — inline action button definition
 * - `SummaryColumnDef` — footer summary definition
 * - `useBulkSelection` — selection state management hook
 * - `useColumnResize` — resize handle logic hook
 * - `useDataGridSort` — sort state management hook
 *
 * @example
 * ```tsx
 * import { DataGrid, type DataGridColumnDef } from '@/shared/components/data-grid';
 * ```
 */

// Components
export { DataGrid } from './data-grid';
export { DataGridQuickFilter } from './data-grid-quick-filter';
export type { DataGridQuickFilterProps } from './data-grid-quick-filter';
export { ColumnHeaderMenu } from './column-header-menu';
export type { ColumnHeaderMenuProps } from './column-header-menu';
export { RowActionsMenu, buildDefaultRowActions } from './row-actions-menu';
export type { RowActionsMenuProps, RowActionItem } from './row-actions-menu';
export { ActivityFlag } from './activity-flag';
export type { ActivityFlagProps, ActivityType } from './activity-flag';

// Hooks
export { useBulkSelection } from './use-bulk-selection';
export { useColumnResize } from './use-column-resize';
export { useDataGridSort } from './use-data-grid-sort';
export { useDataGridColumns } from './use-data-grid-columns';
export type { CellRendererMap, CellRendererFn } from './use-data-grid-columns';

// Types
export type {
  DataGridProps,
  DataGridColumnDef,
  QuickAction,
  SummaryColumnDef,
  SortState,
  SortDirection,
  PinPosition,
  CellRenderContext,
} from './types';
