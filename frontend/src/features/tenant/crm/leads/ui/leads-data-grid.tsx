/**
 * LeadsDataGrid — Leads table implemented with the shared DataGrid component.
 *
 * Close.com-style features:
 * - Status rendered as colored dot + plain text (no pill badge)
 * - Canonical Name plus independent Email and actionable Phone values
 * - Name column first and pinned left whenever visible
 * - Sticky header with resizable, reorderable columns
 * - Bulk selection, quick actions, column header menu
 */

'use client';
import { getTableSortFields } from '@/shared/constants/column-registries';
import { useCrmRecordAccess } from '@/shared/hooks/use-crm-record-access';

import { useConfiguredCrmColumns } from '@/shared/hooks/use-field-layout';

import { useRouter } from 'next/navigation';
import { recordEmailComposeHref } from '@/features/tenant/inbox/services/compose-navigation';
import React, { useMemo, useCallback } from 'react';
import { GitMerge } from 'lucide-react';
import {
  DataGrid,
  DataGridQuickFilter,
  useDataGridColumns,
  buildDefaultRowActions,
  renderDate,
  MODULE_ACCENT_COLORS,
} from '@/shared/components/data-grid';
import type { SortState, RowActionItem } from '@/shared/components/data-grid';
import type { CellRendererMap } from '@/shared/components/data-grid';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { formatLeadName, LEADS_TABLE_SORT_FIELDS, type ColumnConfigItem } from '@leadcrm/shared';
import { CrmStatusIndicator } from '@/shared/components/crm/crm-status';
import { UnreadRecordDot } from '@/features/tenant/notifications/hooks/use-record-notifications';
import type { Lead } from '@/store/types';

// ─── Helper: Render user with avatar initials ─────────────────────────────────

function renderUserName(
  user?: { id: string; firstName: string; lastName: string } | null,
): React.ReactNode {
  if (!user) return <span className="text-[12px] text-[#94a3b8]">—</span>;
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  const name = `${user.firstName} ${user.lastName}`.trim();
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
        {initials}
      </div>
      <span className="text-[12px] text-[#3C4858] dark:text-slate-300 truncate max-w-[100px]">
        {name}
      </span>
    </div>
  );
}

// ─── Props Interface ─────────────────────────────────────────────────────────

