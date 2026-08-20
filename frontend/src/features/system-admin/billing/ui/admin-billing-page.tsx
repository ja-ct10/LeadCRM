'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Eye, Download, CreditCard, Building2, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { SideSheet } from '@/shared/components/side-sheet';
import { Pagination } from '@/shared/components/ui/pagination';
import { cn } from '@/lib/utils';
import { adminStripeService } from '../services/admin-stripe.service';
import type { StripePaymentTransaction, PaymentMetrics, PaymentStatus } from '@/store/types/stripe.types';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<PaymentStatus, { label: string; classes: string }> = {
  paid:               { label: 'Paid',           classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  pending:            { label: 'Pending',         classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  failed:             { label: 'Failed',          classes: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  refunded:           { label: 'Refunded',        classes: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
  partially_refunded: { label: 'Partial Refund', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as PaymentStatus] ?? STATUS_CFG.pending;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase border', cfg.classes)}>
      {cfg.label}
    </span>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const [transactions, setTransactions]   = useState<StripePaymentTransaction[]>([]);
  const [metrics, setMetrics]             = useState<PaymentMetrics | null>(null);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [pageSize]                        = useState(25);
  const [searchInput, setSearchInput]     = useState('');
  const [search, setSearch]               = useState('');
  const [isLoading, setIsLoading]         = useState(true);
  const [selectedTxn, setSelectedTxn]     = useState<StripePaymentTransaction | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [txnRes, metricsRes] = await Promise.all([
        adminStripeService.getPayments({ page, limit: pageSize, search: search || undefined }),
        adminStripeService.getMetrics(),
      ]);
      setTransactions(txnRes.data);
      setTotal(txnRes.meta.total);
      setMetrics(metricsRes.data);
    } catch {
      toast.error('Failed to load billing data');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleDownload = (id: string) => toast.success(`Downloading invoice ${id}…`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Billing</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Stripe payment history across all tenants</p>
        </div>
        <button
          onClick={fetchAll}
          aria-label="Refresh billing data"
          className="h-9 px-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            label:    'Total Revenue (This Month)',
            value:    metrics ? fmt(metrics.revenueThisMonth) : '—',
            sub:      metrics ? `${metrics.successfulPayments} paid transactions` : 'Loading…',
            subColor: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label:    'Pending Revenue',
            value:    metrics ? String(metrics.pendingPayments) + ' pending' : '—',
            sub:      metrics ? 'Awaiting payment confirmation' : 'Loading…',
            subColor: 'text-amber-600 dark:text-amber-400',
          },
          {
            label:    'Failed Payments',
            value:    metrics ? String(metrics.failedPayments) : '—',
            sub:      metrics && metrics.failedPayments > 0 ? 'Requires attention' : 'All clear',
            subColor: metrics && metrics.failedPayments > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-emerald-600 dark:text-emerald-400',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl p-6"
          >
            <h3 className="text-sm text-slate-500 dark:text-slate-400 mb-4">{s.label}</h3>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              {isLoading ? (
                <div className="h-8 w-24 bg-slate-100 dark:bg-white/[0.04] rounded-lg animate-pulse" />
              ) : s.value}
            </div>
            <div className={cn('text-sm', s.subColor)}>{isLoading ? '…' : s.sub}</div>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/[0.05] shadow-lg backdrop-blur-xl overflow-hidden flex flex-col">
        {/* Search bar */}
        <div className="p-4 border-b border-gray-200 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="relative max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by client, invoice number, or Stripe ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 w-full pl-9 pr-4 bg-slate-100 dark:bg-white/[0.04] border-none rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-hidden">
          <table className="w-full text-left text-sm border-collapse table-fixed">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.01] text-[9px] sm:text-[10px] uppercase text-slate-500 tracking-wider">
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[16%]">Invoice #</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[20%]">Client</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[10%] hidden sm:table-cell">Plan</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[12%]">Amount</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[12%] hidden md:table-cell">Date</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[14%] hidden sm:table-cell">Payment Method</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold w-[10%]">Status</th>
                <th className="p-2 sm:p-4 py-2 sm:py-3 font-semibold text-right w-[16%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04] text-[10px] sm:text-[11px] text-slate-700 dark:text-slate-300">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="p-2 sm:p-4">
                        <div className="h-4 bg-slate-100 dark:bg-white/[0.04] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-sm">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="p-2 sm:p-4 font-mono truncate" title={txn.invoice.invoiceNumber}>
                      {txn.invoice.invoiceNumber}
                    </td>
                    <td className="p-2 sm:p-4">
                      <span className="font-semibold text-slate-900 dark:text-white block truncate" title={txn.invoice.tenant.name}>
                        {txn.invoice.tenant.name}
                      </span>
                      <span className="text-[9px] text-slate-400 sm:hidden block truncate">{txn.invoice.plan ?? '—'}</span>
                    </td>
                    <td className="p-2 sm:p-4 hidden sm:table-cell truncate">{txn.invoice.plan ?? '—'}</td>
                    <td className="p-2 sm:p-4 font-semibold text-slate-900 dark:text-white">
                      {fmt(txn.amount)}
                      <span className="text-[9px] text-slate-400 font-mono md:hidden block mt-1">
                        {txn.paidAt ? new Date(txn.paidAt).toISOString().split('T')[0] : '—'}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 text-slate-500 hidden md:table-cell font-mono text-[10px]">
                      {txn.paidAt ? new Date(txn.paidAt).toISOString().split('T')[0] : '—'}
                    </td>
                    <td className="p-2 sm:p-4 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 truncate">
                        {txn.paymentMethod?.includes('card')
                          ? <CreditCard size={12} className="text-slate-400 shrink-0" />
                          : <Building2 size={12} className="text-slate-400 shrink-0" />}
                        <span className="capitalize truncate">{txn.paymentMethod ?? '—'}</span>
                      </div>
                    </td>
                    <td className="p-2 sm:p-4">
                      <StatusBadge status={txn.status} />
                    </td>
                    <td className="p-2 sm:p-4">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => setSelectedTxn(txn)}
                          aria-label="View transaction"
                          className="flex items-center gap-1 px-2 py-1 border border-slate-200 dark:border-white/[0.08] rounded-md text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          onClick={() => handleDownload(txn.invoice.invoiceNumber)}
                          aria-label="Download invoice"
                          className="flex items-center gap-1 px-2 py-1 border border-blue-500/30 rounded-md text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Download size={12} /> Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-white/[0.05]">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={total}
            pageSizeOptions={[25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={() => {}}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Invoice detail drawer */}
      <SideSheet
        isOpen={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
        title="Invoice Details"
        subtitle={selectedTxn ? `${selectedTxn.invoice.invoiceNumber}` : ''}
        width="w-full sm:max-w-md"
      >
        {selectedTxn && (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">LeadCRM</h2>
                <p className="text-sm text-slate-500">Invoice {selectedTxn.invoice.invoiceNumber}</p>
              </div>
              <StatusBadge status={selectedTxn.status} />
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              {[
                ['Bill To',         selectedTxn.invoice.tenant.name],
                ['Invoice Date',    selectedTxn.paidAt ? new Date(selectedTxn.paidAt).toLocaleDateString() : '—'],
                ['Payment Method',  selectedTxn.paymentMethod ?? '—'],
                ['Plan',            selectedTxn.invoice.plan ?? '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs font-medium text-slate-500 mb-1">{k}</p>
                  <p className="font-medium text-slate-900 dark:text-white capitalize">{v}</p>
                </div>
              ))}
            </div>

            {/* Stripe IDs */}
            {selectedTxn.stripePaymentIntentId && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Stripe Reference</p>
                <p className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] px-3 py-2 rounded-lg break-all">
                  {selectedTxn.stripePaymentIntentId}
                </p>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-4 border-t border-slate-100 dark:border-slate-800">
              <span>Total</span>
              <span>{fmt(selectedTxn.amount)}</span>
            </div>
          </div>
        )}
        {selectedTxn && (
          <div className="p-4 border-t border-gray-200 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.02] flex justify-end gap-3">
            <button
              onClick={() => setSelectedTxn(null)}
              className="px-4 py-2 bg-white dark:bg-transparent border border-gray-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors active:scale-95"
            >
              Close
            </button>
            <button
              onClick={() => { handleDownload(selectedTxn.invoice.invoiceNumber); setSelectedTxn(null); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download size={16} /> Download PDF
            </button>
          </div>
        )}
      </SideSheet>
    </div>
  );
}