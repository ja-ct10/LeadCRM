'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, ExternalLink, Eye, RefreshCw, CreditCard,
  CheckCircle2, Clock, XCircle, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { SideSheet } from '@/shared/components/side-sheet';
import { Pagination } from '@/shared/components/ui/pagination';
import { cn } from '@/lib/utils';
import { adminStripeService } from '../services/admin-stripe.service';
import type { StripePaymentTransaction, PaymentStatus } from '@/store/types/stripe.types';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PaymentStatus, { label: string; icon: React.ElementType; classes: string }> = {
  paid:                { label: 'Paid',             icon: CheckCircle2, classes: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' },
  pending:             { label: 'Pending',           icon: Clock,        classes: 'bg-amber-500/10 border-amber-500/20 text-amber-500' },
  failed:              { label: 'Failed',            icon: XCircle,      classes: 'bg-red-500/10 border-red-500/20 text-red-500' },
  refunded:            { label: 'Refunded',          icon: RotateCcw,    classes: 'bg-slate-500/10 border-slate-500/20 text-slate-500' },
  partially_refunded:  { label: 'Partial Refund',   icon: RotateCcw,    classes: 'bg-amber-500/10 border-amber-500/20 text-amber-500' },
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', cfg.classes)}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Filter options ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'paid',               label: 'Paid' },
  { value: 'pending',            label: 'Pending' },
  { value: 'failed',             label: 'Failed' },
  { value: 'refunded',           label: 'Refunded' },
  { value: 'partially_refunded', label: 'Partially Refunded' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [transactions, setTransactions]       = useState<StripePaymentTransaction[]>([]);
  const [total, setTotal]                     = useState(0);
  const [page, setPage]                       = useState(1);
  const [pageSize]                            = useState(25);
  const [search, setSearch]                   = useState('');
  const [searchInput, setSearchInput]         = useState('');
  const [statusFilter, setStatusFilter]       = useState('');
  const [isLoading, setIsLoading]             = useState(true);
  const [selectedTxn, setSelectedTxn]         = useState<StripePaymentTransaction | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminStripeService.getPayments({
        page,
        limit:  pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setTransactions(res.data);
      setTotal(res.meta.total);
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, search]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleStatusChange = (val: string) => { setStatusFilter(val); setPage(1); };

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Payments</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">All Stripe payment transactions across every tenant</p>
        </div>
        <button
          onClick={fetchPayments}
          aria-label="Refresh payments"
          className="h-9 px-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by client, invoice, or Stripe ID…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] pl-9 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          aria-label="Filter by status"
          className="h-9 rounded-md border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors min-w-[160px]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                {['Date', 'Client', 'Invoice', 'Amount', 'Method', 'Status', 'Stripe ID', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.03]">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 dark:bg-white/[0.04] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-400 dark:text-slate-500">
                    <CreditCard size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No transactions found</p>
                    <p className="text-xs mt-1">Payments will appear here once processed via Stripe.</p>
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(txn.paidAt ?? txn.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      {txn.invoice.tenant.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {txn.invoice.invoiceNumber}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(txn.amount, txn.currency)}
                      {txn.refundedAmount ? (
                        <span className="ml-1.5 text-xs font-normal text-amber-500">
                          −{formatCurrency(txn.refundedAmount, txn.currency)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 capitalize">
                      {txn.paymentMethod ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={txn.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      {txn.stripePaymentIntentId ? (
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                          {txn.stripePaymentIntentId.slice(0, 20)}…
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setSelectedTxn(txn)}
                          aria-label="View transaction details"
                          className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        {txn.stripeDashboardUrl && (
                          <a
                            href={txn.stripeDashboardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open in Stripe Dashboard"
                            className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-gray-200 dark:border-white/[0.05] px-5 py-3">
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

      {/* Detail drawer */}
      <SideSheet
        isOpen={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
        title="Transaction Details"
        subtitle={selectedTxn?.invoice.invoiceNumber ?? ''}
        width="w-full sm:max-w-lg"
      >
        {selectedTxn && (
          <div className="p-6 space-y-6">
            {/* Status + amount */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(selectedTxn.amount, selectedTxn.currency)}
                </p>
                {selectedTxn.refundedAmount ? (
                  <p className="text-sm text-amber-500 mt-0.5">
                    {formatCurrency(selectedTxn.refundedAmount, selectedTxn.currency)} refunded
                  </p>
                ) : null}
              </div>
              <StatusBadge status={selectedTxn.status} />
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-200 dark:border-white/[0.05] p-4 bg-slate-50/50 dark:bg-white/[0.02]">
              {[
                ['Client',         selectedTxn.invoice.tenant.name],
                ['Invoice',        selectedTxn.invoice.invoiceNumber],
                ['Plan',           selectedTxn.invoice.plan ?? '—'],
                ['Method',         selectedTxn.paymentMethod ?? '—'],
                ['Paid at',        formatDate(selectedTxn.paidAt)],
                ['Created',        formatDate(selectedTxn.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white mt-0.5 capitalize">{value}</p>
                </div>
              ))}
            </div>

            {/* Failure reason */}
            {selectedTxn.failureReason && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-xs font-semibold text-red-500 mb-1">Failure Reason</p>
                <p className="text-sm text-red-400">{selectedTxn.failureReason}</p>
              </div>
            )}

            {/* Stripe IDs */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stripe References</p>
              {[
                ['Payment Intent', selectedTxn.stripePaymentIntentId],
                ['Checkout Session', selectedTxn.stripeCheckoutSessionId],
                ['Invoice ID', selectedTxn.stripeInvoiceId],
                ['Refund ID', selectedTxn.stripeRefundId],
              ].map(([label, val]) =>
                val ? (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.05] px-2 py-0.5 rounded">
                      {val}
                    </span>
                  </div>
                ) : null,
              )}
            </div>

            {/* Stripe Dashboard link */}
            {selectedTxn.stripeDashboardUrl && (
              <a
                href={selectedTxn.stripeDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
              >
                <ExternalLink size={14} />
                View in Stripe Dashboard
              </a>
            )}
          </div>
        )}
      </SideSheet>
    </div>
  );
}
