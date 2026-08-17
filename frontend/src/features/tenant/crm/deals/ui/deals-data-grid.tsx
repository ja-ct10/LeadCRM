/**
 * DealsDataGrid — Deals table implemented with the shared DataGrid component.
 *
 * Replaces the legacy DealsTable for the "table" view type,
 * providing column preferences, sorting, bulk selection, row actions,
 * column resize, and view mode (wrap/clip) support.
 */

'use client';

import React, { useMemo, useCallback } from 'react';
import type { Deal } from '@/store/types';
import type { ColumnConfigItem } from '@leadcrm/shared';
import type { SortState } from '@/shared/components/data-grid';
import { StatusBadge } from '@/shared/components/crm';
import {
  DataGrid,
  useDataGridColumns,
  buildDefaultRowActions,
} from '@/shared/components/data-grid';
import type { CellRendererMap, RowActionItem } from '@/shared/components/data-grid';
import { DEALS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';

// ─── Props Interface ─────────────────────────────────────────────────────────

interface DealsDataGridProps {
  /** Paginated deals for the current view */
  deals: Deal[];
  /** Total record count */
  totalRecords: number;
  /** Column preferences from useColumnPreferences */
  effectiveColumns: ColumnConfigItem[];
  /** Current sort state */
  sort: SortState | null;
  /** Sort change handler */
  onSortChange: (sort: SortState | null) => void;
  /** Row click → open detail modal */
  onRowClick: (deal: Deal) => void;
  /** Selected row IDs */
  selectedIds: Set<string>;
  /** Selection change callback */
  onSelectionChange: (ids: Set<string>) => void;
  /** Stage name lookup */
  stageNameMap: Record<string, string>;
  /** Pipeline name lookup */
  pipelineNameMap: Record<string, string>;
  /** Lookup: get assigned user name */
  getAssignedUserName: (userId?: string) => string;
  /** Lookup: get account name */
  getAccountName: (accountId?: string) => string;
  /** RBAC: can user edit */
  canEdit?: boolean;
  /** RBAC: can user delete */
  canDelete?: boolean;
  /** Open edit for a deal */
  onEdit?: (deal: Deal) => void;
  /** Delete a deal */
  onDelete?: (deal: Deal) => void;
  /** Open manage columns drawer */
  onManageColumns?: () => void;
  /** Hide a specific column */
  onHideColumn?: (columnId: string) => void;
  /** Display mode: wrap or clip cell content */
  viewMode?: 'wrap' | 'clip';
  /** Column reorder handler — called when user drag-drops a column header */
  onColumnReorder?: (columns: ColumnConfigItem[]) => void;
}

// ─── Priority Variant Map ────────────────────────────────────────────────────

const PRIORITY_VARIANT_MAP: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'neutral'> = {
  High: 'danger',
  Medium: 'warn',
  Low: 'neutral',
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return '₱' + Math.round(value).toLocaleString('en-PH');
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DealsDataGrid({
  deals,
  totalRecords,
  effectiveColumns,
  sort,
  onSortChange,
  onRowClick,
  selectedIds,
  onSelectionChange,
  stageNameMap,
  pipelineNameMap,
  getAssignedUserName,
  getAccountName,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  onManageColumns,
  onHideColumn,
  viewMode = 'clip',
  onColumnReorder,
}: DealsDataGridProps): React.ReactElement {
  // ─── Cell Renderers ────────────────────────────────────────────────────

  const cellRenderers: CellRendererMap<Deal> = useMemo(() => ({
    title: (_value: unknown, row: Deal) => (
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate leading-tight">
          {row.title}
        </p>
        {row.companyName && (
          <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate">
            {row.companyName}
          </p>
        )}
      </div>
    ),

    value: (_value: unknown, row: Deal) => (
      <span className="text-[13px] font-semibold text-[#0F172A] dark:text-slate-100">
        {typeof row.value === 'number' && row.value > 0 ? formatCurrency(row.value) : '—'}
      </span>
    ),

    stageId: (_value: unknown, row: Deal) => {
      const stageName = stageNameMap[row.stageId] ?? '—';
      return (
        <StatusBadge label={stageName} variant="info" />
      );
    },

    priority: (_value: unknown, row: Deal) => {
      const p = row.priority ?? 'Medium';
      return (
        <StatusBadge
          label={p}
          variant={PRIORITY_VARIANT_MAP[p] ?? 'neutral'}
        />
      );
    },

    assignedUserId: (_value: unknown, row: Deal) => (
      <span className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {getAssignedUserName(row.assignedUserId)}
      </span>
    ),

    accountId: (_value: unknown, row: Deal) => (
      <span className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {getAccountName(row.organizationId)}
      </span>
    ),

    expectedCloseDate: (_value: unknown, row: Deal) => (
      <span className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {formatDate(row.expectedCloseDate)}
      </span>
    ),

    leadSource: (_value: unknown, row: Deal) => (
      <span className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {row.leadSource ?? '—'}
      </span>
    ),

    industry: (_value: unknown, row: Deal) => (
      <span className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {(row as unknown as Record<string, unknown>).industry as string ?? '—'}
      </span>
    ),

    createdAt: (_value: unknown, row: Deal) => (
      <span className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {formatDate(row.createdAt)}
      </span>
    ),
  }), [stageNameMap, getAssignedUserName, getAccountName]);

  // ─── Column Configuration ──────────────────────────────────────────────

  const { gridColumns } = useDataGridColumns<Deal>({
    registry: DEALS_COLUMN_REGISTRY,
    effectiveColumns,
    cellRenderers,
    pinnedColumns: ['title'],
    sortableColumns: ['title', 'value', 'stageId', 'priority', 'expectedCloseDate', 'createdAt'],
    resizableColumns: 'all',
    defaultWidths: {
      title: 240,
      value: 140,
      stageId: 140,
      priority: 110,
      assignedUserId: 160,
      accountId: 160,
      expectedCloseDate: 140,
      leadSource: 130,
      industry: 130,
      createdAt: 140,
    },
  });

  // ─── Row Actions (⋯ menu) ─────────────────────────────────────────────

  const getRowActions = useCallback((deal: Deal): RowActionItem[] => {
    return buildDefaultRowActions({
      onView: () => onRowClick(deal),
      onEdit: onEdit ? () => onEdit(deal) : undefined,
      onDelete: onDelete ? () => onDelete(deal) : undefined,
      canEdit,
      canDelete,
    });
  }, [onRowClick, onEdit, onDelete, canEdit, canDelete]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <DataGrid<Deal>
      columns={gridColumns}
      data={deals}
      getRowId={(deal) => deal.id}
      height={600}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={onRowClick}
      enableColumnMenu
      onHideColumn={onHideColumn}
      rowActions={getRowActions}
      onSettingsClick={onManageColumns}
      summaryLabel={`${totalRecords} total deals`}
      emptyMessage="No deals found. Adjust your filters or create a new deal."
      ariaLabel="Deals data grid"
      viewMode={viewMode}
      onColumnReorder={onColumnReorder}
      effectiveColumns={effectiveColumns}
      lockedColumns={['title']}
    />
  );
}
