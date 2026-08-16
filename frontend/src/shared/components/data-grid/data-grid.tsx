/**
 * DataGrid — A modern, reusable data-grid component for LeadCRM.
 *
 * Features:
 * - Sticky header (pinned during vertical scroll)
 * - Pinned left columns (checkbox + primary identifier stay visible during horizontal scroll)
 * - Resizable columns (drag handles on header cell right edge)
 * - Multi-column sorting (header click cycles asc → desc → none)
 * - Bulk selection (select-all checkbox + row checkboxes)
 * - Quick-action icons (inline on hover, no row selection trigger)
 * - Summary/calculation sticky footer
 * - Two-axis scrolling with uniform spacing and truncation
 * - Dark mode support
 * - Full accessibility (ARIA grid pattern, keyboard navigation)
 *
 * Architecture:
 * - Filtering/sorting state is abstract — passed in via props, not owned internally.
 *   This enables the parent to toggle between Table/List/Kanban views while
 *   retaining filter/sort state.
 * - Cell rendering is fully customizable via `cell` render functions on column defs.
 * - Column widths can be controlled externally for persistence.
 *
 * @example
 * ```tsx
 * <DataGrid
 *   columns={columnDefs}
 *   data={paginatedLeads}
 *   getRowId={(row) => row.id}
 *   height={600}
 *   selectable
 *   sort={sort}
 *   onSortChange={setSort}
 *   onRowClick={(row) => setSelectedLead(row)}
 *   quickActions={[
 *     { id: 'call', label: 'Call', icon: <Phone size={14} />, onClick: handleCall },
 *     { id: 'email', label: 'Email', icon: <Mail size={14} />, onClick: handleEmail },
 *   ]}
 *   summaryLabel={`${totalCount} records`}
 * />
 * ```
 */

'use client';

import React, { useMemo, useCallback, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Settings2 } from 'lucide-react';
import { useColumnResize } from './use-column-resize';
import { useDataGridSort } from './use-data-grid-sort';
import { useBulkSelection } from './use-bulk-selection';
import { ColumnHeaderMenu } from './column-header-menu';
import { RowActionsMenu } from './row-actions-menu';
import type {
  DataGridProps,
  DataGridColumnDef,
  CellRenderContext,
  SortDirection,
} from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_COLUMN_WIDTH = 180;
const DEFAULT_MIN_WIDTH = 100;
const CHECKBOX_COLUMN_WIDTH = 44;
const ROW_ACTIONS_WIDTH = 40;
const ACTIONS_COLUMN_WIDTH = 100;
const SETTINGS_COLUMN_WIDTH = 36;
const ROW_HEIGHT_NORMAL = 52;
const ROW_HEIGHT_DENSE = 44;
const HEADER_HEIGHT = 44;

// ─── Resize Handle ───────────────────────────────────────────────────────────

interface ResizeHandleProps {
  columnId: string;
  currentWidth: number;
  onStartResize: (columnId: string, startX: number, currentWidth: number) => void;
  isResizing: boolean;
}

function ResizeHandle({ columnId, currentWidth, onStartResize, isResizing }: ResizeHandleProps): React.ReactElement {
  return (
    <div
      className={cn(
        'absolute right-0 top-0 h-full w-[5px] cursor-col-resize z-10',
        'group-hover/header:bg-blue-400/30',
        isResizing && 'bg-blue-500/50',
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onStartResize(columnId, e.clientX, currentWidth);
      }}
      aria-hidden="true"
    />
  );
}

// ─── Sort Indicator ──────────────────────────────────────────────────────────

interface SortIndicatorProps {
  direction: SortDirection | null;
}

function SortIndicator({ direction }: SortIndicatorProps): React.ReactElement | null {
  if (!direction) return null;
  return (
    <span className="ml-1 inline-flex flex-shrink-0">
      {direction === 'asc' ? (
        <ChevronUp size={12} className="text-blue-600 dark:text-blue-400" />
      ) : (
        <ChevronDown size={12} className="text-blue-600 dark:text-blue-400" />
      )}
    </span>
  );
}

// ─── DataGrid Component ──────────────────────────────────────────────────────

