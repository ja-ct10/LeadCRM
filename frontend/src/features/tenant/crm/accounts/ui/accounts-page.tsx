'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ModuleWorkspace, ViewType, RecordDrawer, StatusBadge } from '@/shared/components/crm';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useAccounts } from '../hooks/use-accounts';
import { useData } from '@/store/DataContext';
import AccountForm from '../ui/account-form';
import { SideSheet } from '@/shared/components/side-sheet';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Account } from '../types/account.types';

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

  // ── State ────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewType>('list');
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ── Filtered list ────────────────────────────────────────────────────
  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    const term = searchTerm.toLowerCase();
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        (a.industry ?? '').toLowerCase().includes(term) ||
        (a.city ?? '').toLowerCase().includes(term),
    );
  }, [accounts, searchTerm]);

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
  const filterGroups = useMemo(() => [
    {
      id: 'system',
      label: 'System Defined Filters',
      isExpanded: true,
      items: [
        { id: 'touched', label: 'Touched Records', count: accounts.length, isChecked: false },
        { id: 'untouched', label: 'Untouched Records', count: 0, isChecked: false },
      ],
    },
    {
      id: 'fields',
      label: 'Filter By Fields',
      isExpanded: true,
      items: [
        { id: 'account-owner', label: 'Account Owner', isChecked: false },
        { id: 'account-type', label: 'Account Type', isChecked: false },
        { id: 'industry', label: 'Industry', isChecked: false },
        { id: 'employees', label: 'Employees', isChecked: false },
        { id: 'status', label: 'Status', isChecked: false },
        { id: 'billing-country', label: 'Billing Country', isChecked: false },
        { id: 'website', label: 'Website', isChecked: false },
        { id: 'created-time', label: 'Created Time', isChecked: false },
      ],
    },
    {
      id: 'related',
      label: 'Filter By Related Modules',
      isExpanded: false,
      items: [],
    },
  ], [accounts]);

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
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filterSearchTerm={filterSearchTerm}
        onFilterSearch={setFilterSearchTerm}
        totalRecords={filteredAccounts.length}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search accounts..."
        onSort={() => toast.info('Sort options coming soon')}
        onRefresh={() => toast.success('Refreshed')}
      >
        {/* List View */}
        {(activeView === 'list' || activeView === 'table') && (
          <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[40px_1.5fr_1fr_1fr_1fr_100px_100px_100px] items-center h-11 px-3 border-b border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60 text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400">
              <span />
              <span className="px-3">ACCOUNT NAME</span>
              <span className="px-3">INDUSTRY</span>
              <span className="px-3">ACCOUNT TYPE</span>
              <span className="px-3">STATUS</span>
              <span className="px-3 text-center">OPEN DEALS</span>
              <span className="px-3 text-right">TOTAL VALUE</span>
              <span className="px-3 text-right">OWNER</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#E4E9F0] dark:divide-slate-700">
              {filteredAccounts.map((account) => (
                <div
                  key={account.id}
                  onClick={() => handleRowClick(account)}
                  className="grid grid-cols-[40px_1.5fr_1fr_1fr_1fr_100px_100px_100px] items-center h-[52px] px-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <label className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
                      aria-label={`Select ${account.name}`}
                    />
                  </label>

                  {/* Name + avatar */}
                  <div className="flex items-center gap-2.5 px-3 min-w-0">
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

                  {/* Industry */}
                  <div className="px-3">
                    <p className="text-[12.5px] text-[#0F172A] dark:text-slate-200 truncate">
                      {account.industry ?? '—'}
                    </p>
                  </div>

                  {/* Account Type */}
                  <div className="px-3">
                    <StatusBadge
                      label="Customer"
                      variant="success"
                      dot={false}
                    />
                  </div>

                  {/* Status */}
                  <div className="px-3">
                    <StatusBadge
                      label="Active"
                      variant="success"
                    />
                  </div>

                  {/* Open Deals */}
                  <div className="px-3 text-center">
                    <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                      {getAccountDeals(account.id)}
                    </span>
                  </div>

                  {/* Total Value */}
                  <div className="px-3 text-right">
                    <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                      {formatCurrency(getAccountValue(account.id))}
                    </span>
                  </div>

                  {/* Owner */}
                  <div className="px-3 text-right">
                    <span className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                      {getOwnerName(account.assignedUserId)}
                    </span>
                  </div>
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
    </>
  );
}

// ── Currency formatter ─────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `$${value.toLocaleString()}`;
}
