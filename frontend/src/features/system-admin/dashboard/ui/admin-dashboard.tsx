'use client';

import React, { useMemo, useState } from 'react';
import { DollarSign, Users, TrendingUp, TrendingDown, UserCheck, UserX } from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line, PieChart, Pie, Legend,
} from '@/shared/components/charts/ChartComponents';
import { useTheme } from '@/shared/hooks/use-theme';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type RangeId = '3m' | '6m' | '12m';

interface RangeOption {
  id: RangeId;
  label: string;
  months: number;
}

interface BreakdownSlice {
  name: string;
  value: number;
  detail: string;
  /** Canvas fill for the chart renderer */
  hex: string;
  /** Tailwind class for the legend swatch — keeps colour out of inline styles */
  swatchClass: string;
  /** Required by the shared Pie wrapper's data contract */
  [key: string]: unknown;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGE_OPTIONS: RangeOption[] = [
  { id: '3m',  label: '3M',  months: 3 },
  { id: '6m',  label: '6M',  months: 6 },
  { id: '12m', label: '12M', months: 12 },
];

const REVENUE_DATA = [
  { month: 'Jan', amount: 180000 }, { month: 'Feb', amount: 195000 },
  { month: 'Mar', amount: 210000 }, { month: 'Apr', amount: 225000 },
  { month: 'May', amount: 240000 }, { month: 'Jun', amount: 248000 },
  { month: 'Jul', amount: 255000 }, { month: 'Aug', amount: 265000 },
  { month: 'Sep', amount: 272000 }, { month: 'Oct', amount: 280000 },
  { month: 'Nov', amount: 285000 }, { month: 'Dec', amount: 290000 },
];

const CLIENT_GROWTH_DATA = [
  { month: 'Jan', count: 140 }, { month: 'Feb', count: 165 },
  { month: 'Mar', count: 155 }, { month: 'Apr', count: 190 },
  { month: 'May', count: 195 }, { month: 'Jun', count: 210 },
  { month: 'Jul', count: 230 }, { month: 'Aug', count: 220 },
  { month: 'Sep', count: 235 }, { month: 'Oct', count: 248 },
  { month: 'Nov', count: 240 }, { month: 'Dec', count: 260 },
];

const ACTIVE_CLIENTS_DATA = [
  { month: 'Jan', count: 5800 }, { month: 'Feb', count: 6000 },
  { month: 'Mar', count: 6150 }, { month: 'Apr', count: 6300 },
  { month: 'May', count: 6500 }, { month: 'Jun', count: 6700 },
  { month: 'Jul', count: 6900 }, { month: 'Aug', count: 7050 },
  { month: 'Sep', count: 7150 }, { month: 'Oct', count: 7200 },
  { month: 'Nov', count: 7250 }, { month: 'Dec', count: 7300 },
];

const CHURN_DATA = [
  { month: 'Jan', new: 140, churned: 30 }, { month: 'Feb', new: 165, churned: 32 },
  { month: 'Mar', new: 155, churned: 35 }, { month: 'Apr', new: 190, churned: 33 },
  { month: 'May', new: 195, churned: 28 }, { month: 'Jun', new: 210, churned: 30 },
  { month: 'Jul', new: 230, churned: 35 }, { month: 'Aug', new: 220, churned: 38 },
  { month: 'Sep', new: 235, churned: 32 }, { month: 'Oct', new: 248, churned: 34 },
  { month: 'Nov', new: 240, churned: 30 }, { month: 'Dec', new: 260, churned: 28 },
];

const PLAN_DISTRIBUTION: BreakdownSlice[] = [
  { name: 'Basic',      value: 31, detail: '$89,500',  hex: '#3B82F6', swatchClass: 'bg-blue-500' },
  { name: 'Pro',        value: 50, detail: '$142,800', hex: '#10B981', swatchClass: 'bg-emerald-500' },
  { name: 'Enterprise', value: 19, detail: '$52,290',  hex: '#F59E0B', swatchClass: 'bg-amber-500' },
];

const SUBSCRIPTION_HEALTH: BreakdownSlice[] = [
  { name: 'Active',   value: 95, detail: '1186 clients', hex: '#3B82F6', swatchClass: 'bg-blue-500' },
  { name: 'Past Due', value: 3,  detail: '38 clients',   hex: '#F59E0B', swatchClass: 'bg-amber-500' },
  { name: 'Canceled', value: 2,  detail: '24 clients',   hex: '#EF4444', swatchClass: 'bg-red-500' },
];

const CHART_COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  danger:  '#EF4444',
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * System Admin — Dashboard.
 * Platform-level KPIs for the LeadCRM operator: MRR, client growth, churn,
 * plan distribution and subscription health.
 */
export default function AdminDashboard(): React.ReactElement {
  const { isDark } = useTheme();
  const [range, setRange] = useState<RangeId>('12m');

  const months = RANGE_OPTIONS.find((option) => option.id === range)?.months ?? 12;

  const revenueSeries      = useMemo(() => REVENUE_DATA.slice(-months), [months]);
  const signupSeries       = useMemo(() => CLIENT_GROWTH_DATA.slice(-months), [months]);
  const activeClientSeries = useMemo(() => ACTIVE_CLIENTS_DATA.slice(-months), [months]);
  const churnSeries        = useMemo(() => CHURN_DATA.slice(-months), [months]);

  // Axis/grid colours must be concrete values for the canvas renderer,
  // so they are derived from the resolved theme rather than CSS variables.
  const axisColor = isDark ? '#64748B' : '#8494A7';
  const gridColor = isDark ? '#262A33' : '#E4E9F0';

  const tooltipProps = useMemo(() => ({
    contentStyle: {
      backgroundColor: isDark ? '#16191E' : '#FFFFFF',
      borderColor:     isDark ? '#262A33' : '#E4E9F0',
      color:           isDark ? '#F1F5F9' : '#25313D',
      borderRadius:    '12px',
      fontSize:        '12px',
    },
    itemStyle: { color: isDark ? '#F1F5F9' : '#25313D' },
  }), [isDark]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Platform overview and key metrics
          </p>
        </div>

        {/* Range selector — segmented control */}
        <div
          role="group"
          aria-label="Select reporting range"
          className="inline-flex items-center gap-1 p-1 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] shrink-0"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setRange(option.id)}
              aria-pressed={range === option.id}
              className={cn(
                'px-3 h-7 rounded-lg text-xs font-semibold transition-colors active:scale-95',
                range === option.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign size={18} />}
          label="Monthly Recurring Revenue"
          value="$284,590"
          sub="Total MRR"
          delta="+12.5%"
          isImproving
        />
        <KpiCard
          icon={<Users size={18} />}
          label="Total Clients"
          value="8,429"
          sub="All registered clients"
          delta="+8.3%"
          isImproving
        />
        <KpiCard
          icon={<UserCheck size={18} />}
          label="Active Clients"
          value="7,248"
          sub="Currently active"
          delta="+5.7%"
          isImproving
        />
        <KpiCard
          icon={<UserX size={18} />}
          label="Churn Rate"
          value="2.4%"
          sub="Monthly churn"
          delta="-0.8%"
          isImproving
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Revenue Growth (MRR)" subtitle="Monthly recurring revenue over time">
          <LineChart data={revenueSeries} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="month" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipProps} formatter={(value: number) => [`$${value.toLocaleString()}`, 'MRR']} />
            <Line type="monotone" dataKey="amount" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.primary }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="New Signups" subtitle="Client registrations over time">
          <LineChart data={signupSeries} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="month" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipProps} />
            <Line type="monotone" dataKey="count" stroke={CHART_COLORS.success} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.success }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Active Clients" subtitle="Currently active clients over time">
          <LineChart data={activeClientSeries} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="month" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipProps} />
            <Line type="monotone" dataKey="count" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.primary }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="New vs Churned Clients" subtitle="Client acquisition and churn comparison">
          <BarChart data={churnSeries} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="month" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipProps} cursor={{ fill: isDark ? '#1C2027' : '#ECEEF0' }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            <Bar dataKey="new"     name="New Clients"     fill={CHART_COLORS.success} radius={[2, 2, 0, 0]} barSize={12} />
            <Bar dataKey="churned" name="Churned Clients" fill={CHART_COLORS.danger}  radius={[2, 2, 0, 0]} barSize={12} />
          </BarChart>
        </ChartCard>

        <PieBreakdown title="Revenue by Plan"     data={PLAN_DISTRIBUTION}    tooltipProps={tooltipProps} />
        <PieBreakdown title="Subscription Health" data={SUBSCRIPTION_HEALTH} tooltipProps={tooltipProps} />
      </div>
    </div>
  );
}

