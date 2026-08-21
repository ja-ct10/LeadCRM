'use client';

import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, User, Calendar } from 'lucide-react';
import type { Deal } from '@/store/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ColumnConfig {
  key: string;
  label: string;
  sortable?: boolean;
}

interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

interface PipelineTableViewProps {
  deals: Deal[];
  columns: ColumnConfig[];
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  onDealClick: (deal: Deal) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPriorityClasses(priority: string): string {
  switch (priority) {
    case 'High':
    case 'HIGH':
      return 'bg-red-500/10 text-red-500 border-red-500/10';
    case 'Medium':
    case 'MEDIUM':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/10';
    default:
      return 'bg-blue-500/10 text-blue-500 border-blue-500/10';
  }
}

function formatDealValue(value: number | undefined | null): string {
  if (!value) return '₱0';
  return `₱${value.toLocaleString()}`;
}

// ─── Sort Icon ──────────────────────────────────────────────────────────────

function SortIndicator({ field, sort }: { field: string; sort: SortState | null }): React.ReactElement {
  if (!sort || sort.field !== field) {
    return <ChevronsUpDown size={12} className="text-slate-300 dark:text-slate-600" />;
  }
  if (sort.direction === 'asc') {
    return <ChevronUp size={12} className="text-blue-500" />;
  }
  return <ChevronDown size={12} className="text-blue-500" />;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PipelineTableView({
  deals,
  columns,
  sort,
  onSortChange,
  onDealClick,
}: PipelineTableViewProps): React.ReactElement {
  const handleHeaderClick = (col: ColumnConfig): void => {
    if (!col.sortable) return;

    if (sort?.field === col.key) {
      if (sort.direction === 'asc') {
        onSortChange({ field: col.key, direction: 'desc' });
      } else {
        onSortChange(null);
      }
    } else {
      onSortChange({ field: col.key, direction: 'asc' });
    }
  };

  const sortedDeals = useMemo(() => {
    if (!sort) return deals;

    return [...deals].sort((a, b) => {
      const fieldKey = sort.field as keyof Deal;
      let valA: unknown = a[fieldKey];
      let valB: unknown = b[fieldKey];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sort.direction === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [deals, sort]);

  return (
    <div className="bg-white dark:bg-slate-950/40 rounded-2xl border border-gray-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-150 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.01]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleHeaderClick(col)}
                  className={`p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none ${
                    col.sortable
                      ? 'cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.label}</span>
                    {col.sortable && <SortIndicator field={col.key} sort={sort} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/[0.03]">
            {sortedDeals.map((deal) => (
              <tr
                key={deal.id}
                onClick={() => onDealClick(deal)}
                className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors cursor-pointer"
              >
                {columns.map((col) => (
                  <td key={col.key} className="p-4 text-xs">
                    {renderCell(deal, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deals.length === 0 && (
        <div className="p-12 flex justify-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            No deals found.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Cell Renderer ──────────────────────────────────────────────────────────

function renderCell(deal: Deal, key: string): React.ReactNode {
  switch (key) {
    case 'title':
      return (
        <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
          {deal.title}
        </span>
      );

    case 'value':
      return (
        <span className="font-bold text-slate-900 dark:text-white">
          {formatDealValue(deal.value)}
        </span>
      );

    case 'priority':
      return (
        <span
          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${getPriorityClasses(deal.priority)}`}
        >
          {deal.priority}
        </span>
      );

    case 'stageId':
      return (
        <span className="bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/10 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg">
          {deal.stageId}
        </span>
      );

    case 'assignedUserId':
      return deal.assignedUserId ? (
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-[10px] font-bold">
            <User size={10} />
          </span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {deal.assignedUserId}
          </span>
        </div>
      ) : (
        <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>
      );

    case 'expectedCloseDate':
      return deal.expectedCloseDate ? (
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <Calendar size={12} />
          {new Date(deal.expectedCloseDate).toLocaleDateString()}
        </span>
      ) : (
        <span className="text-slate-400 dark:text-slate-500">—</span>
      );

    default:
      return (
        <span className="text-slate-600 dark:text-slate-400">
          {String((deal as unknown as Record<string, unknown>)[key] ?? '—')}
        </span>
      );
  }
}

export default PipelineTableView;
