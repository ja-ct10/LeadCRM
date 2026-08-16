'use client';

import React, { useState, useMemo } from 'react';
import {
  Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, MessageSquare,
  HardDrive, Plus, ArrowUpRight, Clock, DollarSign, RefreshCw,
  Sliders, ShieldCheck, Download, AlertCircle, CheckCircle2, ChevronRight,
  TrendingUp, Users, Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';

export function TelephonyUsageTab(): React.ReactElement {
  const { tenant } = useAuth();
  const { users, activities } = useData();

  const [timeRange, setTimeRange] = useState<'current' | 'last_month' | 'last_90'>('current');
  const [autoRecharge, setAutoRecharge] = useState(true);
  const [rechargeThreshold, setRechargeThreshold] = useState(10);
  const [rechargeAmount, setRechargeAmount] = useState(25);
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('50');

  const handleAddFunds = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddFundsOpen(false);
    toast.success(`Successfully added $${customAmount}.00 to your telephony balance!`);
  };

  const realTeamMembers = useMemo(() => {
    return (users || []).filter((u) => !u.isArchived);
  }, [users]);

  const teamUsage = useMemo(() => {
    if (realTeamMembers.length === 0) {
      return [
        { name: 'Primary Workspace Admin', role: 'Administrator', calls: 82, minutes: '164 mins', sms: 45, spend: '$5.40', avatar: 'PA' }
      ];
    }
    return realTeamMembers.map((u, i) => {
      const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || 'U';
      const calls = 80 + ((i + 1) * 55);
      const minutes = `${calls * 2} mins`;
      const sms = 40 + (i * 25);
      const spend = `$${((calls * 0.025) + (sms * 0.008)).toFixed(2)}`;
      return {
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        role: u.role || 'Sales Rep',
        calls,
        minutes,
        sms,
        spend,
        avatar: initials,
      };
    });
  }, [realTeamMembers]);

  // Telephony Quota Metrics
  const metrics = [
    {
      title: 'Voice Minutes',
      used: '1,840 mins',
      limit: '5,000 pooled mins',
      percent: 36.8,
      cost: '$27.60',
      icon: PhoneCall,
      color: 'blue',
      breakdown: '1,220 Outbound · 620 Inbound',
    },
    {
      title: 'Active Numbers',
      used: `${Math.min(10, Math.max(1, realTeamMembers.length))} Numbers`,
      limit: '10 Numbers included',
      percent: Math.min(100, (Math.max(1, realTeamMembers.length) / 10) * 100),
      cost: '$6.00/mo',
      icon: Phone,
      color: 'emerald',
      breakdown: `${Math.max(1, realTeamMembers.length)} Local US/CA Assigned`,
    },
    {
      title: 'Call Recordings',
      used: '42.5 hrs',
      limit: '100 hrs retention',
      percent: 42.5,
      cost: '$4.25',
      icon: HardDrive,
      color: 'violet',
      breakdown: '90-day compliant audio storage',
    },
    {
      title: 'SMS & Messages',
      used: '1,240 SMS',
      limit: '3,000 msgs included',
      percent: 41.3,
      cost: '$9.80',
      icon: MessageSquare,
      color: 'amber',
      breakdown: '1,100 Outbound · 140 Inbound',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-[#1E293B] to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-semibold mb-2 border border-blue-500/30">
              <Phone className="w-3 h-3" /> Telephony & VoIP Usage
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Communication Balance & Quotas</h2>
            <p className="text-xs text-slate-400 mt-1">Real-time voice minutes, phone number leasing, and message units.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-xl p-3 px-4 text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Available Balance</p>
              <p className="text-xl font-black text-emerald-400">$42.80</p>
            </div>
            <button
              onClick={() => setIsAddFundsOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Funds
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.title}
              className="bg-white dark:bg-[#1A222C] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4.5 space-y-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#25313D] text-slate-700 dark:text-slate-200">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{m.cost}</span>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{m.title}</p>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{m.used}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{m.limit}</p>
              </div>

              <div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${m.percent}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 truncate">{m.breakdown}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-Recharge Settings & Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Auto Recharge */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1A222C] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Auto-Recharge Settings</h3>
                <p className="text-xs text-slate-400">Keep your calling and SMS sequences uninterrupted</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoRecharge}
                onChange={(e) => {
                  setAutoRecharge(e.target.checked);
                  toast.success(`Auto-recharge ${e.target.checked ? 'enabled' : 'disabled'}`);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-[#25313D] rounded-xl border border-slate-100 dark:border-white/[0.04] space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              When account balance falls below <span className="font-bold text-slate-900 dark:text-white">${rechargeThreshold}.00</span>, automatically charge payment method on file for <span className="font-bold text-slate-900 dark:text-white">${rechargeAmount}.00</span>.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <select
                value={rechargeThreshold}
                onChange={(e) => setRechargeThreshold(Number(e.target.value))}
                className="bg-white dark:bg-[#1B252F] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value={5}>Trigger: Below $5.00</option>
                <option value={10}>Trigger: Below $10.00</option>
                <option value={20}>Trigger: Below $20.00</option>
                <option value={50}>Trigger: Below $50.00</option>
              </select>

              <select
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(Number(e.target.value))}
                className="bg-white dark:bg-[#1B252F] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value={15}>Top-up: $15.00</option>
                <option value={25}>Top-up: $25.00</option>
                <option value={50}>Top-up: $50.00</option>
                <option value={100}>Top-up: $100.00</option>
              </select>

              <button
                type="button"
                onClick={() => toast.success('Auto-recharge rules updated!')}
                className="px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Update Rule
              </button>
            </div>
          </div>
        </div>

        {/* Rate Card */}
        <div className="bg-white dark:bg-[#1A222C] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-500" /> Standard Calling Rates
          </h3>
          <p className="text-[11px] text-slate-400">Domestic standard rates across US, CA & UK pooled regions.</p>

          <div className="divide-y divide-gray-100 dark:divide-white/[0.04] text-xs">
            <div className="flex justify-between py-2 text-slate-600 dark:text-slate-300">
              <span>Outbound Domestic Call</span>
              <span className="font-bold text-slate-900 dark:text-white">$0.015 / min</span>
            </div>
            <div className="flex justify-between py-2 text-slate-600 dark:text-slate-300">
              <span>Inbound Call Forwarding</span>
              <span className="font-bold text-slate-900 dark:text-white">$0.0085 / min</span>
            </div>
            <div className="flex justify-between py-2 text-slate-600 dark:text-slate-300">
              <span>SMS / MMS Message</span>
              <span className="font-bold text-slate-900 dark:text-white">$0.0079 / msg</span>
            </div>
            <div className="flex justify-between py-2 text-slate-600 dark:text-slate-300">
              <span>Local Number Rental</span>
              <span className="font-bold text-slate-900 dark:text-white">$1.50 / mo</span>
            </div>
            <div className="flex justify-between py-2 text-slate-600 dark:text-slate-300">
              <span>Toll-Free Number Rental</span>
              <span className="font-bold text-slate-900 dark:text-white">$3.00 / mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Team Member Utilization */}
      <div className="bg-white dark:bg-[#1A222C] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Team Utilization Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Call volume and message consumption per sales representative</p>
          </div>
          <button
            type="button"
            onClick={() => toast.info('Exporting telephony CSV report...')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/[0.06] text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="pb-3 font-semibold">Member</th>
                <th className="pb-3 font-semibold">Total Calls</th>
                <th className="pb-3 font-semibold">Talk Time</th>
                <th className="pb-3 font-semibold">SMS Sent</th>
                <th className="pb-3 font-semibold text-right">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {teamUsage.map((u) => (
                <tr key={u.name} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                        {u.avatar}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                        <p className="text-[10px] text-slate-400">{u.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 font-medium text-slate-700 dark:text-slate-300">{u.calls}</td>
                  <td className="py-3 font-medium text-slate-700 dark:text-slate-300">{u.minutes}</td>
                  <td className="py-3 font-medium text-slate-700 dark:text-slate-300">{u.sms}</td>
                  <td className="py-3 font-bold text-slate-900 dark:text-white text-right">{u.spend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Funds Modal */}
      {isAddFundsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#1A222C] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Telephony Credits</h3>
              <button onClick={() => setIsAddFundsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddFunds} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select an amount to replenish your pooled communication wallet. Charged to the default payment method on file.
              </p>

              <div className="grid grid-cols-3 gap-2">
                {['25', '50', '100'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCustomAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      customAmount === amt
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    ${amt}.00
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Custom Amount ($)</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1B252F] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#25313D] rounded-xl flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Default Card: Visa ending in 4242</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddFundsOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Confirm & Charge ${customAmount}.00
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default TelephonyUsageTab;
