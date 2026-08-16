'use client';
import React, { useState } from 'react';
import { Search, Eye, Download, CreditCard, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';
import { AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { SideSheet } from '@/shared/components/side-sheet';

const MOCK_INVOICES = [
  { id: 'INV-2026-001', client: 'Acme Corporation',    plan: 'Enterprise', amount: 199, date: '2026-03-15', method: 'Credit Card',   status: 'paid' },
  { id: 'INV-2026-002', client: 'TechStart Inc',        plan: 'Pro',        amount: 79,  date: '2026-03-20', method: 'PayPal',         status: 'paid' },
  { id: 'INV-2026-003', client: 'Global Finance Ltd',   plan: 'Enterprise', amount: 199, date: '2026-03-22', method: 'Bank Transfer',  status: 'pending' },
  { id: 'INV-2026-004', client: 'HealthCare Plus',      plan: 'Pro',        amount: 79,  date: '2026-03-25', method: 'Debit Card',     status: 'paid' },
  { id: 'INV-2026-005', client: 'EduTech Solutions',    plan: 'Basic',      amount: 29,  date: '2026-03-28', method: 'Credit Card',    status: 'failed' },
  { id: 'INV-2026-006', client: 'Retail Masters',       plan: 'Pro',        amount: 79,  date: '2026-04-01', method: 'Credit Card',    status: 'paid' },
  { id: 'INV-2026-007', client: 'Marketing Solutions',  plan: 'Basic',      amount: 29,  date: '2026-04-03', method: 'Debit Card',     status: 'paid' },
  { id: 'INV-2026-008', client: 'Consulting Group',     plan: 'Enterprise', amount: 199, date: '2026-04-05', method: 'Bank Transfer',  status: 'pending' },
];

const STATUS_STYLES: Record<string, string> = {
  paid:    'bg-emerald-500 text-white',
  pending: 'bg-amber-500 text-white',
  failed:  'bg-red-500 text-white',
};

/**
 * System Admin — Billing page.
 * Shows invoice history across all tenants.
 */
export default function AdminBillingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<(typeof MOCK_INVOICES)[0] | null>(null);

  const filteredInvoices = MOCK_INVOICES.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return inv.client.toLowerCase().includes(q) || inv.plan.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
  });

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginateItems,
    goToPage,
    setPageSize,
  } = usePagination({
    totalItems: filteredInvoices.length,
    initialPageSize: 25,
    resetDeps: [searchQuery],
  });

  const paginatedInvoices = paginateItems(filteredInvoices);

  const handleDownload = (id: string) => toast.success(`Downloading invoice ${id}…`);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Billing</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage invoices and payment history</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Revenue (This Month)', value: '$465', sub: '5 paid invoices',     subColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Pending Revenue',            value: '$398', sub: '2 pending invoices',   subColor: 'text-amber-600 dark:text-amber-400' },
          { label: 'Failed Payments',            value: '1',    sub: 'Requires attention',   subColor: 'text-red-600 dark:text-red-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-sm text-slate-500 dark:text-slate-400 mb-4">{s.label}</h3>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mb-4">{s.value}</div>
            <div className={`text-sm ${s.subColor}`}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/[0.05] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.01]">
          <div className="relative max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search invoices by client, plan, or invoice number…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 text-slate-900 dark:text-white"
            />
          </div>
        </div>
        <div className="overflow-x-hidden">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.01] text-[9px] sm:text-[10px] uppercase text-slate-500 tracking-wider">
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[18%] hidden sm:table-cell">Invoice #</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[22%]">Client</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[10%]">Plan</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[10%]">Amount</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[12%] hidden md:table-cell">Date</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[16%] hidden lg:table-cell">Payment Method</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[10%]">Status</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[10%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04] text-[10px] sm:text-[11px] text-slate-700 dark:text-slate-300">
              {paginatedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors">
                  <td className="p-2 sm:p-4 font-mono text-[9px] text-slate-500 hidden sm:table-cell truncate">{inv.id}</td>
                  <td className="p-2 sm:p-4">
                    <span className="font-semibold text-slate-900 dark:text-white block truncate" title={inv.client}>{inv.client}</span>
                    <span className="text-[9px] text-slate-400 font-mono sm:hidden block">{inv.id}</span>
                  </td>
                  <td className="p-2 sm:p-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {inv.plan}
                    </span>
                  </td>
                  <td className="p-2 sm:p-4">
                    <span className="font-semibold text-slate-900 dark:text-white">${inv.amount}</span>
                    <span className="text-[9px] text-slate-400 font-mono md:hidden block mt-1">{inv.date}</span>
                  </td>
                  <td className="p-2 sm:p-4 text-slate-500 font-mono text-[10px] hidden md:table-cell">{inv.date}</td>
                  <td className="p-2 sm:p-4 hidden lg:table-cell">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      {inv.method.includes('Card') ? <CreditCard size={11} className="text-slate-400 shrink-0" /> : <Building2 size={11} className="text-slate-400 shrink-0" />}
                      <span className="truncate">{inv.method}</span>
                    </span>
                  </td>
                  <td className="p-2 sm:p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase border ${
                      inv.status === 'paid'    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                      inv.status === 'pending' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                                                 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    }`}>{inv.status}</span>
                  </td>
                  <td className="p-2 sm:p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        aria-label={`View invoice ${inv.id}`}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleDownload(inv.id)}
                        aria-label={`Download invoice ${inv.id}`}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-sm">No invoices found matching your search.</td>
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

      {/* Invoice detail modal */}
      {/* Invoice detail side panel */}
<AnimatePresence>
  {selectedInvoice && (
    <SideSheet
      isOpen={true}
      onClose={() => setSelectedInvoice(null)}
      title="Invoice Details"
      subtitle={`Complete information for ${selectedInvoice.id}`}
      width="w-full sm:max-w-md"
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">LeadCRM</h2>
            <p className="text-sm text-slate-500">Invoice {selectedInvoice.id}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${STATUS_STYLES[selectedInvoice.status]}`}>{selectedInvoice.status}</span>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          {[['Bill To', selectedInvoice.client], ['Invoice Date', selectedInvoice.date], ['Payment Method', selectedInvoice.method], ['Plan', selectedInvoice.plan]].map(([k, v]) => (
            <div key={k}>
              <p className="text-xs font-medium text-slate-500 mb-1">{k}</p>
              <p className="font-medium text-slate-900 dark:text-white">{v}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-4 border-t border-slate-100 dark:border-slate-800">
          <span>Total</span><span>${selectedInvoice.amount}</span>
        </div>
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-end gap-3">
        <button onClick={() => setSelectedInvoice(null)} className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors">Close</button>
        <button onClick={() => { handleDownload(selectedInvoice.id); setSelectedInvoice(null); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Download size={16} /> Download PDF
        </button>
      </div>
    </SideSheet>
  )}
</AnimatePresence>
    </div>
  );
}
