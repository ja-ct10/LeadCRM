'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { ViewRendererProps } from '@leadcrm/shared';

/**
 * GridViewRenderer — responsive card-based grid layout.
 *
 * Uses module's registered field config (columnRegistry) to determine which
 * data fields appear in each card, independent of column visibility preference
 * (Requirement 2.5). Shows the first 4-5 fields per card.
 *
 * Responsive: 1 col on mobile, 2 cols on tablet, 3 cols on desktop.
 * Includes selection checkbox on each card.
 *
 * Requirements: 2.1, 2.5
 */

/** Maximum fields to show per card */
const MAX_CARD_FIELDS = 5;

export function GridViewRenderer({
  data,
  columnRegistry,
  onRowClick,
  onRowSelect,
  selectedIds,
}: ViewRendererProps): React.ReactElement {
  // Use the first MAX_CARD_FIELDS columns from the registry (all columns, not just visible)
  const displayFields = columnRegistry.slice(0, MAX_CARD_FIELDS);

  const getRecordName = (record: Record<string, unknown>): string => {
    // Use the first required/high-priority field as the card title
    const nameField = columnRegistry.find(
      (col) => col.priority === 'required' || col.priority === 'high',
    );
    if (nameField) {
      const value = record[nameField.id];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value);
      }
    }
    // Fallback to first field
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" role="list" aria-label="Records grid">
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
              'bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl',
              'p-4 cursor-pointer transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:ring-offset-1',
              isSelected
                ? 'bg-blue-50/60 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/30'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
            )}
            aria-label={`Record: ${recordName}`}
          >
            {/* Card header: checkbox + title */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center min-h-[24px] min-w-[24px]" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onRowSelect?.(recordId, !isSelected)}
                  className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
                  aria-label={`Select record ${recordId}`}
                />
              </div>
              <h3 className="text-[14px] font-semibold text-[#0F172A] dark:text-slate-100 truncate flex-1">
                {recordName}
              </h3>
            </div>

            {/* Card fields */}
            <div className="flex flex-col gap-1.5">
              {displayFields.slice(1).map((col) => {
                const cellValue = record[col.id];
                const displayValue =
                  cellValue === null || cellValue === undefined
                    ? '—'
                    : String(cellValue);

                return (
                  <div key={col.id} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[#5A6B85] dark:text-slate-500 shrink-0">
                      {col.label}
                    </span>
                    <span className="text-[12.5px] text-[#0F172A] dark:text-slate-300 truncate text-right">
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
