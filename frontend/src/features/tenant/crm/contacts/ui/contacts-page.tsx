'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { Contact } from '@/store/types';
import { ModuleWorkspace, ViewType, StatusBadge } from '@/shared/components/crm';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useColumnPreferences } from '@/shared/hooks/use-column-preferences';
import { useFilterUrlSync } from '@/shared/hooks/use-filter-url-sync';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { ManageColumnsDrawer } from '@/shared/components/manage-columns-drawer';
import { CONTACTS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { getResponsiveColumnClass, getColumnLabel, getDefaultVisibleColumns } from '@/shared/components/column-table-helpers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SlidersHorizontal } from 'lucide-react';
import type { ColumnConfigItem } from '@leadcrm/shared';

// ── Contacts Page ─────────────────────────────────────────────────────────────
// Shows all contacts with activity flags, customer type, account links, deals

export default function ContactsPage(): React.ReactElement {
  const { contacts, organizations, deals, users } = useData();
  const { user } = useAuth();
  const canCreate = useHasPermission('contacts.create');
  const { getParam, getArrayParam, updateParams } = useFilterUrlSync();

  // ── Column Preferences ────────────────────────────────────────────────
  const {
    effectiveColumns,
    isLoading: isColumnsLoading,
    saveColumns,
    resetColumns,
  } = useColumnPreferences('contacts');

  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);
  const manageColumnsButtonRef = useRef<HTMLButtonElement>(null);

  /** Visible columns sorted by order — drives table rendering */
  const visibleColumns = useMemo((): ColumnConfigItem[] => {
    if (effectiveColumns.length === 0) {
      return getDefaultVisibleColumns(CONTACTS_COLUMN_REGISTRY);
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

  // Multi-select stacked criteria
  const [selectedSystemFilters, setSelectedSystemFilters] = useState<string[]>(() => getArrayParam('system'));
  const [selectedCustomerTypes, setSelectedCustomerTypes] = useState<string[]>(() => getArrayParam('types'));
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
      types: selectedCustomerTypes,
      owners: selectedOwners,
      related: selectedRelated,
    });
  }, [activeTab, debouncedSearch, activeView, selectedSystemFilters, selectedCustomerTypes, selectedOwners, selectedRelated, updateParams]);

  // ── Data ─────────────────────────────────────────────────────────────
  const activeContacts = useMemo(
    () => contacts.filter((c) => !c.isArchived),
    [contacts],
  );

  const activeCustomersCount = useMemo(
    () => activeContacts.filter((c) => c.customerType === 'Active Customer').length,
    [activeContacts],
  );

  const filteredContacts = useMemo(() => {
    let result = activeContacts;

    // Tab filter
    if (activeTab === 'my') {
      result = result.filter((c) => c.assignedUserId === user?.id);
    } else if (activeTab === 'active-customers') {
      result = result.filter((c) => c.customerType === 'Active Customer');
    }

    // Search query
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          (c.contactPerson ?? c.leadPerson ?? '').toLowerCase().includes(term) ||
          (c.email ?? '').toLowerCase().includes(term) ||
          (c.companyName ?? '').toLowerCase().includes(term),
      );
    }

    // System Filters
    if (selectedSystemFilters.includes('touched')) {
      result = result.filter((c) => c.lastUpdated || c.updateStatus);
    }
    if (selectedSystemFilters.includes('untouched')) {
      result = result.filter((c) => !c.lastUpdated && !c.updateStatus);
    }

    // Customer Types
    if (selectedCustomerTypes.length > 0) {
      result = result.filter((c) => selectedCustomerTypes.includes(c.customerType ?? 'Prospect'));
    }

    // Owners
    if (selectedOwners.length > 0) {
      result = result.filter((c) => selectedOwners.includes(c.assignedUserId ?? ''));
    }

    // Related (e.g. Has Deals)
    if (selectedRelated.includes('has_deals')) {
      result = result.filter((c) => deals.some(d => !d.isArchived && (d.contactId === c.id || (d.contactIds ?? []).includes(c.id))));
    }

    return result;
  }, [activeContacts, activeTab, user?.id, debouncedSearch, selectedSystemFilters, selectedCustomerTypes, selectedOwners, selectedRelated, deals]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const getInitials = (contact: Contact): string => {
    const name = contact.contactPerson ?? contact.leadPerson ?? contact.firstName ?? '';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getName = (contact: Contact): string => {
    return contact.contactPerson ?? contact.leadPerson ?? (`${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || 'Unknown');
  };

  const getSubtitle = (contact: Contact): string => {
    return contact.jobTitle ?? '';
  };

  const getAccountName = (contact: Contact): string => {
    if (contact.organizationId) {
      const org = organizations.find((o) => o.id === contact.organizationId);
      return org?.name ?? contact.companyName ?? '—';
    }
    return contact.companyName ?? '—';
  };

  const getCustomerType = (contact: Contact): string => {
    return contact.customerType ?? 'Prospect';
  };

  const getCustomerTypeVariant = (type: string): 'success' | 'info' | 'purple' | 'neutral' => {
    if (type === 'Active Customer') return 'success';
    if (type === 'Prospect') return 'info';
    if (type === 'Evaluator') return 'purple';
    return 'neutral';
  };

  const getStatusVariant = (status: string): 'success' | 'info' | 'danger' | 'neutral' => {
    if (status === 'Active') return 'success';
    if (status === 'Inactive') return 'danger';
    return 'neutral';
  };

  const getContactDeals = (contactId: string): number => {
    return deals.filter((d) =>
      !d.isArchived && (d.contactId === contactId || (d.contactIds ?? []).includes(contactId)),
    ).length;
  };

  const getContactValue = (contactId: string): number => {
    return deals
      .filter((d) => !d.isArchived && (d.contactId === contactId || (d.contactIds ?? []).includes(contactId)))
      .reduce((sum, d) => sum + (d.value ?? 0), 0);
  };

  // Activity flag helper - shows date when there's a recent task/activity
  const getActivityDate = (contact: Contact): string | null => {
    const created = contact.createdAt ? new Date(contact.createdAt) : null;
    if (!created) return null;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 3600 * 24));
    if (diffDays <= 14) {
      return `${created.toLocaleDateString('en-US', { month: 'short' })} ${created.getDate()}`;
    }
    return null;
  };

  // ── Filter Groups ────────────────────────────────────────────────────
  const touchedCount = activeContacts.filter((c) => c.lastUpdated || c.updateStatus).length;
  const untouchedCount = activeContacts.length - touchedCount;

  const filterGroups = useMemo(() => [
    {
      id: 'system',
      label: 'System Defined Filters',
      isExpanded: true,
      items: [
        { id: 'touched', label: 'Touched Records', count: touchedCount, isChecked: selectedSystemFilters.includes('touched') },
        { id: 'untouched', label: 'Untouched Records', count: untouchedCount, isChecked: selectedSystemFilters.includes('untouched') },
      ],
    },
    {
      id: 'fields',
      label: 'Filter By Fields',
      isExpanded: true,
      items: [
        { id: 'type:Active Customer', label: 'Type: Active Customer', count: activeContacts.filter(c => c.customerType === 'Active Customer').length, isChecked: selectedCustomerTypes.includes('Active Customer') },
        { id: 'type:Prospect', label: 'Type: Prospect', count: activeContacts.filter(c => c.customerType === 'Prospect').length, isChecked: selectedCustomerTypes.includes('Prospect') },
        { id: 'type:Evaluator', label: 'Type: Evaluator', count: activeContacts.filter(c => c.customerType === 'Evaluator').length, isChecked: selectedCustomerTypes.includes('Evaluator') },
        ...users.slice(0, 5).map(u => ({
          id: `owner:${u.id}`,
          label: `Owner: ${u.firstName} ${u.lastName}`,
          count: activeContacts.filter(c => c.assignedUserId === u.id).length,
          isChecked: selectedOwners.includes(u.id),
        })),
      ],
    },
    {
      id: 'related',
      label: 'Filter By Related Modules',
      isExpanded: true,
      items: [
        { id: 'has_deals', label: 'Contacts with Deals', count: activeContacts.filter(c => deals.some(d => !d.isArchived && (d.contactId === c.id || (d.contactIds ?? []).includes(c.id)))).length, isChecked: selectedRelated.includes('has_deals') },
      ],
    },
  ], [activeContacts, touchedCount, untouchedCount, selectedSystemFilters, selectedCustomerTypes, selectedOwners, selectedRelated, users, deals]);

  const handleFilterToggle = useCallback((groupId: string, itemId: string) => {
    if (groupId === 'system') {
      setSelectedSystemFilters(prev =>
        prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]
      );
    } else if (groupId === 'fields') {
      if (itemId.startsWith('type:')) {
        const type = itemId.replace('type:', '');
        setSelectedCustomerTypes(prev =>
          prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type]
        );
      } else if (itemId.startsWith('owner:')) {
        const ownerId = itemId.replace('owner:', '');
        setSelectedOwners(prev =>
          prev.includes(ownerId) ? prev.filter(x => x !== ownerId) : [...prev, ownerId]
        );
      }
    } else if (groupId === 'related') {
      setSelectedRelated(prev =>
        prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]
      );
    }
  }, []);

  return (
    <>
    <ModuleWorkspace
      title="Contacts"
      primaryActionLabel="Create Contact"
      onPrimaryAction={() => toast.info('Contact creation coming soon')}
      onImport={() => toast.info('Import coming soon')}
      canCreate={canCreate}
      availableViews={['list', 'tile', 'table', 'grid']}
      activeView={activeView}
      onViewChange={setActiveView}
      savedTabs={[
        { id: 'all', label: 'All Contacts' },
        { id: 'my', label: 'My Contacts' },
        { id: 'active-customers', label: 'Active Customers' },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      filterGroups={filterGroups}
      onFilterToggle={handleFilterToggle}
      showFilters={showFilters}
      onToggleFilters={() => setShowFilters(!showFilters)}
      filterSearchTerm={filterSearchTerm}
      onFilterSearch={setFilterSearchTerm}
      totalRecords={filteredContacts.length}
      searchTerm={searchTerm}
      onSearch={setSearchTerm}
      searchPlaceholder="Search contacts..."
      onSort={() => toast.info('Sort coming soon')}
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
      {/* ── List / Table View — Dynamic Columns ─────────────────── */}
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
                aria-label="Select all contacts"
              />
            </label>
            {visibleColumns.map((col) => {
              const responsiveClass = getResponsiveColumnClass(col.id, visibleColumns, CONTACTS_COLUMN_REGISTRY);
              return (
                <span key={col.id} className={cn('px-3 truncate flex-1 min-w-0', responsiveClass)}>
                  {getColumnLabel(col.id, CONTACTS_COLUMN_REGISTRY)}
                </span>
              );
            })}
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#E4E9F0] dark:divide-slate-700">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center h-[52px] px-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
              >
                {/* Checkbox */}
                <label className="flex items-center justify-center w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
                    aria-label={`Select ${getName(contact)}`}
                  />
                </label>

                {visibleColumns.map((col) => {
                  const responsiveClass = getResponsiveColumnClass(col.id, visibleColumns, CONTACTS_COLUMN_REGISTRY);
                  return (
                    <div key={col.id} className={cn('px-3 min-w-0 flex-1', responsiveClass)}>
                      {renderContactCell(col.id, contact)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60">
            <span className="text-[12px] text-[#5A6B85]">
              Total records <strong className="font-semibold text-[#0F172A] dark:text-white">{filteredContacts.length}</strong>
            </span>
            <div className="flex items-center gap-2 text-[12px] text-[#5A6B85]">
              <span>1 to {Math.min(filteredContacts.length, 25)}</span>
              <button className="p-1 hover:text-[#0F172A] dark:hover:text-white transition-colors" aria-label="Previous page">&lt;</button>
              <button className="p-1 hover:text-[#0F172A] dark:hover:text-white transition-colors" aria-label="Next page">&gt;</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tile View ─────────────────────────────────────────── */}
      {activeView === 'tile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[#2563EB]/30 transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                  {getInitials(contact)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate">
                    {getName(contact)}
                  </p>
                  <p className="text-[11.5px] text-[#2563EB] dark:text-blue-400 truncate font-medium">
                    {getAccountName(contact)}
                  </p>
                  <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate mt-0.5">
                    {contact.email ?? ''}
                  </p>
                </div>
                <StatusBadge label={getCustomerType(contact)} variant={getCustomerTypeVariant(getCustomerType(contact))} dot={false} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#E4E9F0] dark:border-slate-700">
                <span className="text-[12px] text-[#5A6B85]">
                  {getContactDeals(contact.id)} open · {formatCurrency(getContactValue(contact.id))}
                </span>
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-300">
                  {getInitials(contact).slice(0, 1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Grid View ─────────────────────────────────────────── */}
      {activeView === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3 cursor-pointer hover:shadow-md transition-all flex items-center gap-2.5"
            >
              <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                {getInitials(contact)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white truncate">
                  {getName(contact)}
                </p>
                <p className="text-[10.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                  {getAccountName(contact)}
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-[#2563EB] bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-md">
                {getContactDeals(contact.id)} deals
              </span>
            </div>
          ))}
        </div>
      )}
    </ModuleWorkspace>

    {/* ── Manage Columns Drawer ───────────────────────────────── */}
    <ManageColumnsDrawer
      isOpen={isManageColumnsOpen}
      onClose={() => setIsManageColumnsOpen(false)}
      module="contacts"
      registry={CONTACTS_COLUMN_REGISTRY}
      effectiveColumns={effectiveColumns}
      onSave={saveColumns}
      onReset={resetColumns}
      triggerRef={manageColumnsButtonRef}
    />
    </>
  );

  // ── Dynamic cell renderer ──────────────────────────────────────────────
  function renderContactCell(colId: string, contact: Contact): React.ReactNode {
    switch (colId) {
      case 'firstName':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
              {getInitials(contact)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate group-hover:text-[#2563EB] transition-colors">
                {contact.firstName ?? getName(contact).split(' ')[0] ?? '—'}
              </p>
            </div>
          </div>
        );
      case 'lastName':
        return (
          <p className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">
            {contact.lastName ?? getName(contact).split(' ').slice(1).join(' ') ?? '—'}
          </p>
        );
      case 'email':
        return (
          <p className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">
            {contact.email ?? '—'}
          </p>
        );
      case 'phone':
        return (
          <p className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">
            {contact.phone ?? '—'}
          </p>
        );
      case 'companyName':
        return (
          <p className="text-[12.5px] text-[#2563EB] dark:text-blue-400 font-medium truncate">
            {getAccountName(contact)}
          </p>
        );
      case 'status':
        return (
          <StatusBadge
            label={contact.status ?? 'Active'}
            variant={getStatusVariant(contact.status ?? 'Active')}
          />
        );
      case 'source':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {(contact as unknown as Record<string, unknown>).source as string ?? '—'}
          </p>
        );
      case 'assignedUserId':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {contact.assignedUserId
              ? (users.find((u) => u.id === contact.assignedUserId)
                  ? `${users.find((u) => u.id === contact.assignedUserId)!.firstName} ${users.find((u) => u.id === contact.assignedUserId)!.lastName}`
                  : '—')
              : '—'}
          </p>
        );
      case 'accountId':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {getAccountName(contact)}
          </p>
        );
      case 'createdAt':
        return (
          <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
            {contact.createdAt
              ? new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '—'}
          </p>
        );
      default:
        return <span className="text-[12px] text-[#5A6B85]">—</span>;
    }
  }
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `$${value.toLocaleString()}`;
}
