'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { ViewRendererProps } from '@leadcrm/shared';

/**
 * TableViewRenderer — standardized table layout for the Unified Data View System.
 *
 * Implements:
 * - 44px fixed-height header with #F6F8FB background
 * - 52px standard / 44px dense row height
 * - #E4E9F0 borders, rounded-xl container
 * - 14×14px checkbox with blue accent
 * - Wrap mode (min 52px, max 156px) and Clip mode (fixed 52px, text-overflow ellipsis)
 * - Sticky header on vertical scroll
 * - Empty state: zero data rows, zero visible columns
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 4.2, 13.1, 13.2, 13.5
 */

interface TableViewRendererInternalProps extends ViewRendererProps {
  /** When true, rows use 44px height instead of 52px */
  dense?: boolean;
}

export function TableViewRenderer({
  data,
  columns,
  columnRegistry,
  viewMode,
  onRowClick,
  onRowSelect,
  selectedIds,
  dense = false,
}: TableViewRendererInternalProps): React.ReactElement {
  // Filter to only visible columns, sorted by order
  const visibleColumns = columns
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order);

  const registryMap = new Map(columnRegistry.map((r) => [r.id, r]));

  const getColumnLabel = (colId: string): string => {
    return registryMap.get(colId)?.label ?? colId;
  };

  const allSelected =
    data.length > 0 &&
    selectedIds !== undefined &&
    data.every((record) => selectedIds.has(String(record['id'] ?? '')));

  const handleSelectAll = (): void => {
    if (!onRowSelect) return;
    const shouldDeselect = allSelected;
    for (const record of data) {
      const recordId = String(record['id'] ?? '');
      if (recordId) {
        onRowSelect(recordId, !shouldDeselect);
      }
    }
  };

  // ─── Zero visible columns state (Requirement 3.7) ───────────────────────────
  if (visibleColumns.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-[13px] text-[#5A6B85] dark:text-slate-400">
            No columns are currently visible.
          </p>
          <p className="text-[12px] text-[#5A6B85]/70 dark:text-slate-500">
            Open Manage Columns to choose the columns you want to display.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden"
      role="region"
      aria-label="Data table"
    >
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
        <table className="w-full border-collapse" aria-label="Module records">
          {/* ─── Sticky Header (Requirement 3.1, 4.2) ─────────────────────── */}
          <thead className="sticky top-0 z-10">
            <tr
              className={cn(
                'h-[44px] bg-[#F6F8FB] dark:bg-slate-800/60',
                'text-[11.5px] font-semibold uppercase tracking-wider text-[#5A6B85] dark:text-slate-400',
                'border-b border-[#E4E9F0] dark:border-slate-700',
              )}
            >
              {/* Checkbox header cell */}
              <th scope="col" className="w-[44px] min-w-[44px] px-3">
                <div className="flex items-center justify-center min-h-[24px] min-w-[24px]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                    aria-label="Select all records"
                  />
                </div>
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="px-3 text-left truncate whitespace-nowrap"
                >
                  {getColumnLabel(col.id)}
                </th>
              ))}
            </tr>
          </thead>

          {/* ─── Table Body ────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-[#E4E9F0] dark:divide-slate-700">
            {/* Zero data rows state (Requirement 3.5) */}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="py-16 text-center"
                >
                  <p className="text-[13px] text-[#5A6B85] dark:text-slate-400">
                    No records found.
                  </p>
                </td>
              </tr>
            )}

            {data.map((record) => {
              const recordId = String(record['id'] ?? '');
              const isSelected = selectedIds?.has(recordId) ?? false;

              return (
                <tr
                  key={recordId}
                  onClick={() => onRowClick?.(recordId)}
                  className={cn(
                    'transition-colors cursor-pointer group',
                    // Row height: wrap vs clip mode (Requirement 3.2, 13.1, 13.2)
                    viewMode === 'wrap'
                      ? (dense ? 'min-h-[44px]' : 'min-h-[52px]')
                      : (dense ? 'h-[44px]' : 'h-[52px]'),
                    // Selection and hover states
                    isSelected
                      ? 'bg-blue-50/60 dark:bg-blue-500/5'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                  )}
                >
                  {/* Checkbox cell (Requirement 3.6) */}
                  <td
                    className="w-[44px] min-w-[44px] px-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center min-h-[24px] min-w-[24px]">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onRowSelect?.(recordId, !isSelected)}
                        className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                        aria-label={`Select record ${recordId}`}
                      />
                    </div>
                  </td>

                  {/* Data cells */}
                  {visibleColumns.map((col) => {
                    const cellValue = record[col.id];
                    const displayValue =
                      cellValue === null || cellValue === undefined
                        ? '—'
                        : String(cellValue);

                    return (
                      <td
                        key={col.id}
                        className={cn(
                          'px-3 text-[13px] text-[#0F172A] dark:text-slate-200',
                          // Wrap vs Clip mode (Requirement 13.1, 13.2, 13.5)
                          viewMode === 'clip'
                            ? 'truncate whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]'
                            : 'break-words',
                          // Row height enforcement via padding
                          dense ? 'py-2.5' : 'py-3.5',
                        )}
                        style={
                          viewMode === 'wrap'
                            ? { minHeight: dense ? 44 : 52, maxHeight: 156, overflow: 'hidden' }
                            : undefined
                        }
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
