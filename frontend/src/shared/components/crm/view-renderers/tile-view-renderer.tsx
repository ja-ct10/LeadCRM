'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { ViewRendererProps } from '@leadcrm/shared';

/**
 * TileViewRenderer — compact card-based tile layout.
 *
 * Uses module's registered field config (columnRegistry) to determine which
 * data fields appear in each tile, independent of column visibility preference
 * (Requirement 2.5). Shows 2-3 key fields per tile.
 *
 * Responsive: 2 cols on mobile, 3 cols on tablet, 4 cols on desktop.
 * Smaller, more compact than GridViewRenderer.
 * Includes selection checkbox on each tile.
 *
 * Requirements: 2.1, 2.5
 */

/** Maximum fields to show per tile (compact — fewer than grid) */
const MAX_TILE_FIELDS = 3;

export function TileViewRenderer({
  data,
  columnRegistry,
  onRowClick,
  onRowSelect,
  selectedIds,
}: ViewRendererProps): React.ReactElement {
  // Use the first MAX_TILE_FIELDS columns from the registry
  const displayFields = columnRegistry.slice(0, MAX_TILE_FIELDS);

  const getRecordName = (record: Record<string, unknown>): string => {
    const nameField = columnRegistry.find(
      (col) => col.priority === 'required' || col.priority === 'high',
    );
    if (nameField) {
      const value = record[nameField.id];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value);
      }
    }
    const first = columnRegistry[0];
    if (first) {
      const value = record[first.id];
      return value !== null && value !== undefined ? String(value) : 'Untitled';
    }
    return 'Untitled';
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
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5" role="list" aria-label="Records tiles">
      {data.map((record) => {
        const recordId = String(record['id'] ?? '');
        const isSelected = selectedIds?.has(recordId) ?? false;
        const recordName = getRecordName(record);

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
              'bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-lg',
              'px-3 py-2.5 cursor-pointer transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:ring-offset-1',
              isSelected
                ? 'bg-blue-50/60 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/30'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
            )}
            aria-label={`Record: ${recordName}`}
          >
            {/* Tile header: checkbox + title */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-center justify-center min-h-[24px] min-w-[24px]" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onRowSelect?.(recordId, !isSelected)}
                  className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                  aria-label={`Select record ${recordId}`}
                />
              </div>
              <h4 className="text-[13px] font-semibold text-[#0F172A] dark:text-slate-100 truncate flex-1">
                {recordName}
              </h4>
            </div>

            {/* Tile fields (compact) */}
            <div className="flex flex-col gap-0.5 pl-5.5">
              {displayFields.slice(1).map((col) => {
                const cellValue = record[col.id];
                const displayValue =
                  cellValue === null || cellValue === undefined
                    ? '—'
                    : String(cellValue);

                return (
                  <span
                    key={col.id}
                    className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 truncate"
                    title={`${col.label}: ${displayValue}`}
                  >
                    {displayValue}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
