'use client';

import React, { useState } from 'react';
import { Search, Eye, UserX, UserCheck, CheckCircle, ChevronDown, Check } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
} from '@/shared/components/ui/dropdown-menu';
import { SideSheet } from '@/shared/components/side-sheet';
import { useData } from '@/store/DataContext';
import { Tenant } from '@/store/types';
import { cn } from '@/lib/utils';
import { useTenants } from '../hooks/use-tenants';

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'pending' | 'active' | 'inactive' | 'rejected';
type PlanFilter = 'all' | 'Basic' | 'Pro' | 'Enterprise';

interface FilterOption<T extends string> {
  id: T;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHELL =
  'rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl';

const STATUS_OPTIONS: FilterOption<StatusFilter>[] = [
  { id: 'all',      label: 'All Status' },
  { id: 'active',   label: 'Active' },
  { id: 'pending',  label: 'Pending' },
  { id: 'inactive', label: 'Inactive' },
];

const PLAN_OPTIONS: FilterOption<PlanFilter>[] = [
  { id: 'all',        label: 'All Plans' },
  { id: 'Enterprise', label: 'Enterprise' },
  { id: 'Pro',        label: 'Pro' },
  { id: 'Basic',      label: 'Basic' },
];

const STATUS_BADGE: Record<string, string> = {
  active:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

const STATUS_BADGE_FALLBACK = 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * System Admin — Client Management page.
 * Lists all tenant accounts with approve / suspend / activate actions.
 */
export default function ClientManagement(): React.ReactElement {
  const { tenants, approveTenant, suspendTenant } = useData();
  const {
    filteredTenants,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    planFilter, setPlanFilter,
  } = useTenants({ tenants });

  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const {
    currentPage, pageSize, totalPages, totalItems,
    paginateItems, goToPage, setPageSize,
  } = usePagination({
    totalItems: filteredTenants.length,
    initialPageSize: 25,
    resetDeps: [searchQuery, statusFilter, planFilter],
  });

  const paginatedTenants = paginateItems(filteredTenants);

  const activeStatusLabel = STATUS_OPTIONS.find((option) => option.id === statusFilter)?.label ?? 'All Status';
  const activePlanLabel = PLAN_OPTIONS.find((option) => option.id === planFilter)?.label ?? 'All Plans';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Client Management
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage and monitor all client accounts
        </p>
      </div>

      {/* Filters */}
      <div className={cn(CARD_SHELL, 'p-4 flex flex-col md:flex-row gap-3')}>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          <label htmlFor="client-search" className="sr-only">Search clients</label>
          <input
            id="client-search"
            type="search"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] pl-9 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex gap-3">
          <FilterDropdown<StatusFilter>
            label="Status"
            activeLabel={activeStatusLabel}
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onSelect={(value) => setStatusFilter(value)}
          />
          <FilterDropdown<PlanFilter>
            label="Plan"
            activeLabel={activePlanLabel}
            options={PLAN_OPTIONS}
            selected={planFilter}
            onSelect={(value) => setPlanFilter(value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className={cn(CARD_SHELL, 'overflow-hidden flex flex-col')}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse table-fixed">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.01] text-[9px] sm:text-[10px] uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                <th scope="col" className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[28%]">Company Name</th>
                <th scope="col" className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[18%] hidden sm:table-cell">Industry</th>
                <th scope="col" className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[12%]">Status</th>
                <th scope="col" className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[10%]">Plan</th>
                <th scope="col" className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[14%] hidden md:table-cell">Created</th>
                <th scope="col" className="p-2 sm:p-4 py-2 sm:py-3 font-semibold text-right w-[18%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04] text-[10px] sm:text-[11px] text-slate-700 dark:text-slate-300">
              {paginatedTenants.length > 0 ? paginatedTenants.map((tenant) => {
                const normalizedStatus = tenant.status === 'suspended' ? 'inactive' : tenant.status;
                const planLabel = (tenant as { plan?: string }).plan ?? 'Basic';
                const createdOn = new Date(tenant.createdAt).toISOString().split('T')[0];

                return (
                  <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-2 sm:p-4">
                      <span className="font-semibold text-slate-900 dark:text-white block truncate" title={tenant.name}>
                        {tenant.name}
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 sm:hidden block truncate">
                        {tenant.industry || 'Technology'}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 text-slate-500 dark:text-slate-400 hidden sm:table-cell truncate">
                      {tenant.industry || 'Technology'}
                    </td>
                    <td className="p-2 sm:p-4">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase border',
                          STATUS_BADGE[normalizedStatus] ?? STATUS_BADGE_FALLBACK,
                        )}
                      >
                        {normalizedStatus}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {planLabel}
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono md:hidden block mt-1">
                        {createdOn}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 text-slate-500 dark:text-slate-400 hidden md:table-cell font-mono text-[10px]">
                      {createdOn}
                    </td>
                    <td className="p-2 sm:p-4">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <RowAction
                          onClick={() => setSelectedTenant(tenant)}
                          label={`View ${tenant.name}`}
                          tone="neutral"
                          icon={<Eye size={12} />}
                        >
                          View
                        </RowAction>

                        {normalizedStatus === 'active' && (
                          <RowAction
                            onClick={() => suspendTenant(tenant.id)}
                            label={`Deactivate ${tenant.name}`}
                            tone="danger"
                            icon={<UserX size={12} />}
                          >
                            Deactivate
                          </RowAction>
                        )}

                        {normalizedStatus === 'pending' && (
                          <RowAction
                            onClick={() => setSelectedTenant(tenant)}
                            label={`Review ${tenant.name}`}
                            tone="primary"
                            icon={<CheckCircle size={12} />}
                          >
                            Review
                          </RowAction>
                        )}

                        {normalizedStatus !== 'active' && normalizedStatus !== 'pending' && (
                          <RowAction
                            onClick={() => approveTenant(tenant.id)}
                            label={`Activate ${tenant.name}`}
                            tone="success"
                            icon={<UserCheck size={12} />}
                          >
                            Activate
                          </RowAction>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No clients found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-white/[0.05]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
            isLoading={false}
          />
        </div>
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {selectedTenant && (
          <TenantDetailSheet
            tenant={selectedTenant}
            onClose={() => setSelectedTenant(null)}
            onApprove={() => {
              approveTenant(selectedTenant.id);
              setSelectedTenant(null);
              toast.success('Tenant approved');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Local components ──────────────────────────────────────────────────────────

interface FilterDropdownProps<T extends string> {
  label: string;
  activeLabel: string;
  options: FilterOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

function FilterDropdown<T extends string>({
  label, activeLabel, options, selected, onSelect,
}: FilterDropdownProps<T>): React.ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-9 min-w-[150px] px-3 inline-flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
          aria-label={`Filter by ${label}`}
        >
          <span className="truncate">{activeLabel}</span>
          <ChevronDown size={14} className="shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[170px]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem key={option.id} onClick={() => onSelect(option.id)}>
            <span className="flex items-center justify-between w-full gap-2">
              <span>{option.label}</span>
              {selected === option.id && <Check size={14} className="text-blue-500 shrink-0" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ActionTone = 'neutral' | 'primary' | 'success' | 'danger';

const ACTION_TONES: Record<ActionTone, string> = {
  neutral: 'border-gray-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]',
  primary: 'border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10',
  success: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10',
  danger:  'border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10',
};

interface RowActionProps {
  onClick: () => void;
  label: string;
  tone: ActionTone;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function RowAction({ onClick, label, tone, icon, children }: RowActionProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex items-center gap-1 px-2 py-1 border rounded-md text-[10px] font-medium transition-colors active:scale-95',
        ACTION_TONES[tone],
      )}
    >
      {icon} {children}
    </button>
  );
}

interface TenantDetailSheetProps {
  tenant: Tenant;
  onClose: () => void;
  onApprove: () => void;
}

function TenantDetailSheet({ tenant, onClose, onApprove }: TenantDetailSheetProps): React.ReactElement {
  const planLabel = (tenant as { plan?: string }).plan ?? 'Basic';

  const summary: [string, string][] = [
    ['Status', tenant.status],
    ['Plan', planLabel],
    ['Created', new Date(tenant.createdAt).toLocaleDateString()],
  ];

  return (
    <SideSheet isOpen onClose={onClose} title="Client Details">
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <InfoBlock
          title="Company Information"
          fields={[
            ['Name', tenant.name],
            ['Industry', tenant.industry || '—'],
            ['Size', tenant.size || '—'],
          ]}
        />
        <InfoBlock
          title="Contact Details"
          fields={[
            ['Email', tenant.email || '—'],
            ['Phone', tenant.phone || '—'],
            ['Address', tenant.address || '—'],
          ]}
        />

        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-white/[0.05]">
          {summary.map(([key, value]) => (
            <div
              key={key}
              className="rounded-xl border border-gray-200 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.02] p-3"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{key}</p>
              <p className="font-medium capitalize text-slate-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.02] flex justify-end gap-3">
        <button
          onClick={onClose}
          className="h-9 px-4 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors active:scale-95"
        >
          Close
        </button>
        {tenant.status === 'pending' && (
          <button
            onClick={onApprove}
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all active:scale-95"
          >
            Approve Client
          </button>
        )}
      </div>
    </SideSheet>
  );
}

interface InfoBlockProps {
  title: string;
  fields: [string, string][];
}

function InfoBlock({ title, fields }: InfoBlockProps): React.ReactElement {
  return (
    <div>
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
        {title}
      </h3>
      <div className="space-y-3">
        {fields.map(([key, value]) => (
          <div key={key}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{key}</p>
            <p className="font-medium text-slate-900 dark:text-white break-words">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
