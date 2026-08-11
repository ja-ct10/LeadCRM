'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard,
  CheckCircle2, XCircle, RotateCcw, RefreshCw, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { adminStripeService } from '../services/admin-stripe.service';
import type { PaymentMetrics, StripePaymentTransaction } from '@/store/types/stripe.types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from '@/shared/components/charts/ChartComponents';

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:     string;
  value:     string;
  sub?:      string;
  subColor?: string;
  icon:      React.ElementType;
  iconBg:    string;
}

function StatCard({ label, value, sub, subColor = 'text-slate-500', icon: Icon, iconBg }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg p-5 flex items-start gap-4">
      <div className={cn('p-2.5 rounded-xl shrink-0', iconBg)}>
        {React.createElement(Icon as any, { size: 18, className: "text-white" })}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className={cn('text-xs mt-1', subColor)}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminRevenuePage() {
  const [metrics, setMetrics]   = useState<PaymentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminStripeService.getMetrics();
      setMetrics(res.data);
    } catch {
      toast.error('Failed to load revenue metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const monthGrowth = metrics
    ? metrics.revenueLastMonth > 0
      ? (((metrics.revenueThisMonth - metrics.revenueLastMonth) / metrics.revenueLastMonth) * 100).toFixed(1)
      : null
    : null;

  const isPositiveGrowth = monthGrowth !== null && Number(monthGrowth) >= 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-100 dark:bg-white/[0.04] rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-72 rounded-2xl bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <AlertCircle size={40} className="mb-4 opacity-40" />
        <p className="font-medium">Could not load revenue data</p>
        <button onClick={fetchMetrics} className="mt-4 text-sm text-blue-500 hover:underline">Try again</button>
      </div>
    );
  }

  // Bar chart data — revenue by plan
  const planBarData = metrics.revenueByPlan.map((p) => ({ name: p.plan, revenue: p.revenue }));

  // Pie data — revenue by tenant (top 10)
  const tenantPieData = metrics.revenueByTenant.slice(0, 8).map((t) => ({
    name: t.tenantName,
    value: t.revenue,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Revenue</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Platform-wide payment analytics from Stripe</p>
        </div>
        <button
          onClick={fetchMetrics}
          aria-label="Refresh metrics"
          className="h-9 px-3 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={fmt(metrics.totalRevenue)}
          sub="All-time successful payments"
          icon={DollarSign}
          iconBg="bg-blue-600"
        />
        <StatCard
          label="This Month"
          value={fmt(metrics.revenueThisMonth)}
          sub={monthGrowth !== null
            ? `${isPositiveGrowth ? '+' : ''}${monthGrowth}% vs last month`
            : undefined}
          subColor={isPositiveGrowth ? 'text-emerald-500' : 'text-red-500'}
          icon={isPositiveGrowth ? TrendingUp : TrendingDown}
          iconBg={isPositiveGrowth ? 'bg-emerald-500' : 'bg-red-500'}
        />
        <StatCard
          label="Successful Payments"
          value={String(metrics.successfulPayments)}
          sub={`${metrics.failedPayments} failed`}
          subColor={metrics.failedPayments > 0 ? 'text-red-500' : 'text-slate-400'}
          icon={CheckCircle2}
          iconBg="bg-emerald-500"
        />
        <StatCard
          label="Total Refunded"
          value={fmt(metrics.totalRefundedAmount)}
          sub={`${metrics.refundedPayments} refund transactions`}
          icon={RotateCcw}
          iconBg="bg-amber-500"
        />
      </div>

      {/* Secondary stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pending',  count: metrics.pendingPayments,  color: 'text-amber-500',   bg: 'bg-amber-500/10 dark:bg-amber-500/10',  icon: CreditCard },
          { label: 'Failed',   count: metrics.failedPayments,   color: 'text-red-500',     bg: 'bg-red-500/10 dark:bg-red-500/10',      icon: XCircle },
          { label: 'Refunds',  count: metrics.refundedPayments, color: 'text-slate-500',   bg: 'bg-slate-500/10 dark:bg-slate-500/10',  icon: RotateCcw },
        ].map(({ label, count, color, bg, icon: Icon }) => (
          <div key={label} className={cn('rounded-xl p-4 flex items-center gap-3', bg, 'border border-transparent')}>
            <Icon size={20} className={color} />
            <div>
              <p className={cn('text-xl font-bold', color)}>{count}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{label} transactions</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by plan */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Revenue by Plan</h3>
          {planBarData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planBarData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: number) => [fmtFull(v), 'Revenue']} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Revenue by tenant */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Revenue by Client (Top 8)</h3>
          {tenantPieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tenantPieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={3}>
                      {tenantPieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmtFull(v), 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {tenantPieData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmt(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/[0.05]">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent Transactions</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-white/[0.03]">
          {metrics.recentTransactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No transactions yet</div>
          ) : (
            (metrics.recentTransactions as StripePaymentTransaction[]).map((txn) => (
              <div key={txn.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'p-1.5 rounded-lg',
                    txn.status === 'paid' ? 'bg-emerald-500/10' :
                    txn.status === 'failed' ? 'bg-red-500/10' : 'bg-amber-500/10',
                  )}>
                    {txn.status === 'paid'
                      ? <CheckCircle2 size={14} className="text-emerald-500" />
                      : txn.status === 'failed'
                        ? <XCircle size={14} className="text-red-500" />
                        : <CreditCard size={14} className="text-amber-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {txn.invoice?.tenant?.name ?? 'Unknown client'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {txn.invoice?.invoiceNumber ?? '—'} · {new Date(txn.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap ml-4">
                  {fmtFull(txn.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
