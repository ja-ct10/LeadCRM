'use client';

import React, { useState } from 'react';
import { 
  Receipt, Plus, Search, Filter, MoreVertical, 
  Calendar, User, CreditCard, ArrowUpRight, 
  Clock, CheckCircle2, AlertCircle, RefreshCw,
  FileText, TrendingUp, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Contract {
  id: string;
  client: string;
  plan: string;
  amount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Annual';
  status: 'Active' | 'Pending Renewal' | 'Expired' | 'Cancelled';
  startDate: string;
  nextBillingDate: string;
  lastPayment: 'Paid' | 'Unpaid' | 'Overdue';
}

const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'CON-2001',
    client: 'SM City North EDSA',
    plan: 'Enterprise Security Maintenance',
    amount: 25000,
    frequency: 'Monthly',
    status: 'Active',
    startDate: '2025-01-01',
    nextBillingDate: '2026-05-01',
    lastPayment: 'Paid'
  },
  {
    id: 'CON-2002',
    client: 'Ayala Malls Vertis North',
    plan: 'Managed Network Services',
    amount: 15000,
    frequency: 'Monthly',
    status: 'Active',
    startDate: '2026-02-15',
    nextBillingDate: '2026-05-15',
    lastPayment: 'Paid'
  },
  {
    id: 'CON-2003',
    client: 'BDO Corporate Center',
    plan: 'Biometrics Support AMC',
    amount: 45000,
    frequency: 'Annual',
    status: 'Pending Renewal',
    startDate: '2025-05-20',
    nextBillingDate: '2026-05-20',
    lastPayment: 'Paid'
  },
  {
    id: 'CON-2004',
    client: 'PLDT Enterprise Office',
    plan: 'IPBX Hosting & Support',
    amount: 8500,
    frequency: 'Monthly',
    status: 'Active',
    startDate: '2026-03-01',
    nextBillingDate: '2026-05-01',
    lastPayment: 'Overdue'
  },
  {
    id: 'CON-2005',
    client: 'Robinson\'s Galleria',
    plan: 'Fire Alarm Monitoring',
    amount: 12000,
    frequency: 'Quarterly',
    status: 'Expired',
    startDate: '2024-11-12',
    nextBillingDate: '2025-11-12',
    lastPayment: 'Unpaid'
  }
];

export default function BillingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const filteredContracts = MOCK_CONTRACTS.filter(contract => {
    const matchesSearch = 
      contract.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.plan.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'All' || contract.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Pending Renewal': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Expired': return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';
      case 'Cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'text-emerald-400';
      case 'Unpaid': return 'text-slate-500 dark:text-slate-400';
      case 'Overdue': return 'text-red-400';
      default: return 'text-slate-500 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Receipt className="text-blue-500" />
            Contract Billing
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage recurring revenue, subscriptions, and contract renewals.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-white/[0.05] hover:bg-gray-100 dark:hover:bg-white/[0.1] text-slate-900 dark:text-white rounded-xl font-semibold transition-all border border-gray-300 dark:border-white/[0.1]">
            <FileText size={18} />
            Reports
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20">
            <Plus size={18} />
            New Contract
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Recurring Revenue', value: 'Γé▒145,200', icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Active Contracts', value: '84', icon: FileText, color: 'text-blue-400' },
          { label: 'Pending Renewals', value: '12', icon: RefreshCw, color: 'text-amber-400' },
          { label: 'Overdue Payments', value: 'Γé▒8,500', icon: AlertCircle, color: 'text-red-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">{stat.label}</span>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Search by client, contract ID, or plan..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-500" />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
          >
            <option value="All" className="bg-gray-50 dark:bg-[#030712]">All Status</option>
            <option value="Active" className="bg-gray-50 dark:bg-[#030712]">Active</option>
            <option value="Pending Renewal" className="bg-gray-50 dark:bg-[#030712]">Pending Renewal</option>
            <option value="Expired" className="bg-gray-50 dark:bg-[#030712]">Expired</option>
            <option value="Cancelled" className="bg-gray-50 dark:bg-[#030712]">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Contracts List */}
      <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-white/[0.01]">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contract ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client & Plan</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Billing Cycle</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Next Bill Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Payment</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              <AnimatePresence mode="popLayout">
                {filteredContracts.map((contract) => (
                  <motion.tr 
                    key={contract.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-50 dark:bg-white/[0.01] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono font-bold text-blue-400">{contract.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-400 transition-colors">{contract.client}</span>
                        <span className="text-xs text-slate-500 mt-0.5">{contract.plan}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm font-bold text-slate-900 dark:text-white">
                        <DollarSign size={14} className="text-emerald-500" />
                        {contract.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <RefreshCw size={12} className="text-slate-500" />
                        {contract.frequency}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <Calendar size={12} className="text-slate-500" />
                        {contract.nextBillingDate}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(contract.status)}`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${contract.lastPayment === 'Paid' ? 'bg-emerald-500' : contract.lastPayment === 'Overdue' ? 'bg-red-500' : 'bg-slate-500'}`} />
                        <span className={`text-xs font-medium ${getPaymentStatusColor(contract.lastPayment)}`}>{contract.lastPayment}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Renewal Alert */}
      <div className="p-6 bg-blue-600/5 border border-blue-500/20 rounded-2xl flex items-start gap-4">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <TrendingUp className="text-blue-400" size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Renewal Strategy Tip</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Your **Biometrics Support AMC** with **BDO Corporate Center** is up for renewal in 17 days. We've automatically created a renewal task for the account manager to ensure zero downtime in their door access system.
          </p>
        </div>
      </div>
    </div>
  );
}
