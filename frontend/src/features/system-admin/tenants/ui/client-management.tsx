'use client';
import React, { useState } from 'react';
import {
  Search, Eye, UserX, UserCheck, CheckCircle, ChevronDown,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';
import { useData } from '@/store/DataContext';
import { Tenant } from '@/store/types';
import { useTenants } from '../hooks/use-tenants';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { SideSheet } from '@/shared/components/side-sheet';

/**
 * System Admin — Client Management page.
 * Lists all tenant accounts with approve / suspend / activate actions.
 */
export default function ClientManagement() {
  const { tenants, approveTenant, rejectTenant, suspendTenant } = useData();
  const {
    filteredTenants,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    planFilter, setPlanFilter,
  } = useTenants({ tenants });

  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginateItems,
    goToPage,
    setPageSize,
  } = usePagination({
    totalItems: filteredTenants.length,
    initialPageSize: 25,
    resetDeps: [searchQuery, statusFilter, planFilter],
  });

  const paginatedTenants = paginateItems(filteredTenants);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Client Management</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage and monitor all client accounts</p>
      </div>

      {/* Filters bar */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
          />
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="appearance-none bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 cursor-pointer min-w-[160px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as any)}
              className="appearance-none bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 cursor-pointer min-w-[160px]"
            >
              <option value="all">All Plans</option>
              <option value="Enterprise">Enterprise</option>
              <option value="Pro">Pro</option>
              <option value="Basic">Basic</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/[0.05] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-hidden">
          <table className="w-full text-left text-sm border-collapse table-fixed">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.01] text-[9px] sm:text-[10px] uppercase text-slate-500 tracking-wider">
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[28%]">Company Name</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[18%] hidden sm:table-cell">Industry</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[12%]">Status</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[10%]">Plan</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[14%] hidden md:table-cell">Created</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold text-right w-[18%] sm:w-[18%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04] text-[10px] sm:text-[11px] text-slate-700 dark:text-slate-300">
              {paginatedTenants.length > 0 ? paginatedTenants.map((t) => {
                const tStatus = t.status === 'suspended' ? 'inactive' : t.status;
                const tPlan = (t as any).plan || 'Basic';
                return (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="p-2 sm:p-4">
                      <span className="font-semibold text-slate-900 dark:text-white block truncate" title={t.name}>{t.name}</span>
                      <span className="text-[9px] text-slate-400 sm:hidden block truncate">{t.industry || 'Technology'}</span>
                    </td>
                    <td className="p-2 sm:p-4 text-slate-500 hidden sm:table-cell truncate">{t.industry || 'Technology'}</td>
                    <td className="p-2 sm:p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase border ${
                        tStatus === 'active'  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                        tStatus === 'pending' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'       :
                                                'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'
                      }`}>{tStatus}</span>
                    </td>
                    <td className="p-2 sm:p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {tPlan}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono md:hidden block mt-1">
                        {new Date(t.createdAt).toISOString().split('T')[0]}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 text-slate-500 hidden md:table-cell font-mono text-[10px]">
                      {new Date(t.createdAt).toISOString().split('T')[0]}
                    </td>
                    <td className="p-2 sm:p-4">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => setSelectedTenant(t)}
                          aria-label={`View ${t.name}`}
                          className="flex items-center gap-1 px-2 py-1 border border-slate-200 dark:border-white/[0.08] rounded-md text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <Eye size={12} /> View
                        </button>
                        {tStatus === 'active' && (
                          <button
                            onClick={() => suspendTenant(t.id)}
                            aria-label={`Deactivate ${t.name}`}
                            className="flex items-center gap-1 px-2 py-1 border border-red-500/30 rounded-md text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <UserX size={12} /> Deactivate
                          </button>
                        )}
                        {tStatus === 'pending' && (
                          <button
                            onClick={() => setSelectedTenant(t)}
                            aria-label={`Review ${t.name}`}
                            className="flex items-center gap-1 px-2 py-1 border border-blue-500/30 rounded-md text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <CheckCircle size={12} /> Review
                          </button>
                        )}
                        {tStatus !== 'active' && tStatus !== 'pending' && (
                          <button
                            onClick={() => approveTenant(t.id)}
                            aria-label={`Activate ${t.name}`}
                            className="flex items-center gap-1 px-2 py-1 border border-emerald-500/30 rounded-md text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                          >
                            <UserCheck size={12} /> Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">No clients found matching your criteria.</td>
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

      {/* Tenant detail modal */}
      <AnimatePresence>
        {selectedTenant && <TenantDetailModal tenant={selectedTenant} onClose={() => setSelectedTenant(null)} onApprove={() => { approveTenant(selectedTenant.id); setSelectedTenant(null); toast.success('Tenant approved'); }} />}
      </AnimatePresence>
    </div>
  );
}

function TenantDetailModal({ tenant, onClose, onApprove }: { tenant: Tenant; onClose: () => void; onApprove: () => void }) {
  return (
    <SideSheet isOpen={true} onClose={onClose} title="Client Details">
      <div className="p-6 grid grid-cols-2 gap-6">
        <InfoBlock title="Company Information" fields={[['Name', tenant.name], ['Industry', tenant.industry], ['Size', tenant.size]]} />
        <InfoBlock title="Contact Details" fields={[['Email', tenant.email], ['Phone', tenant.phone], ['Address', tenant.address]]} />
        <div className="col-span-2 grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          {[['Status', tenant.status], ['Environment', tenant.environment], ['Created', new Date(tenant.createdAt).toLocaleDateString()]].map(([k, v]) => (
            <div key={k} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="text-xs text-slate-500 mb-1">{k}</div>
              <div className="font-medium capitalize text-slate-900 dark:text-white">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors">Close</button>
        {tenant.status === 'pending' && (
          <button onClick={onApprove} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors">Approve Client</button>
        )}
      </div>
    </SideSheet>
  );
}

function InfoBlock({ title, fields }: { title: string; fields: [string, string][] }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{title}</h4>
      <div className="space-y-3">
        {fields.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-slate-500">{k}</div>
            <div className="font-medium text-slate-900 dark:text-white">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
