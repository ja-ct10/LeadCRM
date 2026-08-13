'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { Contact } from '@/store/types';
import { ModuleWorkspace, ViewType, StatusBadge } from '@/shared/components/crm';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Customers Page ────────────────────────────────────────────────────────────
// Shows contacts with customerType = 'Active Customer' (set by won-deal handoff)

export default function CustomersPage(): React.ReactElement {
  const { contacts, organizations, deals, users } = useData();
  const { user } = useAuth();
  const canCreate = useHasPermission('contacts.create');

  // ── State ────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewType>('list');
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSearchTerm, setFilterSearchTerm] = useState('');

  // ── Data ─────────────────────────────────────────────────────────────
  const customers = useMemo(
    () => contacts.filter((c) => c.customerType === 'Active Customer' && !c.isArchived),
    [contacts],
  );

  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (activeTab === 'my') {
      result = result.filter((c) => c.assignedUserId === user?.id);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          (c.contactPerson ?? c.leadPerson ?? '').toLowerCase().includes(term) ||
          (c.email ?? '').toLowerCase().includes(term) ||
          (c.companyName ?? '').toLowerCase().includes(term),
      );
    }
    return result;
  }, [customers, activeTab, user?.id, searchTerm]);

  // ── KPI ──────────────────────────────────────────────────────────────
  const kpiCards = useMemo(() => {
    const totalDeals = deals.filter((d) =>
      !d.isArchived && customers.some((c) => c.id === d.contactId || (d.contactIds ?? []).includes(c.id)),
    );
    const totalRevenue = totalDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);

    return [
      { label: 'TOTAL CUSTOMERS', value: String(customers.length), subtitle: 'Active customer records' },
      { label: 'ACTIVE CUSTOMERS', value: String(customers.length), subtitle: 'Currently engaged' },
      { label: 'TOTAL REVENUE', value: formatCurrency(totalRevenue), subtitle: 'Closed value to date' },
      { label: 'TOTAL DEALS', value: String(totalDeals.length), subtitle: 'Open across customers' },
    ];
  }, [customers, deals]);

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

  const getOrgName = (contact: Contact): string => {
    if (contact.organizationId) {
      const org = organizations.find((o) => o.id === contact.organizationId);
      return org?.name ?? contact.companyName ?? '—';
    }
    return contact.companyName ?? '—';
  };

  const getOwnerName = (userId?: string): string => {
    if (!userId) return '—';
    const u = users.find((usr) => usr.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : '—';
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

  // ── Filter Groups ────────────────────────────────────────────────────
  const filterGroups = useMemo(() => [
    {
      id: 'system',
      label: 'System Defined Filters',
      isExpanded: true,
      items: [
        { id: 'my-customers', label: 'My Customers', count: customers.filter((c) => c.assignedUserId === user?.id).length, isChecked: false },
        { id: 'renewal', label: 'Renewal This Quarter', count: 0, isChecked: false },
      ],
    },
    {
      id: 'fields',
      label: 'Filter By Fields',
      isExpanded: true,
      items: [
        { id: 'account-name', label: 'Account Name', isChecked: false },
        { id: 'customer-owner', label: 'Customer Owner', isChecked: false },
        { id: 'status', label: 'Status', isChecked: false },
        { id: 'customer-since', label: 'Customer Since', isChecked: false },
        { id: 'active-products', label: 'Active Products', isChecked: false },
        { id: 'last-activity', label: 'Last Activity Time', isChecked: false },
      ],
    },
    {
      id: 'related',
      label: 'Filter By Related Modules',
      isExpanded: false,
      items: [],
    },
  ], [customers, user?.id]);

  return (
    <ModuleWorkspace
      title="Customers"
      description="Contacts with customerType = Active Customer, grouped under their account."
      primaryActionLabel="Add Customer"
      onPrimaryAction={() => toast.info('Customer creation coming soon')}
      canCreate={canCreate}
      availableViews={['list', 'tile', 'table', 'grid']}
      activeView={activeView}
      onViewChange={setActiveView}
      savedTabs={[
        { id: 'all', label: 'All Customers' },
        { id: 'my', label: 'My Customers' },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      filterGroups={filterGroups}
      showFilters={showFilters}
      onToggleFilters={() => setShowFilters(!showFilters)}
      filterSearchTerm={filterSearchTerm}
      onFilterSearch={setFilterSearchTerm}
      totalRecords={filteredCustomers.length}
      searchTerm={searchTerm}
      onSearch={setSearchTerm}
      searchPlaceholder="Search customers..."
      onSort={() => toast.info('Sort coming soon')}
      onRefresh={() => toast.success('Refreshed')}
      kpiCards={kpiCards}
    >
      {/* List / Table View */}
      {(activeView === 'list' || activeView === 'table') && (
        <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_1.3fr_1fr_1fr_80px_80px_100px_100px] items-center h-11 px-3 border-b border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60 text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400">
            <span />
            <span className="px-3">CUSTOMER</span>
            <span className="px-3">ACCOUNT</span>
            <span className="px-3">CUSTOMER TYPE</span>
            <span className="px-3">STATUS</span>
            <span className="px-3 text-center">DEALS</span>
            <span className="px-3 text-right">TOTAL VALUE</span>
            <span className="px-3 text-right">OWNER</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#E4E9F0] dark:divide-slate-700">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="grid grid-cols-[40px_1.3fr_1fr_1fr_80px_80px_100px_100px] items-center h-[52px] px-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
              >
                <label className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
                    aria-label={`Select ${getName(customer)}`}
                  />
                </label>

                {/* Name */}
                <div className="flex items-center gap-2.5 px-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                    {getInitials(customer)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate group-hover:text-[#2563EB] transition-colors">
                      {getName(customer)}
                    </p>
                    <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate">
                      {customer.jobTitle ?? ''}
                    </p>
                  </div>
                </div>

                {/* Account */}
                <div className="px-3">
                  <p className="text-[12.5px] text-[#2563EB] dark:text-blue-400 font-medium truncate">
                    {getOrgName(customer)}
                  </p>
                </div>

                {/* Customer Type */}
                <div className="px-3">
                  <StatusBadge label="Active Customer" variant="success" dot={false} />
                </div>

                {/* Status */}
                <div className="px-3">
                  <StatusBadge label={customer.status ?? 'Active'} variant="success" />
                </div>

                {/* Deals */}
                <div className="px-3 text-center">
                  <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                    {getContactDeals(customer.id)}
                  </span>
                </div>

                {/* Total Value */}
                <div className="px-3 text-right">
                  <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                    {formatCurrency(getContactValue(customer.id))}
                  </span>
                </div>

                {/* Owner */}
                <div className="px-3 text-right">
                  <span className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                    {getOwnerName(customer.assignedUserId)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60">
            <span className="text-[12px] text-[#5A6B85]">
              Total records <strong className="font-semibold text-[#0F172A] dark:text-white">{filteredCustomers.length}</strong>
            </span>
            <div className="flex items-center gap-2 text-[12px] text-[#5A6B85]">
              <span>1 to {Math.min(filteredCustomers.length, 25)}</span>
              <button className="p-1 hover:text-[#0F172A] dark:hover:text-white transition-colors" aria-label="Previous page">&lt;</button>
              <button className="p-1 hover:text-[#0F172A] dark:hover:text-white transition-colors" aria-label="Next page">&gt;</button>
            </div>
          </div>
        </div>
      )}

      {/* Tile View */}
      {activeView === 'tile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[#2563EB]/30 transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                  {getInitials(customer)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate">
                    {getName(customer)}
                  </p>
                  <p className="text-[11.5px] text-[#2563EB] dark:text-blue-400 truncate font-medium">
                    {getOrgName(customer)}
                  </p>
                </div>
                <StatusBadge label="Active Customer" variant="success" dot={false} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#E4E9F0] dark:border-slate-700">
                <span className="text-[12px] text-[#5A6B85]">
                  {getContactDeals(customer.id)} deals
                </span>
                <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                  {formatCurrency(getContactValue(customer.id))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid View */}
      {activeView === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3 cursor-pointer hover:shadow-md transition-all flex items-center gap-2.5"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                {getInitials(customer)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white truncate">
                  {getName(customer)}
                </p>
                <p className="text-[10.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                  {getOrgName(customer)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModuleWorkspace>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(value >= 10000000 ? 1 : 2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `$${value.toLocaleString()}`;
}
