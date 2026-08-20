'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ViewRendererProps } from '@leadcrm/shared';

/**
 * KanbanViewRenderer — column-based layout grouped by `kanbanGroupingField` value.
 *
 * Groups records by the value of the kanbanGroupingField. Each column shows
 * cards with the record name and 1-2 key fields. Uses horizontal scroll
 * for columns.
 *
 * If no kanbanGroupingField is configured, all records display in a single
 * ungrouped column with a visible label "All Records" (Requirement 2.7).
 *
 * Requirements: 2.1, 2.7
 */

interface KanbanViewRendererProps extends ViewRendererProps {
  /** Column ID for Kanban grouping — optional per ModuleConfig */
  kanbanGroupingField?: string;
}

/** Max key fields to show on each Kanban card (beyond the title) */
const MAX_CARD_KEY_FIELDS = 2;

export function KanbanViewRenderer({
  data,
  columnRegistry,
  onRowClick,
  kanbanGroupingField,
}: KanbanViewRendererProps): React.ReactElement {
  // Determine the grouping field label
  const groupingFieldDef = kanbanGroupingField
    ? columnRegistry.find((col) => col.id === kanbanGroupingField)
    : undefined;

  // Get key fields for card display (excluding the grouping field and first field used as title)
  const keyFields = useMemo(() => {
    return columnRegistry
      .filter((col) => col.id !== kanbanGroupingField)
      .slice(1, 1 + MAX_CARD_KEY_FIELDS);
  }, [columnRegistry, kanbanGroupingField]);

  // Get the record name (first required/high-priority field)
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

  // Group records by kanbanGroupingField value
  const groupedRecords = useMemo(() => {
    if (!kanbanGroupingField) {
      return new Map<string, Record<string, unknown>[]>([['All Records', data]]);
    }

    const groups = new Map<string, Record<string, unknown>[]>();

    for (const record of data) {
      const rawValue = record[kanbanGroupingField];
      const groupValue =
        rawValue === null || rawValue === undefined || String(rawValue).trim() === ''
          ? 'Ungrouped'
          : String(rawValue);

      if (!groups.has(groupValue)) {
        groups.set(groupValue, []);
      }
      groups.get(groupValue)!.push(record);
    }

    // If no data at all, show at least one empty column
    if (groups.size === 0) {
      groups.set('Ungrouped', []);
    }

    return groups;
  }, [data, kanbanGroupingField]);

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (data.length === 0 && !kanbanGroupingField) {
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
    <div className="overflow-x-auto pb-4" role="region" aria-label="Kanban board">
      <div className="flex gap-3 min-w-max">
        {[...groupedRecords.entries()].map(([groupName, records]) => (
          <div
            key={groupName}
            className="flex flex-col w-[280px] shrink-0"
            role="group"
            aria-label={`${groupName} column, ${records.length} records`}
          >
            {/* Column header */}
            <div
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-t-lg',
                'bg-[#F6F8FB] dark:bg-slate-800/60 border border-b-0 border-[#E4E9F0] dark:border-slate-700',
              )}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400">
                  {groupName}
                </h3>
                <span className="text-[11px] font-medium text-[#5A6B85]/60 dark:text-slate-500 bg-white dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
                  {records.length}
                </span>
              </div>
              {!kanbanGroupingField && (
                <span className="text-[10px] text-[#5A6B85]/60 dark:text-slate-500 italic">
                  No grouping configured
                </span>
              )}
            </div>

            {/* Column body — scrollable card list */}
            <div
              className={cn(
                'flex flex-col gap-2 p-2 rounded-b-lg overflow-y-auto max-h-[calc(100vh-280px)]',
                'bg-[#F6F8FB]/50 dark:bg-slate-800/20 border border-t-0 border-[#E4E9F0] dark:border-slate-700',
              )}
              role="list"
              aria-label={`${groupName} records`}
            >
              {records.length === 0 && (
                <p className="text-[11.5px] text-[#5A6B85]/60 dark:text-slate-500 text-center py-6">
                  No records
                </p>
              )}

              {records.map((record) => {
                const recordId = String(record['id'] ?? '');
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
                      'hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:shadow-sm',
                      'focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:ring-offset-1',
                    )}
                    aria-label={`Record: ${recordName}`}
                  >
                    <p className="text-[13px] font-medium text-[#0F172A] dark:text-slate-100 truncate mb-1">
                      {recordName}
                    </p>

                    {/* Key fields */}
                    {keyFields.map((col) => {
                      const cellValue = record[col.id];
                      const displayValue =
                        cellValue === null || cellValue === undefined
                          ? '—'
                          : String(cellValue);

                      return (
                        <div key={col.id} className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#5A6B85] dark:text-slate-500">
                            {col.label}:
                          </span>
                          <span className="text-[11.5px] text-[#0F172A]/80 dark:text-slate-300 truncate">
                            {displayValue}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