export function DataGrid<T = Record<string, unknown>>({
  columns,
  data,
  getRowId,
  height = 'auto',
  dense = false,
  isLoading = false,
  emptyMessage = 'No records found.',
  sort = null,
  onSortChange,
  selectable = false,
  selectedIds: externalSelectedIds,
  onSelectionChange,
  onRowClick,
  quickActions,
  summaryColumns,
  summaryLabel,
  columnWidths: externalColumnWidths,
  onColumnResize,
  cellContext,
  ariaLabel = 'Data grid',
  enableColumnMenu = false,
  onPinColumn,
  onFilterByColumn,
  onHideColumn,
  rowActions,
  onSettingsClick,
}: DataGridProps<T>): React.ReactElement {
  // ─── Internal column widths state (when uncontrolled) ──────────────────
  const [internalWidths, setInternalWidths] = useState<Record<string, number>>({});
  const columnWidths = externalColumnWidths ?? internalWidths;

  const handleColumnResize = useCallback(
    (columnId: string, width: number) => {
      if (onColumnResize) {
        onColumnResize(columnId, width);
      } else {
        setInternalWidths((prev) => ({ ...prev, [columnId]: width }));
      }
    },
    [onColumnResize],
  );

  // ─── Resize hook ───────────────────────────────────────────────────────
  const { isResizing, resizingColumnId, startResize } = useColumnResize({
    onResize: handleColumnResize,
    minWidth: DEFAULT_MIN_WIDTH,
    maxWidth: 800,
  });

  // ─── Sort hook ─────────────────────────────────────────────────────────
  const { sortedData, handleHeaderClick, getSortDirection } = useDataGridSort({
    sort,
    onSortChange: onSortChange ?? (() => {}),
    columns,
    data,
  });

  // ─── Selection hook ────────────────────────────────────────────────────
  const {
    selectedIds,
    allSelected,
    someSelected,
    toggleRow,
    toggleAll,
    isSelected,
  } = useBulkSelection({
    data: sortedData,
    getRowId,
    selectedIds: externalSelectedIds,
    onSelectionChange,
  });

  // ─── Computed column layout ────────────────────────────────────────────
  const pinnedLeftColumns = useMemo(
    () => columns.filter((col) => col.pinned === 'left'),
    [columns],
  );
  const pinnedRightColumns = useMemo(
    () => columns.filter((col) => col.pinned === 'right'),
    [columns],
  );
  const scrollableColumns = useMemo(
    () => columns.filter((col) => !col.pinned),
    [columns],
  );

  const getColumnWidth = useCallback(
    (col: DataGridColumnDef<T>): number => {
      return columnWidths[col.id] ?? col.width ?? DEFAULT_COLUMN_WIDTH;
    },
    [columnWidths],
  );

  // Pinned left offset calculation
  const pinnedLeftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let currentOffset = selectable ? CHECKBOX_COLUMN_WIDTH : 0;
    for (const col of pinnedLeftColumns) {
      offsets[col.id] = currentOffset;
      currentOffset += getColumnWidth(col);
    }
    return offsets;
  }, [pinnedLeftColumns, getColumnWidth, selectable]);

  // Total pinned left width (for shadow boundary)
  const totalPinnedLeftWidth = useMemo(() => {
    const base = selectable ? CHECKBOX_COLUMN_WIDTH : 0;
    return base + pinnedLeftColumns.reduce((sum, col) => sum + getColumnWidth(col), 0);
  }, [pinnedLeftColumns, getColumnWidth, selectable]);

  // ─── Container height ──────────────────────────────────────────────────
  const containerStyle = useMemo(() => {
    if (height === 'auto') return {};
    if (typeof height === 'number') return { height: `${height}px` };
    return { height };
  }, [height]);

  const rowHeight = dense ? ROW_HEIGHT_DENSE : ROW_HEIGHT_NORMAL;

  // Ref for scroll container
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Render Helpers ────────────────────────────────────────────────────

  const renderCellContent = useCallback(
    (col: DataGridColumnDef<T>, row: T, rowIdx: number): React.ReactNode => {
      const value = col.accessor(row);
      const context: CellRenderContext = {
        helpers: cellContext,
        isSelected: isSelected(getRowId(row)),
        rowIndex: rowIdx,
      };

      if (col.cell) {
        return col.cell(value, row, context);
      }

      // Default string rendering
      if (value === null || value === undefined) return '—';
      return String(value);
    },
    [cellContext, isSelected, getRowId],
  );

  const hasQuickActions = quickActions && quickActions.length > 0;

  // ─── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden animate-pulse"
        style={containerStyle}
      >
        <div className="h-[44px] bg-[#F6F8FB] dark:bg-slate-800/60 border-b border-[#E4E9F0] dark:border-slate-700" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-[#E4E9F0] dark:border-slate-700"
            style={{ height: `${rowHeight}px` }}
          >
            <div className="flex items-center h-full px-4 gap-4">
              <div className="w-3.5 h-3.5 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded flex-1 max-w-[200px]" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded flex-1 max-w-[120px]" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded flex-1 max-w-[80px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div
      className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden flex flex-col"
      style={containerStyle}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Scroll container — two-axis overflow */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto relative"
        style={isResizing ? { cursor: 'col-resize' } : undefined}
      >
        <table
          className="border-collapse table-fixed"
          style={{ minWidth: '100%', width: 'max-content' }}
          role="grid"
          aria-rowcount={sortedData.length}
          aria-colcount={columns.length + (selectable ? 1 : 0)}
        >
          {/* ─── Column Group (widths) ─────────────────────────────── */}
          <colgroup>
            {rowActions && <col style={{ width: ROW_ACTIONS_WIDTH }} />}
            {selectable && <col style={{ width: CHECKBOX_COLUMN_WIDTH }} />}
            {pinnedLeftColumns.map((col) => (
              <col key={col.id} style={{ width: getColumnWidth(col), minWidth: col.minWidth ?? DEFAULT_MIN_WIDTH }} />
            ))}
            {scrollableColumns.map((col) => (
              <col key={col.id} style={{ width: getColumnWidth(col), minWidth: col.minWidth ?? DEFAULT_MIN_WIDTH }} />
            ))}
            {pinnedRightColumns.map((col) => (
              <col key={col.id} style={{ width: getColumnWidth(col), minWidth: col.minWidth ?? DEFAULT_MIN_WIDTH }} />
            ))}
            {hasQuickActions && <col style={{ width: ACTIONS_COLUMN_WIDTH }} />}
            {onSettingsClick && <col style={{ width: SETTINGS_COLUMN_WIDTH }} />}
          </colgroup>

          {/* ─── Header ────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-20">
            <tr
              className={cn(
                'bg-[#F6F8FB] dark:bg-slate-800/60',
                'border-b border-[#E4E9F0] dark:border-slate-700',
              )}
              style={{ height: HEADER_HEIGHT }}
            >
              {/* Row actions header spacer */}
              {rowActions && (
                <th
                  scope="col"
                  className="sticky left-0 z-30 bg-[#F6F8FB] dark:bg-slate-800/60"
                  style={{ width: ROW_ACTIONS_WIDTH, minWidth: ROW_ACTIONS_WIDTH }}
                />
              )}

              {/* Checkbox header — pinned left */}
              {selectable && (
                <th
                  scope="col"
                  className={cn(
                    'sticky z-30 bg-[#F6F8FB] dark:bg-slate-800/60',
                    'px-3 text-center',
                    'shadow-[inset_-1px_0_0_0_#e5e7eb] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.06)]',
                  )}
                  style={{ left: rowActions ? ROW_ACTIONS_WIDTH : 0, width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                    aria-label="Select all records"
                  />
                </th>
              )}

              {/* Pinned left header cells */}
              {pinnedLeftColumns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    'sticky z-30 bg-[#F6F8FB] dark:bg-slate-800/60',
                    'px-3 text-left group/header relative',
                    'text-[11.5px] font-semibold uppercase tracking-wider text-[#5A6B85] dark:text-slate-400',
                    'shadow-[inset_-1px_0_0_0_#e5e7eb] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.06)]',
                    col.sortable && 'cursor-pointer hover:text-[#0F172A] dark:hover:text-white select-none',
                  )}
                  style={{ left: pinnedLeftOffsets[col.id], width: getColumnWidth(col) }}
                  onClick={() => col.sortable && handleHeaderClick(col.id)}
                  aria-sort={
                    getSortDirection(col.id) === 'asc' ? 'ascending' :
                    getSortDirection(col.id) === 'desc' ? 'descending' : 'none'
                  }
                >
                  <div className="flex items-center truncate">
                    <span className="truncate">{col.header}</span>
                    {col.sortable && <SortIndicator direction={getSortDirection(col.id)} />}
                  </div>
                  {col.resizable && (
                    <ResizeHandle
                      columnId={col.id}
                      currentWidth={getColumnWidth(col)}
                      onStartResize={startResize}
                      isResizing={resizingColumnId === col.id}
                    />
                  )}
                </th>
              ))}

              {/* Scrollable header cells */}
              {scrollableColumns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    'px-3 text-left group/header relative',
                    'text-[11.5px] font-semibold uppercase tracking-wider text-[#5A6B85] dark:text-slate-400',
                    col.sortable && !enableColumnMenu && 'cursor-pointer hover:text-[#0F172A] dark:hover:text-white select-none',
                  )}
                  style={{ width: getColumnWidth(col) }}
                  onClick={() => !enableColumnMenu && col.sortable && handleHeaderClick(col.id)}
                  aria-sort={
                    getSortDirection(col.id) === 'asc' ? 'ascending' :
                    getSortDirection(col.id) === 'desc' ? 'descending' : 'none'
                  }
                >
                  <div className="flex items-center gap-1 truncate">
                    <span className="truncate flex-1">{col.header}</span>
                    {!enableColumnMenu && col.sortable && <SortIndicator direction={getSortDirection(col.id)} />}
                    {enableColumnMenu && (
                      <ColumnHeaderMenu
                        columnId={col.id}
                        columnLabel={col.header}
                        isRequired={col.required}
                        isPinned={col.pinned === 'left'}
                        sortDirection={getSortDirection(col.id)}
                        onSortAsc={(id) => onSortChange?.({ field: id, direction: 'asc' })}
                        onSortDesc={(id) => onSortChange?.({ field: id, direction: 'desc' })}
                        onPinColumn={onPinColumn}
                        onFilterBy={onFilterByColumn}
                        onHideColumn={onHideColumn}
                      />
                    )}
                  </div>
                  {col.resizable && (
                    <ResizeHandle
                      columnId={col.id}
                      currentWidth={getColumnWidth(col)}
                      onStartResize={startResize}
                      isResizing={resizingColumnId === col.id}
                    />
                  )}
                </th>
              ))}

              {/* Pinned right header cells */}
              {pinnedRightColumns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    'sticky right-0 z-30 bg-[#F6F8FB] dark:bg-slate-800/60',
                    'px-3 text-left group/header relative',
                    'text-[11.5px] font-semibold uppercase tracking-wider text-[#5A6B85] dark:text-slate-400',
                    'shadow-[inset_1px_0_0_0_#e5e7eb] dark:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.06)]',
                    col.sortable && 'cursor-pointer hover:text-[#0F172A] dark:hover:text-white select-none',
                  )}
                  style={{ width: getColumnWidth(col) }}
                  onClick={() => col.sortable && handleHeaderClick(col.id)}
                >
                  <div className="flex items-center truncate">
                    <span className="truncate">{col.header}</span>
                    {col.sortable && <SortIndicator direction={getSortDirection(col.id)} />}
                  </div>
                  {col.resizable && (
                    <ResizeHandle
                      columnId={col.id}
                      currentWidth={getColumnWidth(col)}
                      onStartResize={startResize}
                      isResizing={resizingColumnId === col.id}
                    />
                  )}
                </th>
              ))}

              {/* Quick actions header spacer */}
              {hasQuickActions && (
                <th
                  scope="col"
                  className="px-3 text-right text-[11.5px] font-semibold uppercase tracking-wider text-[#5A6B85] dark:text-slate-400"
                  style={{ width: ACTIONS_COLUMN_WIDTH }}
                >
                  Actions
                </th>
              )}

              {/* Settings icon (⚙) at end of header */}
              {onSettingsClick && (
                <th
                  scope="col"
                  className="px-1 text-center"
                  style={{ width: SETTINGS_COLUMN_WIDTH }}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSettingsClick(); }}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-600/40 transition-colors"
                    aria-label="Table settings"
                  >
                    <Settings2 size={14} />
                  </button>
                </th>
              )}
            </tr>
          </thead>

          {/* ─── Body ──────────────────────────────────────────────── */}
          <tbody className="divide-y divide-[#E4E9F0] dark:divide-slate-700">
            {sortedData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (hasQuickActions ? 1 : 0)}
                  className="py-16 text-center"
                >
                  <p className="text-[13px] text-[#5A6B85] dark:text-slate-400">
                    {emptyMessage}
                  </p>
                </td>
              </tr>
            )}

            {sortedData.map((row, rowIdx) => {
              const rowId = getRowId(row);
              const selected = isSelected(rowId);

              return (
                <tr
                  key={rowId}
                  className={cn(
                    'transition-colors cursor-pointer group/row',
                    selected
                      ? 'bg-blue-50/60 dark:bg-blue-500/5'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                  )}
                  style={{ height: rowHeight }}
                  onClick={() => onRowClick?.(row)}
                  aria-selected={selected}
                  role="row"
                >
                  {/* Row actions menu (⋯) — leftmost cell */}
                  {rowActions && (
                    <td
                      className={cn(
                        'sticky left-0 z-10 px-1 text-center',
                        selected
                          ? 'bg-blue-50/60 dark:bg-blue-500/5'
                          : 'bg-white dark:bg-slate-800/40 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/40',
                      )}
                      style={{ width: ROW_ACTIONS_WIDTH, minWidth: ROW_ACTIONS_WIDTH }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <RowActionsMenu actions={rowActions(row)} position="left" />
                      </div>
                    </td>
                  )}

                  {/* Checkbox cell — pinned left */}
                  {selectable && (
                    <td
                      className={cn(
                        'sticky z-10 px-3 text-center',
                        selected
                          ? 'bg-blue-50/60 dark:bg-blue-500/5'
                          : 'bg-white dark:bg-slate-800/40 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/40',
                        'shadow-[inset_-1px_0_0_0_#e5e7eb] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.06)]',
                      )}
                      style={{ left: rowActions ? ROW_ACTIONS_WIDTH : 0, width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRow(rowId)}
                        className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                        aria-label={`Select record ${rowId}`}
                      />
                    </td>
                  )}

                  {/* Pinned left data cells */}
                  {pinnedLeftColumns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        'sticky z-10 px-3',
                        selected
                          ? 'bg-blue-50/60 dark:bg-blue-500/5'
                          : 'bg-white dark:bg-slate-800/40 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/40',
                        'shadow-[inset_-1px_0_0_0_#e5e7eb] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.06)]',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.truncate !== false && 'truncate',
                        'text-[13px] text-[#0F172A] dark:text-slate-200',
                      )}
                      style={{ left: pinnedLeftOffsets[col.id], width: getColumnWidth(col) }}
                    >
                      <div className={cn('flex items-center h-full', col.truncate !== false && 'truncate')}>
                        {renderCellContent(col, row, rowIdx)}
                      </div>
                    </td>
                  ))}

                  {/* Scrollable data cells */}
                  {scrollableColumns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        'px-3',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.truncate !== false && 'truncate',
                        'text-[13px] text-[#0F172A] dark:text-slate-200',
                      )}
                      style={{ width: getColumnWidth(col) }}
                    >
                      <div className={cn('flex items-center h-full', col.truncate !== false && 'truncate')}>
                        {renderCellContent(col, row, rowIdx)}
                      </div>
                    </td>
                  ))}

                  {/* Pinned right data cells */}
                  {pinnedRightColumns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        'sticky right-0 z-10 px-3',
                        selected
                          ? 'bg-blue-50/60 dark:bg-blue-500/5'
                          : 'bg-white dark:bg-slate-800/40 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/40',
                        'shadow-[inset_1px_0_0_0_#e5e7eb] dark:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.06)]',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.truncate !== false && 'truncate',
                        'text-[13px] text-[#0F172A] dark:text-slate-200',
                      )}
                      style={{ width: getColumnWidth(col) }}
                    >
                      <div className={cn('flex items-center h-full', col.truncate !== false && 'truncate')}>
                        {renderCellContent(col, row, rowIdx)}
                      </div>
                    </td>
                  ))}

                  {/* Quick actions cell */}
                  {hasQuickActions && (
                    <td
                      className="px-2 text-right"
                      style={{ width: ACTIONS_COLUMN_WIDTH }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        {quickActions!.map((action) => {
                          if (action.visible && !action.visible(row)) return null;
                          return (
                            <button
                              key={action.id}
                              type="button"
                              onClick={() => action.onClick(row)}
                              className={cn(
                                'p-1.5 rounded-md transition-colors',
                                'text-slate-400 dark:text-slate-500',
                                'hover:text-slate-700 dark:hover:text-slate-200',
                                'hover:bg-slate-100 dark:hover:bg-slate-700',
                              )}
                              title={action.label}
                              aria-label={action.label}
                            >
                              {action.icon}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}

                  {/* Settings column spacer cell */}
                  {onSettingsClick && (
                    <td style={{ width: SETTINGS_COLUMN_WIDTH }} />
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Summary Footer (sticky bottom) ────────────────────────── */}
      {(summaryLabel || summaryColumns) && (
        <div
          className={cn(
            'sticky bottom-0 z-20',
            'flex items-center justify-between',
            'px-4 py-2.5 border-t border-[#E4E9F0] dark:border-slate-700',
            'bg-[#F6F8FB] dark:bg-slate-800/60',
            'text-[12px] text-[#5A6B85] dark:text-slate-400',
          )}
        >
          {/* Left: record count / summary label */}
          <span>
            {summaryLabel ?? `${sortedData.length} records`}
          </span>

          {/* Right: column-aligned summaries */}
          {summaryColumns && summaryColumns.length > 0 && (
            <div className="flex items-center gap-4">
              {summaryColumns.map((summary) => (
                <span key={summary.columnId} className="font-medium text-[#0F172A] dark:text-white">
                  {summary.content}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
