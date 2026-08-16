/**
 * LeadsDataGrid — Leads table implemented with the shared DataGrid component.
 *
 * This replaces the legacy LeadsListView for the "table" view type,
 * providing:
 * - Sticky header + pinned "Name" column on horizontal scroll
 * - Resizable columns via drag handles
 * - Header-click sorting with directional chevrons
 * - Bulk selection (select-all + row checkboxes)
 * - Quick-action icons (call, email) on row hover
 * - Sticky summary footer with record count
 * - Seamless integration with existing column preference system
 *
 * The filtering/sorting state remains external (owned by leads-page.tsx)
 * so switching between Table/List/Kanban views retains active filters.
 */

'use client';

import React, { useMemo, useCallback } from 'react';
import { Phone } from 'lucide-react';
import { StatusBadge } from '@/shared/components/crm';
import {
  DataGrid,
  DataGridQuickFilter,
  useDataGridColumns,
  buildDefaultRowActions,
} from '@/shared/components/data-grid';
import type { DataGridColumnDef, QuickAction, SortState, RowActionItem } from '@/shared/components/data-grid';
import type { CellRendererMap } from '@/shared/components/data-grid';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import type { ColumnConfigItem } from '@leadcrm/shared';
import type { Lead } from '@/store/types';

// ─── Props Interface ─────────────────────────────────────────────────────────

interface LeadsDataGridProps {
  /** Paginated leads for the current view */
  leads: Lead[];
  /** Total record count (unfiltered or after filters) */
  totalRecords: number;
  /** Column preferences from useColumnPreferences */
  effectiveColumns: ColumnConfigItem[];
  /** Current sort state */
  sort: SortState | null;
  /** Sort change handler */
  onSortChange: (sort: SortState | null) => void;
  /** Row click → open detail drawer */
  onRowClick: (lead: Lead) => void;
  /** Selected row IDs */
  selectedIds: Set<string>;
  /** Selection change callback */
  onSelectionChange: (ids: Set<string>) => void;
  /** Quick-filter search value (optional in-grid filter) */
  quickFilterValue?: string;
  /** Quick-filter change handler */
  onQuickFilterChange?: (value: string) => void;
  /** Lookup helpers */
  getOwnerName: (userId?: string) => string;
  getOwnerInitials: (userId?: string) => string;
  /** RBAC: can user edit */
  canEdit?: boolean;
  /** RBAC: can user delete */
  canDelete?: boolean;
  /** Open edit form for a lead */
  onEdit?: (lead: Lead) => void;
  /** Delete a lead */
  onDelete?: (lead: Lead) => void;
  /** Open manage columns drawer */
  onManageColumns?: () => void;
  /** Hide a specific column */
  onHideColumn?: (columnId: string) => void;
}

// ─── Status Variant Map ──────────────────────────────────────────────────────

