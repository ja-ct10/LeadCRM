/**
 * ContactsDataGrid — Contacts table implemented with the shared DataGrid component.
 *
 * This replaces the legacy flex-based inline layout for the "table" view type,
 * providing:
 * - Sticky header + pinned "First Name" column on horizontal scroll
 * - Resizable columns via drag handles
 * - Header-click sorting with directional chevrons
 * - Bulk selection (select-all + row checkboxes)
 * - Sticky summary footer with record count
 * - Seamless integration with existing column preference system
 *
 * Filtering/sorting state remains external (owned by contacts-page.tsx)
 * so switching between Table/List/Kanban views retains active filters.
 */

'use client';
import { getTableSortFields } from '@/shared/constants/column-registries';
import { useCrmRecordAccess } from '@/shared/hooks/use-crm-record-access';

import { useConfiguredCrmColumns } from '@/shared/hooks/use-field-layout';

import React, { useMemo, useCallback } from 'react';
import { CrmStatusIndicator } from '@/shared/components/crm/crm-status';
import { UnreadRecordDot } from '@/features/tenant/notifications/hooks/use-record-notifications';
import {
  DataGrid,
  useDataGridColumns,
  buildDefaultRowActions,
  renderDate,
  MODULE_ACCENT_COLORS,
} from '@/shared/components/data-grid';
import type { SortState, RowActionItem } from '@/shared/components/data-grid';
import type { CellRendererMap } from '@/shared/components/data-grid';
import { CONTACTS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { CONTACTS_TABLE_SORT_FIELDS, type ColumnConfigItem } from '@leadcrm/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { recordEmailComposeHref } from '@/features/tenant/inbox/services/compose-navigation';
import type { Contact } from '@/store/types';

// ─── Props Interface ─────────────────────────────────────────────────────────

interface ContactsDataGridProps {
  /** Paginated contacts for the current view */
  contacts: Contact[];
  /** Total record count */
  totalRecords: number;
  /** Column preferences from useColumnPreferences */
  effectiveColumns: ColumnConfigItem[];
  /** Current sort state */
  sort?: SortState | null;
  /** Sort change handler */
  onSortChange?: (sort: SortState | null) => void;
  /** Row click → open detail drawer */
  onRowClick: (contact: Contact) => void;
  /** Selected row IDs */
  selectedIds: Set<string>;
  /** Selection change callback */
  onSelectionChange: (ids: Set<string>) => void;
  /** Lookup: get account/company name */
  getAccountName: (contact: Contact) => string;
  /** Lookup: get assigned user name */
  getAssignedUserName: (userId?: string) => string;
  /** RBAC: can user edit */
  canEdit?: boolean;
  /** RBAC: can user archive */
  canArchive?: boolean;
  /** Open edit form for a contact */
  onEdit?: (contact: Contact) => void;
  /** Archive a contact */
  onArchive?: (contact: Contact) => void;
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

// ─── Status Variant Map (uses shared CONTACT_STATUS_VARIANTS) ────────────────

// ─── Component ───────────────────────────────────────────────────────────────

export function ContactsDataGrid({
  contacts,
  totalRecords,
  effectiveColumns,
  sort = null,
  onSortChange,
  onRowClick,
  selectedIds,
  onSelectionChange,
  getAccountName,
  getAssignedUserName,
  canEdit = false,
  canArchive = false,
  onEdit,
  onArchive,
  onManageColumns,
  onHideColumn,
  onColumnWidthChange,
  viewMode = 'clip',
  highlightRowId,
}: ContactsDataGridProps): React.ReactElement {
  const recordAccess = useCrmRecordAccess();
  const router = useRouter();
  // ─── Cell Renderers ────────────────────────────────────────────────────

  const cellRenderers: CellRendererMap<Contact> = useMemo(() => ({
    firstName: (_value: unknown, row: Contact) => {
      const name = row.contactPerson ?? row.leadPerson ?? (`${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || 'Unknown');
      const initials = (() => {
        const parts = name.split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase();
      })();

      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-full ${MODULE_ACCENT_COLORS.leads} flex items-center justify-center text-white font-bold text-[10px] shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#1a73e8] dark:text-blue-400 truncate leading-tight hover:underline cursor-pointer">
              {row.firstName ?? name.split(' ')[0] ?? '—'}
            </p>
          </div>
          <UnreadRecordDot entityType="Contact" entityId={row.id} />
        </div>
      );
    },

    lastName: (_value: unknown, row: Contact) => (
      <p className="text-[13px] text-[#3C4858] dark:text-slate-200 truncate">
        {row.lastName ?? '—'}
      </p>
    ),

    email: (_value: unknown, row: Contact) => (
      <p className="text-[12px] text-[#3C4858] dark:text-slate-200 truncate">{row.email ?? '—'}</p>
    ),

    phone: (_value: unknown, row: Contact) => (
      <p className="text-[12px] text-[#3C4858] dark:text-slate-200 truncate">{row.phone ?? '—'}</p>
    ),

    companyName: (_value: unknown, row: Contact) => <span>{row.companyName?.trim() || '—'}</span>,

    status: (_value: unknown, row: Contact) => <CrmStatusIndicator status={row.status} />,

    source: (_value: unknown, row: Contact) => (
      <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {row.source ?? '—'}
      </p>
    ),

    assignedUserId: (_value: unknown, row: Contact) => (
      <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
        {row.assignedUser
          ? `${row.assignedUser.firstName} ${row.assignedUser.lastName}`.trim() || getAssignedUserName(row.assignedUserId)
          : getAssignedUserName(row.assignedUserId)}
      </p>
    ),

    accountId: (_value: unknown, row: Contact) => {
      const accountId = row.accountId ?? row.account?.id ?? row.organizationId;
      return accountId ? <Link href={`/crm/accounts/${encodeURIComponent(accountId)}`} onClick={event => event.stopPropagation()}
        className="text-[12px] text-blue-600 dark:text-blue-400 hover:underline truncate">{getAccountName(row)}</Link> : '—';
    },

    createdAt: (_value: unknown, row: Contact) => renderDate(row.createdAt),
  }), [getAccountName, getAssignedUserName]);

  // ─── Column Configuration ──────────────────────────────────────────────

  const { gridColumns } = useDataGridColumns<Contact>({
    registry: CONTACTS_COLUMN_REGISTRY,
    effectiveColumns,
    cellRenderers,
    pinnedColumns: ['firstName'],
    sortableColumns: CONTACTS_TABLE_SORT_FIELDS,
    resizableColumns: 'all',
    defaultWidths: {
      firstName: 200,
      lastName: 160,
      email: 220,
      phone: 150,
      companyName: 180,
      status: 120,
      source: 140,
      assignedUserId: 160,
      accountId: 180,
      createdAt: 140,
    },
  });

  // ─── Stable Callbacks ────────────────────────────────────────────────

  const configuredColumns = useConfiguredCrmColumns('contacts', gridColumns);

  const getRowId = useCallback((contact: Contact) => contact.id, []);

  // ─── Row Actions (⋯ menu) ─────────────────────────────────────────────

  const getRowActions = useCallback((contact: Contact): RowActionItem[] => {
    return buildDefaultRowActions({
      onView: () => onRowClick(contact),
      onEdit: onEdit ? () => onEdit(contact) : undefined,
      onSendEmail: contact.email ? () => router.push(recordEmailComposeHref(contact.email ?? '') ?? '/inbox') : undefined,
      onArchive: onArchive ? () => onArchive(contact) : undefined,
      onCopyUrl: () => {
        navigator.clipboard.writeText(`${window.location.origin}/crm/contacts/${contact.id}`);
      },
      canEdit: canEdit && recordAccess.canMutate(contact),
      canArchive: canArchive && recordAccess.canMutate(contact),
    });
  }, [onRowClick, onEdit, onArchive, canEdit, canArchive, recordAccess.canMutate, router]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <DataGrid<Contact>
      columns={configuredColumns}
      data={contacts}
      getRowId={getRowId}
      height="auto"
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      sortingMode="external"
      sortFields={getTableSortFields('contacts')} defaultSort={{ field: 'lastSalesActivityAt', direction: 'desc' }}
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
      emptyMessage="No contacts found. Adjust your filters or create a new contact."
      ariaLabel="Contacts data grid"
      highlightRowId={highlightRowId}
      viewMode={viewMode}
    />
  );
}
