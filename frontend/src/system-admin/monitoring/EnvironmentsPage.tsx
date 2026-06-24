'use client';
import React, { useState } from 'react';
import { Search, Database, CheckCircle2, AlertTriangle, XCircle, Cpu, HardDrive, Activity } from 'lucide-react';
import { useData } from '@/store/DataContext';
import { motion } from 'motion/react';

/**
 * System Admin — Environment Health page.
 * Real-time monitoring of all tenant sandbox/production environments.
 */
export default function EnvironmentsPage() {
  const { tenants } = useData();
  const [envFilter, setEnvFilter] = useState<'all' | 'production' | 'sandbox'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'warning' | 'critical'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const envData = tenants
    .filter((t) => t.environment !== 'none')
    .flatMap((t) => {
      if (t.environment === 'both') {
        return [{ ...t, displayEnv: 'production' }, { ...t, displayEnv: 'sandbox' }];
      }
      return [{ ...t, displayEnv: t.environment }];
    });

  const filteredEnvData = envData.filter((t) => {
    if (envFilter !== 'all' && t.displayEnv !== envFilter) return false;
    if (statusFilter !== 'all' && t.healthMetrics?.status !== statusFilter) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const healthyCount  = envData.filter((t) => t.healthMetrics?.status === 'healthy').length;
  const warningCount  = envData.filter((t) => t.healthMetrics?.status === 'warning').length;
  const criticalCount = envData.filter((t) => t.healthMetrics?.status === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Environment Health</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time monitoring of client environments</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Live</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard icon={<Database size={24} />} label="Total Environments" value={envData.length} color="slate" />
        <SummaryCard icon={<CheckCircle2 size={24} />} label="Healthy"  value={healthyCount}  color="emerald" />
        <SummaryCard icon={<AlertTriangle size={24} />} label="Warning" value={warningCount}  color="amber" />
        <SummaryCard icon={<XCircle size={24} />}       label="Critical" value={criticalCount} color="red" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search by client name…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-4">
          <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value as any)}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]">
            <option value="all">All Environments</option>
            <option value="production">Production</option>
            <option value="sandbox">Sandbox</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]">
            <option value="all">All Status</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Environment grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEnvData.map((env, i) => (
          <div key={`${env.id}-${env.displayEnv}-${i}`}
            className="bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{env.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">
                    ENV-{env.displayEnv === 'production' ? 'PROD' : 'SAND'}-{env.id.split('_')[1] || '001'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${env.displayEnv === 'production' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'}`}>
                    {env.displayEnv}
                  </span>
                  {env.healthMetrics?.status === 'healthy'  && <CheckCircle2  size={18} className="text-emerald-500" />}
                  {env.healthMetrics?.status === 'warning'  && <AlertTriangle size={18} className="text-amber-500" />}
                  {env.healthMetrics?.status === 'critical' && <XCircle       size={18} className="text-red-500" />}
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4 flex-grow">
              <MetricBar label="CPU"     value={env.healthMetrics?.cpuUsage      || 0} icon={<Cpu size={14} />} />
              <MetricBar label="RAM"     value={env.healthMetrics?.memoryUsage   || 0} icon={<Activity size={14} />} />
              <MetricBar label="Storage" value={env.healthMetrics?.storageUsage  || 0} icon={<HardDrive size={14} />} />
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800/50 flex justify-between items-center text-xs text-slate-500">
              <span>Uptime: <span className="font-semibold text-slate-700 dark:text-slate-300">{env.healthMetrics?.uptime || '99.9%'}</span></span>
              <span>{env.healthMetrics?.lastCheck ? new Date(env.healthMetrics.lastCheck).toLocaleTimeString() : 'Just now'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center text-sm text-slate-500">
        <span>Monitoring {filteredEnvData.length} client environments</span>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

// ─── Local helpers ────────────────────────────────────────────────────────────

type ColorKey = 'slate' | 'emerald' | 'amber' | 'red';

const PALETTE: Record<ColorKey, { bg: string; border: string; label: string; icon: string; text: string }> = {
  slate:   { bg: 'bg-white dark:bg-[#0B1120]', border: 'border-slate-200 dark:border-slate-800',   label: 'text-slate-500 dark:text-slate-400', icon: 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400', text: 'text-slate-900 dark:text-white' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', label: 'text-emerald-600 dark:text-emerald-400', icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-300' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-500/10',     border: 'border-amber-200 dark:border-amber-500/20',     label: 'text-amber-600 dark:text-amber-400',     icon: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',     text: 'text-amber-700 dark:text-amber-300' },
  red:     { bg: 'bg-red-50 dark:bg-red-500/10',         border: 'border-red-200 dark:border-red-500/20',         label: 'text-red-600 dark:text-red-400',         icon: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',         text: 'text-red-700 dark:text-red-300' },
};

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: ColorKey }) {
  const p = PALETTE[color];
  return (
    <div className={`${p.bg} rounded-xl border ${p.border} p-4 flex items-center justify-between`}>
      <div>
        <p className={`text-sm ${p.label} mb-1`}>{label}</p>
        <p className={`text-2xl font-bold ${p.text}`}>{value}</p>
      </div>
      <div className={`p-3 ${p.icon} rounded-lg`}>{icon}</div>
    </div>
  );
}

function MetricBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const isWarn = value > 70;
  const isCrit = value > 90;
  const color = isCrit ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = isCrit ? 'text-red-500' : isWarn ? 'text-amber-500' : 'text-emerald-500';
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          {icon}<span className="text-xs font-medium">{label}</span>
        </div>
        <span className={`text-xs font-bold ${textColor}`}>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} className={`h-full ${color}`} />
      </div>
    </div>
  );
}