interface LeadsDataGridProps {
  /** Paginated leads for the current view */
  leads: Lead[];
  /** Total record count (unfiltered or after filters) */
  totalRecords: number;
  /** Column preferences from useColumnPreferences */
  effectiveColumns: ColumnConfigItem[];
  /** Current sort state */
  sort?: SortState | null;
  /** Sort change handler */
  onSortChange?: (sort: SortState | null) => void;
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
  /** RBAC: can user archive */
  canArchive?: boolean;
  /** Open edit form for a lead */
  onEdit?: (lead: Lead) => void;
  /** Archive a lead */
  onArchive?: (lead: Lead) => void;
  /** Convert a lead */
  onConvert?: (lead: Lead) => void;
  /** Merge a lead with another */
  onMerge?: (lead: Lead) => void;
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

// ─── Status Variant Map (uses shared LEAD_STATUS_VARIANTS) ───────────────────

// ─── Component ───────────────────────────────────────────────────────────────

export function LeadsDataGrid({
  leads,
  totalRecords,
  effectiveColumns,
  sort = null,
  onSortChange,
  onRowClick,
  selectedIds,
  onSelectionChange,
  quickFilterValue,
  onQuickFilterChange,
  getOwnerName,
  getOwnerInitials,
  canEdit = false,
  canArchive = false,
  onEdit,
  onArchive,
  onConvert,
  onMerge,
  onManageColumns,
  onHideColumn,
  onColumnWidthChange,
  viewMode = 'clip',
  highlightRowId,
}: LeadsDataGridProps): React.ReactElement {
  const recordAccess = useCrmRecordAccess();
  // ─── Cell Renderers ────────────────────────────────────────────────────

  const router = useRouter();
  const cellRenderers: CellRendererMap<Lead> = useMemo(() => ({

    // ── First Name ────────────────────────────────────────────────────
    name: (_value: unknown, row: Lead) => {
      const firstName = row.firstName?.trim() ?? '', lastName = row.lastName?.trim() ?? '';
      const initials = (firstName && lastName ? `${firstName[0]}${lastName[0]}` : (firstName || lastName).slice(0, 2)).toUpperCase();
      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-full ${MODULE_ACCENT_COLORS.leads} flex items-center justify-center text-white font-bold text-[10px] shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0">
            <button type="button" onClick={() => onRowClick(row)} className="text-left text-[13px] font-medium text-[#1a73e8] dark:text-blue-400 truncate leading-tight hover:underline cursor-pointer">
              {formatLeadName(row)}
            </button>
          </div>
          <UnreadRecordDot entityType="Lead" entityId={row.id} />
        </div>
      );
    },

    firstName: (_value: unknown, row: Lead) => <span>{row.firstName?.trim() || '—'}</span>,
    lastName: (_value: unknown, row: Lead) => (
      <p className="text-[13px] text-[#3C4858] dark:text-slate-200 truncate">
        {row.lastName || '—'}
      </p>
    ),

    email: (_value: unknown, row: Lead) => (
      <p className="text-[12px] text-[#3C4858] dark:text-slate-200 truncate">{row.email ?? '—'}</p>
    ),

    phone: (_value: unknown, row: Lead) => (
      row.phone ? <a href={`tel:${row.phone}`} onClick={event => event.stopPropagation()} className="text-[12px] text-[#1a73e8] dark:text-blue-400 truncate hover:underline">{row.phone}</a> : <span>—</span>
    ),

    companyName: (_value: unknown, row: Lead) => (
      <p className="text-[13px] text-[#3C4858] dark:text-slate-200 truncate">{row.companyName ?? '—'}</p>
    ),

    // ── Status: Close.com dot + plain text ────────────────────────────
    status: (_value: unknown, row: Lead) => <CrmStatusIndicator status={row.status} />,

    source: (_value: unknown, row: Lead) => (
      <p className="text-[12px] text-[#8899a6] dark:text-slate-400 truncate">{row.source ?? row.leadSource ?? '—'}</p>
    ),

    assignedUserId: (_value: unknown, row: Lead) => (
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
          {row.assignedUser
            ? `${row.assignedUser.firstName?.[0] ?? ''}${row.assignedUser.lastName?.[0] ?? ''}` || getOwnerInitials(row.assignedUserId)
            : getOwnerInitials(row.assignedUserId)}
        </div>
        <span className="text-[12px] text-[#3C4858] dark:text-slate-400 truncate max-w-[100px]">
          {row.assignedUser
            ? `${row.assignedUser.firstName} ${row.assignedUser.lastName}`.trim() || getOwnerName(row.assignedUserId)
            : getOwnerName(row.assignedUserId)}
        </span>
      </div>
    ),

    createdAt: (_value: unknown, row: Lead) => renderDate(row.createdAt),

    updatedAt: (_value: unknown, row: Lead) => {
      const val = (row as unknown as Record<string, unknown>).updatedAt as string | undefined;
      return renderDate(val);
    },

    lastStatusChangedAt: (_value: unknown, row: Lead) => renderDate(row.lastStatusChangedAt),
    latestStatusChangeDate: (_value: unknown, row: Lead) => renderDate(row.lastStatusChangedAt),

    createdBy: (_value: unknown, row: Lead) => renderUserName(row.createdByUser),
    updatedBy: (_value: unknown, row: Lead) => renderUserName(row.updatedByUser),

    address: (_value: unknown, row: Lead) => (
      <p className="text-[12px] text-[#3C4858] dark:text-slate-300 truncate">{row.address ?? row.streetAddress ?? '—'}</p>
    ),

    accountId: (_value: unknown, row: Lead) => row.accountId && row.account?.id === row.accountId
      ? <a href={`/crm/accounts/${row.accountId}`} onClick={event => event.stopPropagation()} className="text-[12px] text-[#1a73e8] dark:text-blue-400 truncate hover:underline">{row.account.name}</a>
      : <span>—</span>,

    productInterest: (_value: unknown, row: Lead) => {
      const interests = row.productInterests ?? (Array.isArray(row.productInterest)
        ? row.productInterest : row.productInterest ? [row.productInterest] : []);
      if (!interests.length) return <span className="text-[12px] text-[#94a3b8]">—</span>;
      return (
        <div className="flex flex-wrap gap-1 min-w-0">
          {interests.map((item: string) => (
            <span key={item} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-[#5A6B85] dark:text-slate-300 truncate max-w-[80px]">
              {item}
            </span>
          ))}
        </div>
      );
    },

  }), [getOwnerName, getOwnerInitials, onRowClick]);

  // ─── Column Configuration ──────────────────────────────────────────────

  const { gridColumns } = useDataGridColumns<Lead>({
    module: 'leads',
    registry: LEADS_COLUMN_REGISTRY,
    effectiveColumns,
    cellRenderers,
    sortableColumns: LEADS_TABLE_SORT_FIELDS,
    resizableColumns: 'all',
    defaultWidths: {
      name:                    240,
      firstName:               160,
      lastName:                160,
      email:                   200,
      phone:                   150,
      companyName:             180,
      status:                  130,
      source:                  140,
      assignedUserId:          160,
      createdAt:               140,
      updatedAt:               140,
      lastStatusChangedAt:     150,
      latestStatusChangeDate:  150,
      address:                 200,
      productInterest:         180,
      accountId:               180,
      createdBy:               150,
      updatedBy:               150,
    },
  });

  // ─── Stable Callbacks ────────────────────────────────────────────────

  const configuredColumns = useConfiguredCrmColumns('leads', gridColumns);

  const getRowId = useCallback((lead: Lead) => lead.id, []);

  // ─── Row Actions (⋯ menu) ─────────────────────────────────────────────

  const getRowActions = useCallback((lead: Lead): RowActionItem[] => {
    const actions = buildDefaultRowActions({
      onView: () => onRowClick(lead),
      onEdit: onEdit ? () => onEdit(lead) : undefined,
      onSendEmail: lead.email ? () => router.push(recordEmailComposeHref(lead.email ?? '') ?? '/inbox') : undefined,
      onConvert: canEdit && recordAccess.canMutate(lead) && onConvert ? () => onConvert(lead) : undefined,
      onArchive: onArchive ? () => onArchive(lead) : undefined,
      onCopyUrl: () => {
        navigator.clipboard.writeText(`${window.location.origin}/crm/leads/${lead.id}`);
      },
      canEdit: canEdit && recordAccess.canMutate(lead),
      canArchive: canArchive && recordAccess.canMutate(lead),
    });

    // Add Merge action (if user can edit)
    if (onMerge && canEdit && recordAccess.canMutate(lead)) {
      const convertIdx = actions.findIndex((a) => a.id === 'convert');
      const insertAt = convertIdx >= 0 ? convertIdx + 1 : actions.length - 1;
      actions.splice(insertAt, 0, {
        id: 'merge',
        label: 'Merge with...',
        icon: <GitMerge size={14} />,
        onClick: () => onMerge(lead),
      });
    }

    return actions;
  }, [router, onRowClick, onEdit, onArchive, onConvert, onMerge, canEdit, canArchive, recordAccess.canMutate]);

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
        columns={configuredColumns}
        data={leads}
        getRowId={getRowId}
        height="auto"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        sortingMode="external"
        sortFields={getTableSortFields('leads')} defaultSort={{ field: 'lastSalesActivityAt', direction: 'desc' }}
        onSortReset={() => onSortChange?.(null)}
        sort={sort}
        onSortChange={onSortChange}
        onRowClick={onRowClick}
        enableColumnMenu
        onHideColumn={onHideColumn}
        columnWidths={Object.fromEntries(effectiveColumns.filter(column => column.width !== undefined).map(column => [column.id, column.width!]))}
        onColumnWidthChange={onColumnWidthChange}
        rowActions={getRowActions}
        summaryLabel={`${totalRecords} total records`}
        emptyMessage="No leads found. Adjust your filters or create a new lead."
        ariaLabel="Leads data grid"
        highlightRowId={highlightRowId}
        viewMode={viewMode}
      />
    </div>
  );
}
