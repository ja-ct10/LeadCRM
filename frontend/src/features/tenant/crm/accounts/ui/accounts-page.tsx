'use client';
import { useCrmTabs } from '@/shared/hooks/use-crm-tabs';
import { UnreadRecordDot } from '@/features/tenant/notifications/hooks/use-record-notifications';
import { useCrmRecordAccess } from '@/shared/hooks/use-crm-record-access';

import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { Button } from '@/shared/components/ui/button';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import { ExportCsvButton } from '@/shared/components/crm/export-csv-button';
import { moduleListParams } from '@/shared/services/module-list-params';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ModuleWorkspace, ViewType, AccountPanel, StatusBadge } from '@/shared/components/crm';
import { DataErrorState } from '@/shared/components/crm/data-view-states';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useColumnPreferences } from '@/shared/hooks/use-column-preferences';
import { useAccounts } from '../hooks/use-accounts';
import { useData } from '@/store/DataContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { useFilterUrlSync } from '@/shared/hooks/use-filter-url-sync';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { useTablePreferences } from '@/shared/hooks/use-table-preferences';
import { ManageColumnsDrawer } from '@/shared/components/manage-columns-drawer';
import { ACCOUNTS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { ACCOUNTS_MODULE_CONFIG } from '../accounts.config';
import { AccountsDataGrid } from './accounts-data-grid';
import AccountForm from '../ui/account-form';
import { useRouter } from 'next/navigation';
// @deprecated — ImportAccountsDrawer replaced by full-page import at /crm/accounts/import
// import { ImportAccountsDrawer } from './import-accounts-drawer';
import { SideSheet } from '@/shared/components/side-sheet';
import { ColumnsPopover } from '@/shared/components/data-grid';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';
import { ActionableEmptyState } from '@/shared/components/actionable-empty-state';
import { LeadsPagination } from '@/shared/components/crm/leads-pagination';
import type { Account } from '../types/account.types';
import type { ColumnConfigItem } from '@leadcrm/shared';

// ── Accounts Page ─────────────────────────────────────────────────────────────

export default function AccountsPage(): React.ReactElement {
  const tabAccess = useCrmTabs('accounts', [{ id: 'all', label: 'All Accounts' }]);
  const router = useRouter();
  const { dialogProps, confirm, close } = useConfirmDialog();
  const canCreate = useHasPermission('accounts.create');
  const canImport = useHasPermission('accounts.import');
  const canEdit = useHasPermission('accounts.edit');
  const canDelete = useHasPermission('accounts.archive');
  const recordAccess = useCrmRecordAccess('accounts');

  const { deals } = useData();
  const { getParam, getArrayParam, updateParams } = useFilterUrlSync('accounts');

  // ── Column Preferences ────────────────────────────────────────────────
  const {
    effectiveColumns,
    isLoading: isColumnsLoading,
    saveColumns,
    saveColumnWidth,
    resetColumns,
    resetColumnWidths,
  } = useColumnPreferences('accounts');

  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);
  const manageColumnsButtonRef = useRef<HTMLElement | null>(null);
  const openManageColumns = () => { manageColumnsButtonRef.current = document.activeElement as HTMLElement; setIsManageColumnsOpen(true); };

  // ── Table Preferences (pageSize, viewMode, sort) ──────────────────────
  const {
    pageSize,
    viewMode,
    sort,
    setPageSize,
    setViewMode,
    setSort,
    persistFilters,
  } = useTablePreferences('accounts');

  // ── State (Synced with URL) ──────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewType>(() => (getParam('view') as ViewType) || 'list');
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => getParam('search'));
  const highlightId = getParam('highlight') ?? undefined;
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [accountSelectedIds, setAccountSelectedIds] = useState<Set<string>>(new Set());

  // Multi-criteria filter state
  const [selectedSystemFilters, setSelectedSystemFilters] = useState<string[]>(() => getArrayParam('system'));
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(() => getArrayParam('industries'));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => getArrayParam('types'));
  const [selectedRelated, setSelectedRelated] = useState<string[]>(() => getArrayParam('related'));

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!highlightId) return;
    setSearchTerm(''); setActiveTab('all'); setActiveView('table'); setCurrentPage(1);
    setSelectedSystemFilters([]);
    setSelectedIndustries([]);
    setSelectedTypes([]);
    setSelectedRelated([]);
  }, [highlightId]);

  // ── Sync to URL ────────────────────────────────────────────────────────
  useEffect(() => {
    if (highlightId) return;
    updateParams({
      tab: null, owners: null,
      search: debouncedSearch || null,
      view: activeView !== 'list' ? activeView : null,
      system: selectedSystemFilters,
      industries: selectedIndustries,
      types: selectedTypes,
      related: selectedRelated,
    });
  }, [activeTab, debouncedSearch, activeView, selectedSystemFilters, selectedIndustries, selectedTypes, selectedRelated, highlightId, updateParams]);

  // ── Persist filter selections (fire-and-forget) ────────────────────────
  useEffect(() => {
    const conditions: { field: string; operator: string; value: unknown }[] = [];
    if (selectedIndustries.length > 0) {
      conditions.push({ field: 'industry', operator: 'in', value: selectedIndustries });
    }
    if (selectedTypes.length > 0) {
      conditions.push({ field: 'size', operator: 'in', value: selectedTypes });
    }
    if (selectedRelated.length > 0) {
      conditions.push({ field: 'related', operator: 'in', value: selectedRelated });
    }
    if (selectedSystemFilters.length > 0) {
      conditions.push({ field: 'system', operator: 'in', value: selectedSystemFilters });
    }
    persistFilters(conditions);
  }, [selectedIndustries, selectedTypes, selectedRelated, selectedSystemFilters, persistFilters]);

  // ── Pagination ───────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // ── Server-side filter conditions ─────────────────────────────────────────
  const serverFilters = useMemo((): import('@leadcrm/shared').FilterCondition[] => {
    const conditions: import('@leadcrm/shared').FilterCondition[] = [];
    if (selectedIndustries.length > 0) {
      conditions.push({ field: 'industry', operator: 'in', value: selectedIndustries });
    }
    if (selectedTypes.length > 0) {
      conditions.push({ field: 'size', operator: 'in', value: selectedTypes });
    }
    if (selectedSystemFilters.length) conditions.push({ field: 'system', operator: 'in', value: selectedSystemFilters });
    if (selectedRelated.length) conditions.push({ field: 'related', operator: 'in', value: selectedRelated });
    return conditions;
  }, [selectedIndustries, selectedTypes, selectedSystemFilters, selectedRelated]);

  const {
    accounts,
    totalCount,
    facets,
    filters,
    setFilters,
    isFormOpen,
    isLoading,
    isRefreshing,
    error: accountsError,
    refetch: refetchAccounts,
    editTarget,
    handleCreate,
    handleUpdate,
    handleArchive,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseForm,
  } = useAccounts({
    disabled: !tabAccess.firstId,
    page: highlightId ? 1 : currentPage,
    recordId: highlightId,
    pageSize,
    sort: sort ?? null,
    search: debouncedSearch || undefined,
    filter: serverFilters.length > 0 ? serverFilters : undefined,
  });

  useEffect(() => {
    if (accountsError) toast.error(accountsError);
  }, [accountsError]);

  // Server total from metadata
  const serverTotal = totalCount;
  useEffect(() => {
    if (!isLoading && !isRefreshing && !accountsError && currentPage > Math.max(1, Math.ceil(serverTotal / pageSize))) setCurrentPage(Math.max(1, Math.ceil(serverTotal / pageSize)));
  }, [isLoading, isRefreshing, accountsError, currentPage, serverTotal, pageSize]);

  // Reset page on filter/search/pageSize/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedIndustries, selectedTypes, selectedRelated, selectedSystemFilters, pageSize, sort]);

  const filteredAccounts = useMemo(() => {
    if (!USE_MOCK_DATA || highlightId) return accounts;
    return accounts.filter(a => {
      const touched = Boolean(a.updatedAt && a.updatedAt > a.createdAt);
      return (!selectedRelated.includes('has_deals') || deals.some(d => d.organizationId === a.id && !d.isArchived)) &&
        (selectedSystemFilters.length !== 1 || (selectedSystemFilters[0] === 'touched') === touched);
    });
  }, [accounts, selectedRelated, selectedSystemFilters, deals, highlightId]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };


  const getAccountDeals = (accountId: string): number | string => {
    return USE_MOCK_DATA ? deals.filter((d) => d.organizationId === accountId && !d.isArchived).length
      : accounts.find(a => a.id === accountId)?.dealCount ?? '—';
  };

  const getAccountValue = (accountId: string): number => {
    if (!USE_MOCK_DATA) return accounts.find(a => a.id === accountId)?.dealValue ?? 0;
    return deals
      .filter((d) => d.organizationId === accountId && !d.isArchived)
      .reduce((sum, d) => sum + (d.value ?? 0), 0);
  };

  const getStatusVariant = (type?: string): 'success' | 'info' | 'purple' | 'danger' | 'neutral' => {
    if (type === 'Customer' || type === 'Active') return 'success';
    if (type === 'Prospect') return 'info';
    if (type === 'Partner') return 'purple';
    if (type === 'Churned') return 'danger';
    return 'neutral';
  };

  // ── Filter groups ────────────────────────────────────────────────────
  const distinctIndustries = useMemo(() => {
    if (!USE_MOCK_DATA) return Object.keys(facets).filter(key => key.startsWith('industry:')).map(key => key.slice(9));
    const set = new Set<string>();
    accounts.forEach((a) => { if (a.industry) set.add(a.industry); });
    return Array.from(set);
  }, [accounts, facets]);

  const distinctSizes = useMemo(() => {
    if (!USE_MOCK_DATA) return Object.keys(facets).filter(key => key.startsWith('size:')).map(key => key.slice(5));
    const set = new Set<string>();
    accounts.forEach((a) => {
      if (a.size) set.add(a.size);
    });
    return Array.from(set);
  }, [accounts, facets]);

  const filterGroups = useMemo(() => [
    {
      id: 'system',
      label: 'System Defined Filters',
      isExpanded: true,
      items: [
        { id: 'touched', label: 'Updated Records', count: facets.touched ?? accounts.filter(a => a.updatedAt && a.updatedAt > a.createdAt).length, isChecked: selectedSystemFilters.includes('touched') },
        { id: 'untouched', label: 'Never Updated', count: facets.untouched ?? accounts.filter(a => !a.updatedAt || a.updatedAt <= a.createdAt).length, isChecked: selectedSystemFilters.includes('untouched') },
      ],
    },
    {
      id: 'fields',
      label: 'Filter By Fields',
      isExpanded: true,
      items: [
        ...distinctIndustries.map((ind) => ({
          id: `industry:${ind}`,
          label: `Industry: ${ind}`,
          count: facets['industry:' + ind] ?? accounts.filter((a) => a.industry === ind).length,
          isChecked: selectedIndustries.includes(ind),
        })),
        ...distinctSizes.map((sz) => ({
          id: `size:${sz}`,
          label: `Size: ${sz}`,
          count: facets['size:' + sz] ?? accounts.filter((a) => a.size === sz).length,
          isChecked: selectedTypes.includes(sz),
        })),
      ],
    },
    {
      id: 'related',
      label: 'Filter By Related Modules',
      isExpanded: true,
      items: [
        { id: 'has_deals', label: 'Accounts with Deals', count: facets.has_deals ?? 0, isChecked: selectedRelated.includes('has_deals') },
      ],
    },
  ], [accounts, facets, distinctIndustries, distinctSizes, selectedSystemFilters, selectedIndustries, selectedTypes, selectedRelated]);

  const handleFilterToggle = useCallback((groupId: string, itemId: string) => {
    if (groupId === 'system') {
      setSelectedSystemFilters((prev) =>
        prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
      );
    } else if (groupId === 'fields') {
      if (itemId.startsWith('industry:')) {
        const ind = itemId.replace('industry:', '');
        setSelectedIndustries((prev) =>
          prev.includes(ind) ? prev.filter((x) => x !== ind) : [...prev, ind],
        );
      } else if (itemId.startsWith('size:')) {
        const typ = itemId.replace('size:', '');
        setSelectedTypes((prev) =>
          prev.includes(typ) ? prev.filter((x) => x !== typ) : [...prev, typ],
        );
      }
    } else if (groupId === 'related') {
      setSelectedRelated((prev) =>
        prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
      );
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleRowClick = useCallback((account: Account) => {
    setSelectedAccount(account);
    setDrawerTab('overview');
  }, []);

  const handleSubmit = async (data: any) => {
    if (editTarget) {
      await handleUpdate(editTarget.id, data);
    } else {
      await handleCreate(data);
    }
  };

  const confirmArchive = (ids: string[], name: string) => confirm({
    title: 'Archive Account' + (ids.length > 1 ? 's?' : '?'),
    description: `${name} will be removed from active Accounts and moved to Archived Data. You can restore this record later.`,
    confirmLabel: 'Archive',
    variant: 'destructive',
    onConfirm: async () => {
      const results = await Promise.allSettled(ids.map(id => handleArchive(id)));
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected');
      setAccountSelectedIds(previous => new Set([...previous].filter(id => failedIds.includes(id))));

      if (failedIds.length) {
        confirmArchive(failedIds, ids.length === 1 ? name : `${failedIds.length} account${failedIds.length === 1 ? '' : 's'}`);
        const failure = results.find(result => result.status === 'rejected');
        throw new Error(failure?.status === 'rejected' && failure.reason instanceof Error ? failure.reason.message : 'Unable to archive the remaining records. Please try again.');
      }
      close();
      toast.success('Account archived');
    },
  });

  React.useLayoutEffect(() => { setSelectedAccount(null); setAccountSelectedIds(new Set()); }, [tabAccess.firstId]);

  if (!tabAccess.firstId) return <p role="alert" className="p-4">You do not have permission to access this module.</p>;

  return (
    <>
      <ConfirmActionDialog {...dialogProps} />
      <ModuleWorkspace
        exportAction={<ExportCsvButton module="accounts" params={moduleListParams({ search: debouncedSearch, filter: serverFilters, sort })} />}
        bulkSelection={{ count: accountSelectedIds.size, onClear: () => setAccountSelectedIds(new Set()), actions: canDelete && <Button variant="outline" disabled={[...accountSelectedIds].some(id => !recordAccess.canMutate(accounts.find(record => record.id === id)))} onClick={() => confirmArchive([...accountSelectedIds], `${accountSelectedIds.size} accounts`)}>Archive</Button> }}
        moduleId="accounts"
        title="Accounts"
        description="Manage companies and organizations linked to CRM records."
        moduleConfig={ACCOUNTS_MODULE_CONFIG}
        primaryActionLabel="Add Account"
        onPrimaryAction={handleOpenCreate}
        onImport={canImport ? () => router.push('/crm/accounts/import') : undefined}
        canCreate={canCreate}
        availableViews={['table']}
        activeView={'table' as ViewType}
        onViewChange={setActiveView}

        pageSize={pageSize}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        savedTabs={tabAccess.tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filterGroups={filterGroups}
        onFilterToggle={handleFilterToggle}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filterSearchTerm={filterSearchTerm}
        onFilterSearch={setFilterSearchTerm}
        totalRecords={serverTotal}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search accounts..."
        onRefresh={refetchAccounts}
        refreshDisabled={isLoading || isRefreshing}
        refreshing={isRefreshing}
        loading={isLoading || isColumnsLoading}
        loadingLabel={isLoading ? 'Loading accounts...' : 'Loading columns...'}
        onManageColumns={openManageColumns}
        sort={sort}
        onSortChange={next => { setSort(next); setCurrentPage(1); }}
        onResetColumns={resetColumnWidths}
      >
        {highlightId && <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-500">
          <span>Showing selected search result</span>
          <button className="text-blue-600 underline" onClick={() => updateParams({ highlight: null, search: null })}>Show all records</button>
        </div>}
        {/* List View — DataGrid */}
        {(activeView === 'list' || activeView === 'table') && (
          <>
            {accountsError && accounts.length === 0 && <DataErrorState message={accountsError} onRetry={refetchAccounts} />}
            {filteredAccounts.length === 0 && !isLoading && !accountsError && (
              <ActionableEmptyState
                icon={Building2}
                title={debouncedSearch ? 'No accounts match your search' : 'No accounts yet'}
                description={
                  debouncedSearch
                    ? 'Try a different search term or clear your filters.'
                    : 'Add your first account to start tracking your companies and organisations.'
                }
                actionLabel={!debouncedSearch && canCreate ? 'Add Account' : undefined}
                onAction={!debouncedSearch && canCreate ? handleOpenCreate : undefined}
              />
            )}
            {filteredAccounts.length > 0 && (
          <AccountsDataGrid
            sort={sort}
            onSortChange={next => { setSort(next); setCurrentPage(1); }}
            accounts={filteredAccounts}
            totalRecords={serverTotal}
            effectiveColumns={effectiveColumns}
            onRowClick={handleRowClick}
            selectedIds={accountSelectedIds}
            onSelectionChange={setAccountSelectedIds}
            canEdit={canEdit}
            canArchive={canDelete}
            onEdit={handleOpenEdit}
            onArchive={(account) => confirmArchive([account.id], account.name)}
            onHideColumn={async (columnId) => {
              const updated = effectiveColumns.map((col) =>
                col.id === columnId ? { ...col, visible: false } : col,
              );
              try {
                await saveColumns(updated);
              } catch {
                toast.error('Failed to hide column. Reverted.');
              }
            }}
            onColumnWidthChange={(id, width) => { void saveColumnWidth(id, width).catch(error => toast.error(error instanceof Error ? error.message : 'Unable to save column width.')); }}
            highlightRowId={highlightId}
            viewMode={viewMode}
          />
            )}
          </>
        )}

        {/* ── Bottom Pagination + Per Page ─────────────────────── */}
        {(activeView === 'list' || activeView === 'table') && serverTotal > 0 && (
          <LeadsPagination currentPage={currentPage} totalRecords={serverTotal} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }} />
        )}

        {/* Tile View */}
        {activeView === 'tile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredAccounts.map((account) => (
              <div
                key={account.id}
                onClick={() => handleRowClick(account)}
                className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[#2563EB]/30 transition-all"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                    {getInitials(account.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="text-[13px] font-medium text-[#1a73e8] dark:text-blue-400 truncate hover:underline">
                      {account.name}
                    </p><UnreadRecordDot entityType="Account" entityId={account.id} /></div>
                    <p className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                      {account.industry ?? '—'} · {account.address ?? ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#E4E9F0] dark:border-slate-700">
                  <span className="text-[12px] text-[#5A6B85]">
                    {getAccountDeals(account.id)} deals
                  </span>
                  <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                    {USE_MOCK_DATA || account.dealValue !== undefined ? formatCurrency(getAccountValue(account.id)) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid View */}
        {activeView === 'grid' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filteredAccounts.map((account) => (
              <div
                key={account.id}
                onClick={() => handleRowClick(account)}
                className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3 cursor-pointer hover:shadow-md transition-all flex items-center gap-2.5"
              >
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                  {getInitials(account.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="text-[13px] font-medium text-[#1a73e8] dark:text-blue-400 truncate hover:underline">
                    {account.name}
                  </p><UnreadRecordDot entityType="Account" entityId={account.id} /></div>
                  <p className="text-[10.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                    {account.industry ?? '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ModuleWorkspace>

      {/* ── Slide-Over Account Panel ──────────────────────────────── */}
      <AccountPanel
        open={!!selectedAccount}
        onOpenChange={(open) => !open && setSelectedAccount(null)}
        account={selectedAccount}
        onEdit={(acc) => handleOpenEdit(acc)}
      />

      {/* Form Sheet */}
      <SideSheet
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editTarget ? 'Edit Account' : 'New Account'}
        subtitle="Complete the account details below."
      >
        <AccountForm
          initial={editTarget}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
        />
      </SideSheet>

      {/* ── Manage Columns Drawer ───────────────────────────────── */}
      <ManageColumnsDrawer
        isOpen={isManageColumnsOpen}
        onClose={() => setIsManageColumnsOpen(false)}
        module="accounts"
        registry={ACCOUNTS_COLUMN_REGISTRY}
        effectiveColumns={effectiveColumns}
        onSave={saveColumns}
        onReset={resetColumns}
        triggerRef={manageColumnsButtonRef}
      />

      {/* ── Import Accounts — now a full-page experience at /crm/accounts/import ─── */}
    </>
  );
}

// ── Currency formatter ─────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `$${value.toLocaleString()}`;
}
