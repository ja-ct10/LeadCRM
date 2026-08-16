'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { ViewRendererProps } from '@leadcrm/shared';

/**
 * ListViewRenderer — row-based layout showing each record as a card
 * with label-value pairs from the user's visible columns in order.
 *
 * Respects user's column visibility/order preferences (Requirement 2.4).
 * Includes selection checkbox on each item.
 *
 * Requirements: 2.1, 2.4
 */
export function ListViewRenderer({
  data,
  columns,
  columnRegistry,
  onRowClick,
  onRowSelect,
  selectedIds,
}: ViewRendererProps): React.ReactElement {
  // Filter to visible columns, sorted by order
  const visibleColumns = columns
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order);

  const registryMap = new Map(columnRegistry.map((r) => [r.id, r]));

  const getColumnLabel = (colId: string): string => {
    return registryMap.get(colId)?.label ?? colId;
  };

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-[13px] text-[#5A6B85] dark:text-slate-400">
            No records found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Records list">
      {data.map((record) => {
        const recordId = String(record['id'] ?? '');
        const isSelected = selectedIds?.has(recordId) ?? false;

        return (
          <div
            key={recordId}
            role="listitem"
            tabIndex={0}
            onClick={() => onRowClick?.(recordId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRowClick?.(recordId);
              }
            }}
            className={cn(
              'bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl',
              'px-4 py-3 cursor-pointer transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:ring-offset-1',
              isSelected
                ? 'bg-blue-50/60 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/30'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
            )}
            aria-selected={isSelected}
          >
            <div className="flex items-start gap-3">
              {/* Selection checkbox */}
              <div
                className="flex items-center justify-center min-h-[24px] min-w-[24px] pt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onRowSelect?.(recordId, !isSelected)}
                  className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                  aria-label={`Select record ${recordId}`}
                />
              </div>

              {/* Record fields as label-value pairs */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
                {visibleColumns.map((col) => {
                  const cellValue = record[col.id];
                  const displayValue =
                    cellValue === null || cellValue === undefined
                      ? '—'
                      : String(cellValue);

                  return (
                    <div key={col.id} className="flex flex-col">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-[#5A6B85] dark:text-slate-500">
                        {getColumnLabel(col.id)}
                      </span>
                      <span className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
