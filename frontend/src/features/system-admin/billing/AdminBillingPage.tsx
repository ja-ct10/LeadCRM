'use client';
import React, { useState } from 'react';
import { Search, Eye, Download, CreditCard, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ModalCloseButton } from '@/shared/components/ui/ModalCloseButton';

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
      <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="relative max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search invoices by client, plan, or invoice number…" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Invoice #', 'Client', 'Plan', 'Amount', 'Date', 'Payment Method', 'Status', ''].map((h) => (
                  <th key={h} className={`px-6 py-4 font-semibold ${!h ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs">{inv.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{inv.client}</td>
                  <td className="px-6 py-4">{inv.plan}</td>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">${inv.amount}</td>
                  <td className="px-6 py-4 text-slate-500">{inv.date}</td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    {inv.method.includes('Card') ? <CreditCard size={14} className="text-slate-400" /> : <Building2 size={14} className="text-slate-400" />}
                    {inv.method}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => setSelectedInvoice(inv)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><Eye size={16} /></button>
                      <button onClick={() => handleDownload(inv.id)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><Download size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">No invoices found matching your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500">
          <span>Showing {filteredInvoices.length} of {MOCK_INVOICES.length} invoices</span>
          <div className="flex items-center gap-2">
            <button className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 disabled:opacity-50" disabled><ChevronLeft size={16} /></button>
            <span>Page 1 of 1</span>
            <button className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 disabled:opacity-50" disabled><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Invoice detail modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-950 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Invoice Details</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Complete information for {selectedInvoice.id}</p>
                </div>
                <ModalCloseButton onClose={() => setSelectedInvoice(null)} ariaLabel="Close invoice details modal" size={20} />
              </div>
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
