'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ModuleWorkspace, ViewType, RecordDrawer, StatusBadge } from '@/shared/components/crm';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useColumnPreferences } from '@/shared/hooks/use-column-preferences';
import { useAccounts } from '../hooks/use-accounts';
import { useData } from '@/store/DataContext';
import { useFilterUrlSync } from '@/shared/hooks/use-filter-url-sync';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { ManageColumnsDrawer } from '@/shared/components/manage-columns-drawer';
import { ACCOUNTS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { getResponsiveColumnClass, getColumnLabel, getDefaultVisibleColumns } from '@/shared/components/column-table-helpers';
import AccountForm from '../ui/account-form';
import { SideSheet } from '@/shared/components/side-sheet';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SlidersHorizontal } from 'lucide-react';
import type { Account } from '../types/account.types';
import type { ColumnConfigItem } from '@leadcrm/shared';

// ── Accounts Page ─────────────────────────────────────────────────────────────

export default function AccountsPage(): React.ReactElement {
  const canCreate = useHasPermission('contacts.create');
  const canEdit = useHasPermission('contacts.edit');
  const canDelete = useHasPermission('contacts.delete');

  const {
    accounts,
    totalCount,
    filters,
    setFilters,
    isFormOpen,
    editTarget,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseForm,
  } = useAccounts();

  const { deals, users } = useData();
  const { getParam, getArrayParam, updateParams } = useFilterUrlSync();

  // ── Column Preferences ────────────────────────────────────────────────
  const {
    effectiveColumns,
    isLoading: isColumnsLoading,
    saveColumns,
    resetColumns,
  } = useColumnPreferences('accounts');

  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);
  const manageColumnsButtonRef = useRef<HTMLButtonElement>(null);

  /** Visible columns sorted by order — drives table rendering */
  const visibleColumns = useMemo((): ColumnConfigItem[] => {
    if (effectiveColumns.length === 0) {
      return getDefaultVisibleColumns(ACCOUNTS_COLUMN_REGISTRY);
    }
    return [...effectiveColumns]
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order);
  }, [effectiveColumns]);

  // ── State (Synced with URL) ──────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewType>(() => (getParam('view') as ViewType) || 'list');
  const [activeTab, setActiveTab] = useState(() => getParam('tab') || 'all');
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => getParam('search'));
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Multi-criteria filter state
  const [selectedSystemFilters, setSelectedSystemFilters] = useState<string[]>(() => getArrayParam('system'));
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(() => getArrayParam('industries'));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => getArrayParam('types'));
  const [selectedOwners, setSelectedOwners] = useState<string[]>(() => getArrayParam('owners'));
  const [selectedRelated, setSelectedRelated] = useState<string[]>(() => getArrayParam('related'));

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Sync to URL
  useEffect(() => {
    updateParams({
      tab: activeTab !== 'all' ? activeTab : null,
      search: debouncedSearch || null,
      view: activeView !== 'list' ? activeView : null,
      system: selectedSystemFilters,
      industries: selectedIndustries,
      types: selectedTypes,
      owners: selectedOwners,
      related: selectedRelated,
    });
  }, [activeTab, debouncedSearch, activeView, selectedSystemFilters, selectedIndustries, selectedTypes, selectedOwners, selectedRelated, updateParams]);

  // ── Filtered list ────────────────────────────────────────────────────
  const filteredAccounts = useMemo(() => {
    let result = accounts;

    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          (a.industry ?? '').toLowerCase().includes(term) ||
          (a.city ?? '').toLowerCase().includes(term),
      );
    }

    if (selectedIndustries.length > 0) {
      result = result.filter((a) => selectedIndustries.includes(a.industry ?? ''));
    }

    if (selectedTypes.length > 0) {
      result = result.filter((a) => selectedTypes.includes(a.size ?? ''));
    }

    if (selectedOwners.length > 0) {
      result = result.filter((a) => selectedOwners.includes(a.assignedUserId ?? ''));
    }

    if (selectedRelated.includes('has_deals')) {
      result = result.filter((a) => deals.some((d) => d.organizationId === a.id && !d.isArchived));
    }

    return result;
  }, [accounts, debouncedSearch, selectedIndustries, selectedTypes, selectedOwners, selectedRelated, deals]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getOwnerName = (userId?: string): string => {
    if (!userId) return '—';
    const u = users.find((usr) => usr.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : '—';
  };

  const getAccountDeals = (accountId: string): number => {
    return deals.filter((d) => d.organizationId === accountId && !d.isArchived).length;
  };

  const getAccountValue = (accountId: string): number => {
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
    const set = new Set<string>();
    accounts.forEach((a) => { if (a.industry) set.add(a.industry); });
    return Array.from(set);
  }, [accounts]);

  const distinctSizes = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((a) => {
      if (a.size) set.add(a.size);
    });
    return Array.from(set);
  }, [accounts]);

  const filterGroups = useMemo(() => [
    {
      id: 'system',
      label: 'System Defined Filters',
      isExpanded: true,
      items: [
        { id: 'touched', label: 'Touched Records', count: accounts.length, isChecked: selectedSystemFilters.includes('touched') },
        { id: 'untouched', label: 'Untouched Records', count: 0, isChecked: selectedSystemFilters.includes('untouched') },
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
          count: accounts.filter((a) => a.industry === ind).length,
          isChecked: selectedIndustries.includes(ind),
        })),
        ...distinctSizes.map((sz) => ({
          id: `size:${sz}`,
          label: `Size: ${sz}`,
          count: accounts.filter((a) => a.size === sz).length,
          isChecked: selectedTypes.includes(sz),
        })),
        ...users.slice(0, 5).map((u) => ({
          id: `owner:${u.id}`,
          label: `Owner: ${u.firstName} ${u.lastName}`,
          count: accounts.filter((a) => a.assignedUserId === u.id).length,
          isChecked: selectedOwners.includes(u.id),
        })),
      ],
    },
    {
      id: 'related',
      label: 'Filter By Related Modules',
      isExpanded: true,
      items: [
        { id: 'has_deals', label: 'Accounts with Deals', count: accounts.filter((a) => deals.some((d) => d.organizationId === a.id && !d.isArchived)).length, isChecked: selectedRelated.includes('has_deals') },
      ],
    },
  ], [accounts, distinctIndustries, distinctSizes, selectedSystemFilters, selectedIndustries, selectedTypes, users, selectedOwners, selectedRelated, deals]);

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
      } else if (itemId.startsWith('type:')) {
        const typ = itemId.replace('type:', '');
        setSelectedTypes((prev) =>
          prev.includes(typ) ? prev.filter((x) => x !== typ) : [...prev, typ],
        );
      } else if (itemId.startsWith('owner:')) {
        const ownerId = itemId.replace('owner:', '');
        setSelectedOwners((prev) =>
          prev.includes(ownerId) ? prev.filter((x) => x !== ownerId) : [...prev, ownerId],
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

  const handleSubmit = (data: any) => {
    if (editTarget) {
      handleUpdate(editTarget.id, data);
    } else {
      handleCreate(data);
    }
  };

  return (
    <>
      <ModuleWorkspace
        title="Accounts"
        primaryActionLabel="Add Account"
        onPrimaryAction={handleOpenCreate}
        onImport={() => toast.info('Import feature coming soon')}
        canCreate={canCreate}
        availableViews={['list', 'tile', 'table', 'grid']}
        activeView={activeView}
        onViewChange={setActiveView}
        savedTabs={[
          { id: 'all', label: 'All Accounts' },
          { id: 'my', label: 'My Accounts' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filterGroups={filterGroups}
        onFilterToggle={handleFilterToggle}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filterSearchTerm={filterSearchTerm}
        onFilterSearch={setFilterSearchTerm}
        totalRecords={filteredAccounts.length}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search accounts..."
        onSort={() => toast.info('Sort feature coming soon')}
        onRefresh={() => toast.success('Refreshed')}
        toolbarExtra={
          <button
            ref={manageColumnsButtonRef}
            onClick={() => setIsManageColumnsOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-[#5A6B85] dark:text-slate-300 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            aria-label="Manage columns"
          >
            <SlidersHorizontal size={13} />
            Columns
          </button>
        }
      >
        {/* List View — Dynamic Columns */}
        {(activeView === 'list' || activeView === 'table') && (
          <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden overflow-x-auto">
            {/* Header */}
            <div
              className={cn(
                'flex items-center border-b border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60 sticky top-0 z-10',
                'text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 h-11 px-3',
              )}
            >
              <label className="flex items-center justify-center w-10 shrink-0">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
                  aria-label="Select all accounts"
                />
              </label>
              {visibleColumns.map((col) => {
                const responsiveClass = getResponsiveColumnClass(col.id, visibleColumns, ACCOUNTS_COLUMN_REGISTRY);
                return (
                  <span key={col.id} className={cn('px-3 truncate flex-1 min-w-0', responsiveClass)}>
                    {getColumnLabel(col.id, ACCOUNTS_COLUMN_REGISTRY)}
                  </span>
                );
              })}
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#E4E9F0] dark:divide-slate-700">
              {filteredAccounts.map((account) => (
                <div
                  key={account.id}
                  onClick={() => handleRowClick(account)}
                  className="flex items-center h-[52px] px-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <label className="flex items-center justify-center w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
                      aria-label={`Select ${account.name}`}
                    />
                  </label>

                  {visibleColumns.map((col) => {
                    const responsiveClass = getResponsiveColumnClass(col.id, visibleColumns, ACCOUNTS_COLUMN_REGISTRY);
                    return (
                      <div key={col.id} className={cn('px-3 min-w-0 flex-1', responsiveClass)}>
                        {renderAccountCell(col.id, account)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60">
              <span className="text-[12px] text-[#5A6B85]">
                Total records <strong className="font-semibold text-[#0F172A] dark:text-white">{filteredAccounts.length}</strong>
              </span>
            </div>
          </div>
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
                  <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                    {getInitials(account.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate">
                      {account.name}
                    </p>
                    <p className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                      {account.industry ?? '—'} · {account.city ?? ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#E4E9F0] dark:border-slate-700">
                  <span className="text-[12px] text-[#5A6B85]">
                    {getAccountDeals(account.id)} deals
                  </span>
                  <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                    {formatCurrency(getAccountValue(account.id))}
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
                <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                  {getInitials(account.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white truncate">
                    {account.name}
                  </p>
                  <p className="text-[10.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                    {account.industry ?? '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ModuleWorkspace>

      {/* Form Sheet */}
      <SideSheet
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editTarget ? 'Edit Account' : 'New Account'}
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
    </>
  );

  // ── Dynamic cell renderer ────────────────────────────────────────────
  function renderAccountCell(colId: string, account: Account): React.ReactNode {
    switch (colId) {
      case 'name':
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
              {getInitials(account.name)}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate group-hover:text-[#2563EB] transition-colors">
                {account.name}
              </p>
              <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate">
                {[account.city, account.country].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        );
      case 'industry':
        return (
          <p className="text-[12.5px] text-[#0F172A] dark:text-slate-200 truncate">
            {account.industry ?? '—'}
          </p>
        );
      case 'customerType':
        return (
          <StatusBadge
            label={account.customerType ?? 'Prospect'}
            variant={getStatusVariant(account.customerType)}
            dot={false}
          />
        );
      case 'size':
        return (
          <p className="text-[12.5px] text-[#0F172A] dark:text-slate-200 truncate">
            {account.size ?? '—'}
          </p>
        );
      case 'city':
        return (
          <p className="text-[12.5px] text-[#0F172A] dark:text-slate-200 truncate">
            {account.city ?? '—'}
          </p>
        );
      case 'country':
        return (
          <p className="text-[12.5px] text-[#0F172A] dark:text-slate-200 truncate">
            {account.country ?? '—'}
          </p>
        );
      case 'assignedUserId':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {getOwnerName(account.assignedUserId)}
          </p>
        );
      case 'website':
        return (
          <p className="text-[12px] text-[#2563EB] dark:text-blue-400 truncate">
            {account.website ?? '—'}
          </p>
        );
      case 'tags':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {account.tags && account.tags.length > 0
              ? account.tags.join(', ')
              : '—'}
          </p>
        );
      case 'createdAt':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {account.createdAt
              ? new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '—'}
          </p>
        );
      default:
        return <span className="text-[12px] text-[#5A6B85]">—</span>;
    }
  }
}

// ── Currency formatter ─────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `$${value.toLocaleString()}`;
}
