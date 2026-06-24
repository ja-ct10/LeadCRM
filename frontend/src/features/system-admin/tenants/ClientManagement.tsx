'use client';
import React, { useState } from 'react';
import {
  Search, Eye, UserX, UserCheck, CheckCircle, ChevronDown,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { useData } from '@/store/DataContext';
import { Tenant } from '@/store/types';
import { useTenants } from './hooks/use-tenants';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Client Management</h1>
        <p className="text-sm text-slate-500 mt-1">Manage and monitor all client accounts</p>
      </div>

      {/* Filters bar */}
      <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col md:flex-row gap-4">
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
      <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold">Company Name</th>
                <th className="px-6 py-4 font-semibold">Industry</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Plan</th>
                <th className="px-6 py-4 font-semibold">Created Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTenants.length > 0 ? filteredTenants.map((t) => {
                const tStatus = t.status === 'suspended' ? 'inactive' : t.status;
                const tPlan = (t as any).plan || 'Basic';
                return (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{t.name}</td>
                    <td className="px-6 py-4 text-slate-500">{t.industry || 'Technology'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                        tStatus === 'active'  ? 'bg-emerald-500 text-white' :
                        tStatus === 'pending' ? 'bg-amber-500 text-white'   : 'bg-slate-500 text-white'
                      }`}>{tStatus}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{tPlan}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(t.createdAt).toISOString().split('T')[0]}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => setSelectedTenant(t)} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <Eye size={16} /> View
                        </button>
                        {tStatus === 'active' && (
                          <button onClick={() => suspendTenant(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/50 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <UserX size={16} /> Deactivate
                          </button>
                        )}
                        {tStatus === 'pending' && (
                          <button onClick={() => setSelectedTenant(t)} className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-500/50 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                            <CheckCircle size={16} /> Review
                          </button>
                        )}
                        {tStatus !== 'active' && tStatus !== 'pending' && (
                          <button onClick={() => approveTenant(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/50 rounded-lg text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                            <UserCheck size={16} /> Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No clients found matching your criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500">
          <span>Showing {filteredTenants.length} of {tenants.length} clients</span>
          <div className="flex items-center gap-2">
            <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled><ChevronLeft size={16} /></button>
            <span>Page 1 of 1</span>
            <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled><ChevronRight size={16} /></button>
          </div>
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
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#0B1120] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Client Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X size={20} /></button>
        </div>
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
          <button onClick={onClose} className="px-4 py-2 bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors">Close</button>
          {tenant.status === 'pending' && (
            <button onClick={onApprove} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors">Approve Client</button>
          )}
        </div>
      </motion.div>
    </div>
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
