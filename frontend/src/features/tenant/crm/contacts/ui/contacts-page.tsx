'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { Contact } from '@/store/types';
import { ModuleWorkspace, ViewType, StatusBadge } from '@/shared/components/crm';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Contacts Page ─────────────────────────────────────────────────────────────
// Shows all contacts with activity flags, customer type, account links, deals

export default function ContactsPage(): React.ReactElement {
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
    if (activeTab === 'my') {
      result = result.filter((c) => c.assignedUserId === user?.id);
    } else if (activeTab === 'active-customers') {
      result = result.filter((c) => c.customerType === 'Active Customer');
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
  }, [activeContacts, activeTab, user?.id, searchTerm]);

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
        { id: 'active-customers', label: 'Active Customers', count: activeCustomersCount, isChecked: activeTab === 'active-customers' },
        { id: 'touched', label: 'Touched Records', count: touchedCount, isChecked: false },
        { id: 'untouched', label: 'Untouched Records', count: untouchedCount, isChecked: false },
        { id: 'record-action', label: 'Record Action', isChecked: false },
      ],
    },
    {
      id: 'fields',
      label: 'Filter By Fields',
      isExpanded: true,
      items: [
        { id: 'account-name', label: 'Account Name', isChecked: false },
        { id: 'contact-owner', label: 'Contact Owner', isChecked: false },
        { id: 'customer-type', label: 'Customer Type', isChecked: false },
        { id: 'department', label: 'Department', isChecked: false },
        { id: 'email', label: 'Email', isChecked: false },
        { id: 'job-title', label: 'Job Title', isChecked: false },
        { id: 'lead-source', label: 'Lead Source', isChecked: false },
        { id: 'last-activity', label: 'Last Activity Time', isChecked: false },
        { id: 'lifecycle-stage', label: 'Lifecycle Stage', isChecked: false },
      ],
    },
    {
      id: 'related',
      label: 'Filter By Related Modules',
      isExpanded: false,
      items: [],
    },
  ], [activeCustomersCount, activeTab, touchedCount, untouchedCount]);

  return (
    <ModuleWorkspace
      title="Contacts"
      description={
        activeTab === 'active-customers'
          ? 'Contacts with customerType = Active Customer, grouped under their account.'
          : 'Every person you sell to, nested under their account and deals.'
      }
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
    >
      {/* ── List / Table View ─────────────────────────────────── */}
      {(activeView === 'list' || activeView === 'table') && (
        <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_1.3fr_1fr_1fr_80px_80px_100px] items-center h-11 px-3 border-b border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60 text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400">
            <span />
            <span className="px-3">CONTACT NAME</span>
            <span className="px-3">ACCOUNT NAME</span>
            <span className="px-3">CUSTOMER TYPE</span>
            <span className="px-3">STATUS</span>
            <span className="px-3 text-center">OPEN DEALS</span>
            <span className="px-3 text-right">TOTAL VALUE</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#E4E9F0] dark:divide-slate-700">
            {filteredContacts.map((contact) => {
              const activityDate = getActivityDate(contact);

              return (
                <div
                  key={contact.id}
                  className="grid grid-cols-[40px_1.3fr_1fr_1fr_80px_80px_100px] items-center h-[52px] px-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  {/* Checkbox */}
                  <label className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
                      aria-label={`Select ${getName(contact)}`}
                    />
                  </label>

                  {/* Contact Name + Avatar + Activity flag */}
                  <div className="flex items-center gap-2 px-3 min-w-0">
                    {/* Activity flag (date chip) */}
                    {activityDate && (
                      <div className="shrink-0 flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 text-[9px] font-bold leading-tight">
                        <span className="uppercase">{activityDate.split(' ')[0]}</span>
                        <span className="text-[11px]">{activityDate.split(' ')[1]}</span>
                      </div>
                    )}

                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                      {getInitials(contact)}
                    </div>

                    {/* Name + subtitle */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate group-hover:text-[#2563EB] transition-colors">
                        {getName(contact)}
                      </p>
                      {getSubtitle(contact) && (
                        <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate">
                          {getSubtitle(contact)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Account Name (brand blue link) */}
                  <div className="px-3 min-w-0">
                    <p className="text-[12.5px] text-[#2563EB] dark:text-blue-400 font-medium truncate">
                      {getAccountName(contact)}
                    </p>
                  </div>

                  {/* Customer Type */}
                  <div className="px-3">
                    <StatusBadge
                      label={getCustomerType(contact)}
                      variant={getCustomerTypeVariant(getCustomerType(contact))}
                      dot={false}
                    />
                  </div>

                  {/* Status */}
                  <div className="px-3">
                    <StatusBadge
                      label={contact.status ?? 'Active'}
                      variant={getStatusVariant(contact.status ?? 'Active')}
                    />
                  </div>

                  {/* Open Deals */}
                  <div className="px-3 text-center">
                    <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                      {getContactDeals(contact.id)}
                    </span>
                  </div>

                  {/* Total Value */}
                  <div className="px-3 text-right">
                    <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                      {formatCurrency(getContactValue(contact.id))}
                    </span>
                  </div>
                </div>
              );
            })}
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
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `$${value.toLocaleString()}`;
}
