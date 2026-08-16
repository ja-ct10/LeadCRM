'use client';
import React, { useState } from 'react';
import { ChevronDown, DollarSign, Users, TrendingUp, UserCheck, UserX } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line, PieChart, Pie, Legend
} from '@/shared/components/charts/ChartComponents';
import { useTheme } from '@/shared/hooks/use-theme';

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

const PLAN_DISTRIBUTION = [
  { name: 'Basic',      value: 31, amount: '$89,500',   color: '#3B82F6' },
  { name: 'Pro',        value: 50, amount: '$142,800',  color: '#10B981' },
  { name: 'Enterprise', value: 19, amount: '$52,290',   color: '#F59E0B' },
];

const PAYMENT_STATUS = [
  { name: 'Paid',    value: 95, clients: '1186 clients', color: '#3B82F6' },
  { name: 'Pending', value: 3,  clients: '38 clients',   color: '#10B981' },
  { name: 'Failed',  value: 2,  clients: '24 clients',   color: '#F59E0B' },
];

/**
 * System Admin — Dashboard page.
 * Shows platform KPIs: MRR, client growth, churn, plan distribution.
 */
export default function AdminDashboard() {
  const { isDark } = useTheme();

  const tooltipProps = {
    contentStyle: isDark ? {
      backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.08)',
      color: '#F8FAFC', borderRadius: '12px',
    } : {
      backgroundColor: '#FFFFFF', borderColor: '#E2E8F0',
      color: '#0F172A', borderRadius: '12px',
    },
    itemStyle: { color: isDark ? '#F8FAFC' : '#0F172A' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Platform overview and key metrics</p>
        </div>
        <div className="relative">
          <select className="appearance-none bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer">
            <option>Last 12 months</option>
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<DollarSign size={20} />} label="Monthly Recurring Revenue" value="$284,590" sub="Total MRR" badge="+12.5%" />
        <KpiCard icon={<Users size={20} />}       label="Total Clients"            value="8,429"    sub="All registered clients" badge="+8.3%" />
        <KpiCard icon={<UserCheck size={20} />}   label="Active Clients"           value="7,248"    sub="Currently active"       badge="+5.7%" />
        <KpiCard icon={<UserX size={20} />}       label="Churn Rate"               value="2.4%"     sub="Monthly churn"          badge="-0.8%" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Revenue Growth (MRR)" subtitle="Monthly recurring revenue over time">
          <LineChart data={REVENUE_DATA} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={false} />
            <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} ticks={[0, 75000, 150000, 225000, 300000]} />
            <Tooltip {...tooltipProps} formatter={(v: number) => [`$${v.toLocaleString()}`, 'MRR']} />
            <Line type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: '#3B82F6' }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="New Signups" subtitle="Client registrations over time">
          <LineChart data={CLIENT_GROWTH_DATA} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={false} />
            <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} ticks={[0, 65, 130, 195, 260]} />
            <Tooltip {...tooltipProps} />
            <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: '#10B981' }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Active Clients" subtitle="Currently active clients over time">
          <LineChart data={ACTIVE_CLIENTS_DATA} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={false} />
            <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} ticks={[0, 2000, 4000, 6000, 8000]} />
            <Tooltip {...tooltipProps} />
            <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: '#3B82F6' }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="New vs Churned Clients" subtitle="Client acquisition and churn comparison">
          <BarChart data={CHURN_DATA} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={false} />
            <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipProps} cursor={{ fill: isDark ? '#1e293b' : '#f1f5f9' }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            <Bar dataKey="new"     name="New Clients"     fill="#10B981" radius={[2, 2, 0, 0]} barSize={12} />
            <Bar dataKey="churned" name="Churned Clients" fill="#EF4444" radius={[2, 2, 0, 0]} barSize={12} />
          </BarChart>
        </ChartCard>

        <PieBreakdown title="Revenue by Plan" data={PLAN_DISTRIBUTION} tooltipProps={tooltipProps} />
        <PieBreakdown title="Payment Status"  data={PAYMENT_STATUS}    tooltipProps={tooltipProps} />
      </div>
    </div>
  );
}

// --- Local helpers ------------------------------------------------------------

function KpiCard({ icon, label, value, sub, badge }: { icon: React.ReactNode; label: string; value: string; sub: string; badge: string }) {
  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">{icon}</div>
        <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
          <TrendingUp size={12} /> {badge}
        </span>
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
        <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>
      <div className="h-[300px] w-full relative min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PieBreakdown({ title, data, tooltipProps }: { title: string; data: { name: string; value: number; color: string; amount?: string; clients?: string }[]; tooltipProps: object }) {
  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="h-[250px] w-full relative min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={0} outerRadius={100} paddingAngle={2} dataKey="value"
              label={({ name, value }) => `${name} ${value}%`} labelLine>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
            </Pie>
            <Tooltip {...tooltipProps} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">{item.amount || item.clients}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
