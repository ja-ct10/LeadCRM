/**
 * AccountsDataGrid — Accounts table implemented with the shared DataGrid component.
 *
 * This replaces the legacy flex-based inline layout for the "table" view type,
 * providing:
 * - Sticky header + pinned "Account Name" column on horizontal scroll
 * - Resizable columns via drag handles
 * - Header-click sorting with directional chevrons
 * - Bulk selection (select-all + row checkboxes)
 * - Sticky summary footer with record count
 * - Seamless integration with existing column preference system
 *
 * Filtering/sorting state remains external (owned by accounts-page.tsx)
 * so switching between Table/List/Kanban views retains active filters.
 */

'use client';
import { getTableSortFields } from '@/shared/constants/column-registries';
import { useCrmRecordAccess } from '@/shared/hooks/use-crm-record-access';

import { useConfiguredCrmColumns } from '@/shared/hooks/use-field-layout';

import React, { useMemo, useCallback } from 'react';
import {
  DataGrid,
  useDataGridColumns,
  buildDefaultRowActions,
  renderDate,
  renderLink,
  MODULE_ACCENT_COLORS,
} from '@/shared/components/data-grid';
import type { SortState, RowActionItem } from '@/shared/components/data-grid';
import type { CellRendererMap } from '@/shared/components/data-grid';
import { ACCOUNTS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { ACCOUNTS_TABLE_SORT_FIELDS, type ColumnConfigItem } from '@leadcrm/shared';
import type { Account } from '../types/account.types';
import { UnreadRecordDot } from '@/features/tenant/notifications/hooks/use-record-notifications';

// ─── Props Interface ─────────────────────────────────────────────────────────

interface AccountsDataGridProps {
  /** Paginated accounts for the current view */
  accounts: Account[];
  /** Total record count */
  totalRecords: number;
  /** Column preferences from useColumnPreferences */
  effectiveColumns: ColumnConfigItem[];
  /** Current sort state */
  sort?: SortState | null;
  /** Sort change handler */
  onSortChange?: (sort: SortState | null) => void;
  /** Row click → open detail drawer */
  onRowClick: (account: Account) => void;
  /** Selected row IDs */
  selectedIds: Set<string>;
  /** Selection change callback */
  onSelectionChange: (ids: Set<string>) => void;
  /** RBAC: can user edit */
  canEdit?: boolean;
  /** RBAC: can user archive */
  canArchive?: boolean;
  /** Open edit form for an account */
  onEdit?: (account: Account) => void;
  /** Archive an account */
  onArchive?: (account: Account) => void;
  /** Open manage columns drawer */
  onManageColumns?: () => void;
  /** Hide a specific column */
  onHideColumn?: (columnId: string) => void;
  onColumnWidthChange?: (columnId: string, width: number) => void;
  /** Display mode: wrap or clip cell content */
  viewMode?: 'wrap' | 'clip';
  /** Row ID to highlight (navigated from global search) */
  highlightRowId?: string;
}


// ─── Component ───────────────────────────────────────────────────────────────

export function AccountsDataGrid({
  accounts,
  totalRecords,
  effectiveColumns,
  sort = null,
  onSortChange,
  onRowClick,
  selectedIds,
  onSelectionChange,
  canEdit = false,
  canArchive = false,
  onEdit,
  onArchive,
  onManageColumns,
  onHideColumn,
  onColumnWidthChange,
  viewMode = 'clip',
  highlightRowId,
}: AccountsDataGridProps): React.ReactElement {
  const recordAccess = useCrmRecordAccess('accounts');
  // ─── Cell Renderers ────────────────────────────────────────────────────

  const cellRenderers: CellRendererMap<Account> = useMemo(() => ({
    name: (_value: unknown, row: Account) => {
      const initials = (() => {
        const parts = row.name.split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return row.name.slice(0, 2).toUpperCase();
      })();

      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-full ${MODULE_ACCENT_COLORS.leads} flex items-center justify-center text-white font-bold text-[10px] shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#1a73e8] dark:text-blue-400 truncate leading-tight hover:underline cursor-pointer">
              {row.name}
            </p>
            {row.address && (
              <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate">
                {row.address}
              </p>
            )}
          </div>
          <UnreadRecordDot entityType="Account" entityId={row.id} />
        </div>
      );
    },

    industry: (_value: unknown, row: Account) => (
      <p className="text-[12.5px] text-[#3C4858] dark:text-slate-200 truncate">
        {row.industry ?? '—'}
      </p>
    ),


    size: (_value: unknown, row: Account) => (
      <p className="text-[12.5px] text-[#3C4858] dark:text-slate-200 truncate">
        {row.size ?? '—'}
      </p>
    ),

    address: (_value: unknown, row: Account) => (
      <p title={row.address || undefined} className={`text-[12.5px] text-[#3C4858] dark:text-slate-200 ${viewMode === 'wrap' ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>
        {row.address || '—'}
      </p>
    ),


    website: (_value: unknown, row: Account) => renderLink(row.website ?? null),

    tags: (_value: unknown, row: Account) => (
      <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {row.tags && row.tags.length > 0 ? row.tags.join(', ') : '—'}
      </p>
    ),

    createdAt: (_value: unknown, row: Account) => renderDate(row.createdAt),
  }), [viewMode]);

  // ─── Column Configuration ──────────────────────────────────────────────

  const { gridColumns } = useDataGridColumns<Account>({
    module: 'accounts',
    registry: ACCOUNTS_COLUMN_REGISTRY,
    effectiveColumns,
    cellRenderers,
    pinnedColumns: ['name'],
    sortableColumns: ACCOUNTS_TABLE_SORT_FIELDS,
    resizableColumns: 'all',
    defaultWidths: {
      name: 240,
      industry: 160,
      size: 140,
      address: 280,
      website: 180,
      tags: 160,
      createdAt: 140,
    },
  });

  // ─── Stable Callbacks ────────────────────────────────────────────────

  const configuredColumns = useConfiguredCrmColumns('accounts', gridColumns);

  const getRowId = useCallback((account: Account) => account.id, []);

  // ─── Row Actions (⋯ menu) ─────────────────────────────────────────────

  const getRowActions = useCallback((account: Account): RowActionItem[] => {
    return buildDefaultRowActions({
      onView: () => onRowClick(account),
      onEdit: onEdit ? () => onEdit(account) : undefined,
      onSendEmail: account.email ? () => window.open(`mailto:${account.email}`, '_self') : undefined,
      onArchive: onArchive ? () => onArchive(account) : undefined,
      onCopyUrl: () => {
        navigator.clipboard.writeText(`${window.location.origin}/crm/accounts/${account.id}`);
      },
      canEdit: canEdit && recordAccess.canMutate(account),
      canArchive: canArchive && recordAccess.canMutate(account),
    });
  }, [onRowClick, onEdit, onArchive, canEdit, canArchive, recordAccess.canMutate]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <DataGrid<Account>
      columns={configuredColumns}
      data={accounts}
      getRowId={getRowId}
      height="auto"
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      sortingMode="external"
      sortFields={getTableSortFields('accounts')} defaultSort={{ field: 'createdAt', direction: 'desc' }}
      onSortReset={() => onSortChange?.(null)}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={onRowClick}
      onHideColumn={onHideColumn}
      enableColumnMenu={!!onHideColumn}
      onColumnWidthChange={onColumnWidthChange}
      columnWidths={Object.fromEntries(effectiveColumns.filter(column => column.width !== undefined).map(column => [column.id, column.width!]))}
      rowActions={getRowActions}
      summaryLabel={`${totalRecords} total records`}
      emptyMessage="No accounts found. Adjust your filters or create a new account."
      ariaLabel="Accounts data grid"
      highlightRowId={highlightRowId}
      viewMode={viewMode}
    />
  );
}