const STATUS_VARIANT_MAP: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'purple' | 'neutral'> = {
  Qualified: 'success',
  New: 'info',
  Contacted: 'info',
  Nurturing: 'purple',
  Unqualified: 'danger',
  Hot: 'danger',
  Warm: 'warn',
  Cold: 'neutral',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function LeadsDataGrid({
  leads,
  totalRecords,
  effectiveColumns,
  sort,
  onSortChange,
  onRowClick,
  selectedIds,
  onSelectionChange,
  quickFilterValue,
  onQuickFilterChange,
  getOwnerName,
  getOwnerInitials,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  onManageColumns,
  onHideColumn,
}: LeadsDataGridProps): React.ReactElement {
  // ─── Cell Renderers ────────────────────────────────────────────────────

  const cellRenderers: CellRendererMap<Lead> = useMemo(() => ({
    firstName: (_value: unknown, row: Lead) => {
      const name = row.leadPerson ?? row.displayName ?? (`${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || 'Unknown');
      const initials = (() => {
        const parts = name.split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase();
      })();

      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate leading-tight">
              {name}
            </p>
            {row.companyName && (
              <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate">
                {row.companyName}
              </p>
            )}
          </div>
        </div>
      );
    },

    emailAndPhone: (_value: unknown, row: Lead) => (
      <div className="min-w-0">
        <p className="text-[12px] text-[#0F172A] dark:text-slate-200 truncate">{row.email ?? '—'}</p>
        {row.phone && <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate">{row.phone}</p>}
      </div>
    ),

    email: (_value: unknown, row: Lead) => (
      <p className="text-[12px] text-[#0F172A] dark:text-slate-200 truncate">{row.email ?? '—'}</p>
    ),

    phone: (_value: unknown, row: Lead) => (
      <p className="text-[12px] text-[#0F172A] dark:text-slate-200 truncate">{row.phone ?? '—'}</p>
    ),

    companyName: (_value: unknown, row: Lead) => (
      <p className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">{row.companyName ?? '—'}</p>
    ),

    status: (_value: unknown, row: Lead) => (
      <StatusBadge
        label={row.status}
        variant={STATUS_VARIANT_MAP[row.status] ?? 'neutral'}
      />
    ),

    source: (_value: unknown, row: Lead) => (
      <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">{row.leadSource ?? '—'}</p>
    ),

    assignedUserId: (_value: unknown, row: Lead) => (
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300">
          {getOwnerInitials(row.assignedUserId)}
        </div>
        <span className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate max-w-[80px]">
          {getOwnerName(row.assignedUserId)}
        </span>
      </div>
    ),

    createdAt: (_value: unknown, row: Lead) => (
      <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {row.createdAt
          ? new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '—'}
      </p>
    ),

    updatedAt: (_value: unknown, row: Lead) => {
      const updatedAt = (row as unknown as Record<string, unknown>).updatedAt as string | undefined;
      return (
        <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
          {updatedAt
            ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—'}
        </p>
      );
    },

    website: (_value: unknown, row: Lead) => {
      const website = (row as unknown as Record<string, unknown>).website as string | undefined;
      return (
        <p className="text-[12px] text-[#2563EB] dark:text-blue-400 truncate">{website ?? '—'}</p>
      );
    },
  }), [getOwnerName, getOwnerInitials]);

  // ─── Column Configuration ──────────────────────────────────────────────

  const { gridColumns } = useDataGridColumns<Lead>({
    registry: LEADS_COLUMN_REGISTRY,
    effectiveColumns,
    cellRenderers,
    pinnedColumns: ['firstName'],
    sortableColumns: [
      'firstName', 'email', 'phone', 'companyName', 'status',
      'source', 'assignedUserId', 'createdAt', 'updatedAt',
    ],
    resizableColumns: 'all',
    defaultWidths: {
      firstName: 240,
      emailAndPhone: 220,
      email: 220,
      phone: 150,
      companyName: 180,
      status: 120,
      source: 140,
      assignedUserId: 160,
      createdAt: 140,
      updatedAt: 140,
      description: 200,
      website: 180,
      primaryAddressCityState: 160,
    },
  });

  // ─── Quick Actions ─────────────────────────────────────────────────────

  const quickActions: QuickAction<Lead>[] = useMemo(() => [
    {
      id: 'call',
      label: 'Call',
      icon: <Phone size={14} />,
      onClick: (lead: Lead) => {
        if (lead.phone) {
          window.open(`tel:${lead.phone}`, '_self');
        }
      },
      visible: (lead: Lead) => Boolean(lead.phone),
    },
  ], []);

  // ─── Row Actions (⋯ menu) ─────────────────────────────────────────────

  const getRowActions = useCallback((lead: Lead): RowActionItem[] => {
    return buildDefaultRowActions({
      onView: () => onRowClick(lead),
      onEdit: onEdit ? () => onEdit(lead) : undefined,
      onSendEmail: lead.email ? () => window.open(`mailto:${lead.email}`, '_self') : undefined,
      onCreateTask: () => { /* future: open task form */ },
      onAddTags: () => { /* future: open tags dialog */ },
      onConvert: () => { /* future: convert lead to contact */ },
      onDelete: onDelete ? () => onDelete(lead) : undefined,
      onCopyUrl: () => {
        navigator.clipboard.writeText(`${window.location.origin}/crm/leads/${lead.id}`);
      },
      canEdit,
      canDelete,
    });
  }, [onRowClick, onEdit, onDelete, canEdit, canDelete]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Quick Filter Bar */}
      {onQuickFilterChange && (
        <DataGridQuickFilter
          value={quickFilterValue ?? ''}
          onChange={onQuickFilterChange}
          placeholder="Quick filter leads..."
          totalCount={leads.length}
        />
      )}

      {/* Data Grid */}
      <DataGrid<Lead>
        columns={gridColumns}
        data={leads}
        getRowId={(lead) => lead.id}
        height={600}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        sort={sort}
        onSortChange={onSortChange}
        onRowClick={onRowClick}
        quickActions={quickActions}
        enableColumnMenu
        onHideColumn={onHideColumn}
        rowActions={getRowActions}
        onSettingsClick={onManageColumns}
        summaryLabel={`${totalRecords} total records`}
        emptyMessage="No leads found. Adjust your filters or create a new lead."
        ariaLabel="Leads data grid"
      />
    </div>
  );
}
