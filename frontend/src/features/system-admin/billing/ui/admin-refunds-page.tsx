'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, RotateCcw, RefreshCw, AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Pagination } from '@/shared/components/ui/pagination';
import { ModalCloseButton } from '@/shared/components/ui/modal-close-button';
import { cn } from '@/lib/utils';
import { adminStripeService } from '../services/admin-stripe.service';
import type { RefundableTransaction } from '@/store/types/stripe.types';

const REASON_OPTIONS: Array<{ value: 'duplicate' | 'fraudulent' | 'requested_by_customer'; label: string }> = [
  { value: 'requested_by_customer', label: 'Requested by customer' },
  { value: 'duplicate',             label: 'Duplicate payment' },
  { value: 'fraudulent',            label: 'Fraudulent charge' },
];

const fmt = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(n);

// ─── Refund confirmation modal ────────────────────────────────────────────────

interface RefundModalProps {
  txn:      RefundableTransaction;
  onClose:  () => void;
  onSuccess: () => void;
}

function RefundModal({ txn, onClose, onSuccess }: RefundModalProps) {
  const remaining    = txn.amount - (txn.refundedAmount ?? 0);
  const [amountStr, setAmountStr]   = useState(remaining.toFixed(2));
  const [reason, setReason]         = useState<'requested_by_customer' | 'duplicate' | 'fraudulent'>('requested_by_customer');
  const [isSaving, setIsSaving]     = useState(false);
  const [isDone, setIsDone]         = useState(false);

  const amountNum = parseFloat(amountStr) || 0;
  const isValid   = amountNum > 0 && amountNum <= remaining;

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSaving(true);
    try {
      await adminStripeService.createRefund({
        paymentTransactionId: txn.id,
        amountCents:          Math.round(amountNum * 100),
        reason,
      });
      setIsDone(true);
      toast.success(`Refund of ${fmt(amountNum)} initiated successfully`);
      setTimeout(() => { onSuccess(); onClose(); }, 1400);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refund failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Initiate Refund</h3>
            <p className="text-sm text-slate-500 mt-0.5">{txn.invoice.tenant.name} · {txn.invoice.invoiceNumber}</p>
          </div>
          <ModalCloseButton onClose={onClose} ariaLabel="Close refund dialog" size={18} />
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Summary */}
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.05] p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Original amount</span>
              <span className="font-medium text-slate-900 dark:text-white">{fmt(txn.amount, txn.currency)}</span>
            </div>
            {(txn.refundedAmount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Already refunded</span>
                <span className="font-medium text-amber-500">−{fmt(txn.refundedAmount!, txn.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-gray-200 dark:border-white/[0.05] pt-2">
              <span className="font-semibold text-slate-900 dark:text-white">Remaining refundable</span>
              <span className="font-bold text-emerald-500">{fmt(remaining, txn.currency)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label htmlFor="refund-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Refund Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
              <input
                id="refund-amount"
                type="number"
                min="0.01"
                max={remaining}
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] pl-7 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {!isValid && amountNum > 0 && (
              <p className="text-xs text-red-500 mt-1">
                Amount must be between $0.01 and {fmt(remaining, txn.currency)}
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="refund-reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Reason
            </label>
            <select
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="h-9 w-full rounded-md border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              {REASON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
            <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Refunds are processed immediately via Stripe and cannot be reversed. The customer's
              card will be credited within 5–10 business days.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="flex-1 h-9 px-4 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSaving || isDone}
            className="flex-1 h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-md shadow-red-500/20 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isDone ? (
              <><CheckCircle2 size={14} /> Refunded</>
            ) : isSaving ? (
              <><Loader2 size={14} className="animate-spin" /> Processing…</>
            ) : (
              <><RotateCcw size={14} /> Issue Refund</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminRefundsPage() {
  const [transactions, setTransactions]       = useState<RefundableTransaction[]>([]);
  const [total, setTotal]                     = useState(0);
  const [page, setPage]                       = useState(1);
  const [pageSize]                            = useState(25);
  const [search, setSearch]                   = useState('');
  const [searchInput, setSearchInput]         = useState('');
  const [isLoading, setIsLoading]             = useState(true);
  const [refundTarget, setRefundTarget]       = useState<RefundableTransaction | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminStripeService.getRefundablePayments({
        page, limit: pageSize, search: search || undefined,
      });
      setTransactions(res.data);
      setTotal(res.meta.total);
    } catch {
      toast.error('Failed to load refundable payments');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const remainingAmount = (txn: RefundableTransaction) => txn.amount - (txn.refundedAmount ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Refunds</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Issue refunds for paid Stripe transactions
          </p>
        </div>
        <button
          onClick={fetchData}
          aria-label="Refresh refundable payments"
          className="h-9 px-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-500/5 border border-blue-500/20 px-4 py-3">
        <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Only transactions processed via Stripe appear here. Refunds are processed through Stripe
          and the application database is updated only after Stripe confirms the refund.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="Search by client or invoice number…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-full rounded-md border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] pl-9 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                {['Client', 'Invoice', 'Paid', 'Original', 'Refunded', 'Remaining', 'Status', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.03]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
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
                    <RotateCcw size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No refundable transactions</p>
                    <p className="text-xs mt-1">Paid Stripe transactions will appear here.</p>
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => {
                  const remaining = remainingAmount(txn);
                  const isPartial = (txn.refundedAmount ?? 0) > 0;
                  return (
                    <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                        {txn.invoice.tenant.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {txn.invoice.invoiceNumber}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {txn.paidAt ? new Date(txn.paidAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                        {fmt(txn.amount, txn.currency)}
                      </td>
                      <td className="px-5 py-3.5">
                        {(txn.refundedAmount ?? 0) > 0
                          ? <span className="text-amber-500 font-medium">{fmt(txn.refundedAmount!, txn.currency)}</span>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-emerald-500">
                        {fmt(remaining, txn.currency)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                          isPartial
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
                        )}>
                          {isPartial ? 'Partially refunded' : 'Eligible'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setRefundTarget(txn)}
                          className="h-8 px-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                        >
                          <RotateCcw size={12} />
                          Refund
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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

      {/* Refund modal */}
      <AnimatePresence>
        {refundTarget && (
          <RefundModal
            txn={refundTarget}
            onClose={() => setRefundTarget(null)}
            onSuccess={fetchData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
