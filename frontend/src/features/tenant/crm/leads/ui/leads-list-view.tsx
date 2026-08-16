'use client';

import React from 'react';
import { Lead } from '@/store/types';
import { StatusBadge } from '@/shared/components/crm';
import { cn } from '@/lib/utils';
import type { ColumnConfigItem, ColumnDefinition } from '@leadcrm/shared';

// ── Responsive Column Helpers ─────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeadsListViewProps {
  leads: Lead[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onRowClick: (lead: Lead) => void;
  getInitials: (lead: Lead) => string;
  getLeadName: (lead: Lead) => string;
  getOwnerName: (userId?: string) => string;
  getOwnerInitials: (userId?: string) => string;
  getStatusVariant: (status: string) => 'success' | 'info' | 'warn' | 'danger' | 'purple' | 'neutral';
  formatCurrency?: (value?: number) => string;
  visibleColumns: ColumnConfigItem[];
  registry: ColumnDefinition[];
  dense?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LeadsListView({
  leads,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  getInitials,
  getLeadName,
  getOwnerName,
  getOwnerInitials,
  getStatusVariant,
  visibleColumns,
  registry,
  dense = false,
}: LeadsListViewProps): React.ReactElement {
  if (leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-[#5A6B85] dark:text-slate-400">
        No leads found. Adjust your filters or create a new lead.
      </div>
    );
  }

  /** Resolve label for a column id */
  const getColumnLabel = (colId: string): string => {
    const def = registry.find((r) => r.id === colId);
    return def?.label ?? colId;
  };

  /** Render a cell value for a given column id and lead */
  const renderCell = (colId: string, lead: Lead): React.ReactNode => {
    switch (colId) {
      case 'firstName':
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
              {getInitials(lead)}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate leading-tight group-hover:text-[#2563EB] transition-colors">
                {lead.firstName ?? '—'}
              </p>
            </div>
          </div>
        );
      case 'lastName':
        return (
          <p className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">
            {lead.lastName ?? '—'}
          </p>
        );
      case 'email':
        return (
          <p className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">
            {lead.email ?? '—'}
          </p>
        );
      case 'phone':
        return (
          <p className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">
            {lead.phone ?? '—'}
          </p>
        );
      case 'companyName':
        return (
          <p className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">
            {lead.companyName ?? '—'}
          </p>
        );
      case 'status':
        return <StatusBadge label={lead.status} variant={getStatusVariant(lead.status)} />;
      case 'source':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {lead.leadSource ?? '—'}
          </p>
        );
      case 'assignedUserId':
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300">
              {getOwnerInitials(lead.assignedUserId)}
            </div>
            <span className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate max-w-[60px] hidden xl:inline">
              {getOwnerName(lead.assignedUserId).split(' ')[0]}
            </span>
          </div>
        );
      case 'productInterest':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {((lead as unknown as Record<string, unknown>).productInterest as string) ?? '—'}
          </p>
        );
      case 'address':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {lead.city ?? '—'}
          </p>
        );
      case 'createdAt':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </p>
        );
      case 'accountId':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {((lead as unknown as Record<string, unknown>).accountId as string) ?? '—'}
          </p>
        );
      default:
        return <span className="text-[12px] text-[#5A6B85]">—</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden overflow-x-auto">
      {/* Table header */}
      <div
        className={cn(
          'flex items-center border-b border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60 sticky top-0 z-10',
          'text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400',
          dense ? 'h-10 px-3' : 'h-11 px-3',
        )}
      >
        <label className="flex items-center justify-center w-10 shrink-0">
          <input
            type="checkbox"
            checked={selectedIds.length === leads.length && leads.length > 0}
            onChange={onSelectAll}
            className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
            aria-label="Select all leads"
          />
        </label>
        {visibleColumns.map((col) => {
          const responsiveClass = getResponsiveColumnClass(col.id, visibleColumns, registry);
          return (
            <span key={col.id} className={cn('px-3 truncate flex-1 min-w-0', responsiveClass)}>
              {getColumnLabel(col.id)}
            </span>
          );
        })}
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#E4E9F0] dark:divide-slate-700">
        {leads.map((lead) => {
          const isSelected = selectedIds.includes(lead.id);

          return (
            <div
              key={lead.id}
              onClick={() => onRowClick(lead)}
              className={cn(
                'flex items-center cursor-pointer transition-colors group',
                dense ? 'h-[44px] px-3' : 'h-[52px] px-3',
                isSelected
                  ? 'bg-blue-50/60 dark:bg-blue-500/5'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
              )}
            >
              {/* Checkbox */}
              <label className="flex items-center justify-center w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(lead.id)}
                  className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
                  aria-label={`Select ${getLeadName(lead)}`}
                />
              </label>

              {/* Dynamic columns */}
              {visibleColumns.map((col) => {
                const responsiveClass = getResponsiveColumnClass(col.id, visibleColumns, registry);
                return (
                  <div key={col.id} className={cn('px-3 min-w-0 flex-1', responsiveClass)}>
                    {renderCell(col.id, lead)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60">
        <span className="text-[12px] text-[#5A6B85] dark:text-slate-400">
          Total records <strong className="font-semibold text-[#0F172A] dark:text-white">{leads.length}</strong>
        </span>
        <div className="flex items-center gap-2 text-[12px] text-[#5A6B85]">
          <span>1 to {Math.min(leads.length, 25)}</span>
          <button className="p-1 hover:text-[#0F172A] dark:hover:text-white transition-colors" aria-label="Previous page">&lt;</button>
          <button className="p-1 hover:text-[#0F172A] dark:hover:text-white transition-colors" aria-label="Next page">&gt;</button>
        </div>
      </div>
    </div>
  );
}