// ── Local components ──────────────────────────────────────────────────────────

const CARD_SHELL =
  'rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl';

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  delta: string;
  /** Whether the delta represents a favourable movement for this metric */
  isImproving: boolean;
}

function KpiCard({ icon, label, value, sub, delta, isImproving }: KpiCardProps): React.ReactElement {
  const TrendIcon = isImproving ? TrendingUp : TrendingDown;

  return (
    <div className={cn(CARD_SHELL, 'p-5 flex flex-col justify-between')}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300">
          {icon}
        </div>
        <span
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border',
            isImproving
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
          )}
        >
          <TrendIcon size={12} /> {delta}
        </span>
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{sub}</p>
      </div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps): React.ReactElement {
  return (
    <div className={cn(CARD_SHELL, 'p-6')}>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="h-[300px] w-full relative min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface PieBreakdownProps {
  title: string;
  data: BreakdownSlice[];
  tooltipProps: object;
}

function PieBreakdown({ title, data, tooltipProps }: PieBreakdownProps): React.ReactElement {
  return (
    <div className={cn(CARD_SHELL, 'p-6 flex flex-col')}>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      </div>
      <div className="h-[250px] w-full relative min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, value }) => `${name} ${value}%`}
              labelLine
            >
              {data.map((slice) => <Cell key={slice.name} fill={slice.hex} stroke="none" />)}
            </Pie>
            <Tooltip {...tooltipProps} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 space-y-2">
        {data.map((slice) => (
          <li key={slice.name} className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', slice.swatchClass)} aria-hidden="true" />
              <span className="text-slate-600 dark:text-slate-400">{slice.name}</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{slice.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
