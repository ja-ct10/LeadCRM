'use client';

import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { CheckCircle2, XCircle, Building2, CreditCard, Receipt, FileText, X, LayoutDashboard, TrendingUp, Users, DollarSign, Activity, Zap, Server, Loader2, Plus, Trash2, Search, Download, Eye, UserX, CheckCircle, UserCheck, ChevronLeft, ChevronRight, ChevronDown, Database, AlertTriangle, Cpu, HardDrive } from 'lucide-react';
import { Tenant } from '../store/types';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, PieChart, Pie, Legend } from '../shared/components/charts/ChartComponents';
import { toast } from 'sonner';

const defaultPlans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 299,
    billingCycle: 'Monthly',
    usersLimit: '5',
    storage: '10GB',
    apiCalls: '10,000',
    features: [
      { id: 'f1', text: 'Basic Contact Tracking', enabled: true },
      { id: 'f2', text: 'Standard Support', enabled: true },
      { id: 'f3', text: 'Custom Workflows', enabled: false },
    ],
    paymentMethods: { stripe: true, bank: true, paypal: false },
    isPopular: false
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 799,
    billingCycle: 'Monthly',
    usersLimit: '20',
    storage: '50GB',
    apiCalls: '100,000',
    features: [
      { id: 'f1', text: 'Advanced Contact Tracking', enabled: true },
      { id: 'f2', text: 'Priority Support', enabled: true },
      { id: 'f3', text: 'Custom Workflows', enabled: true },
    ],
    paymentMethods: { stripe: true, bank: true, paypal: true },
    isPopular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 2499,
    billingCycle: 'Monthly',
    usersLimit: 'Unlimited',
    storage: '500GB',
    apiCalls: 'Unlimited',
    features: [
      { id: 'f1', text: 'Custom Contact Tracking', enabled: true },
      { id: 'f2', text: '24/7 Dedicated Support', enabled: true },
      { id: 'f3', text: 'Advanced Custom Workflows', enabled: true },
    ],
    paymentMethods: { stripe: true, bank: true, paypal: true },
    isPopular: false
  }
];

const MOCK_INVOICES = [
  { id: 'INV-2026-001', client: 'Acme Corporation', plan: 'Enterprise', amount: 199, date: '2026-03-15', method: 'Credit Card', status: 'paid' },
  { id: 'INV-2026-002', client: 'TechStart Inc', plan: 'Pro', amount: 79, date: '2026-03-20', method: 'PayPal', status: 'paid' },
  { id: 'INV-2026-003', client: 'Global Finance Ltd', plan: 'Enterprise', amount: 199, date: '2026-03-22', method: 'Bank Transfer', status: 'pending' },
  { id: 'INV-2026-004', client: 'HealthCare Plus', plan: 'Pro', amount: 79, date: '2026-03-25', method: 'Debit Card', status: 'paid' },
  { id: 'INV-2026-005', client: 'EduTech Solutions', plan: 'Basic', amount: 29, date: '2026-03-28', method: 'Credit Card', status: 'failed' },
  { id: 'INV-2026-006', client: 'Retail Masters', plan: 'Pro', amount: 79, date: '2026-04-01', method: 'Credit Card', status: 'paid' },
  { id: 'INV-2026-007', client: 'Marketing Solutions', plan: 'Basic', amount: 29, date: '2026-04-03', method: 'Debit Card', status: 'paid' },
  { id: 'INV-2026-008', client: 'Consulting Group', plan: 'Enterprise', amount: 199, date: '2026-04-05', method: 'Bank Transfer', status: 'pending' },
];

export default function AdminConsole({ activeTabProp }: { activeTabProp?: 'dashboard' | 'clients' | 'pricing' | 'billing' | 'environments' }) {
  const { tenants, approveTenant, rejectTenant, suspendTenant, updateTenant } = useData();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'pricing' | 'billing' | 'environments'>(activeTabProp || 'dashboard');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [billingSearchQuery, setBillingSearchQuery] = useState('');
  const [theme, setTheme] = useState<'Light' | 'Dark'>('Dark');

  useEffect(() => {
    const syncTheme = () => {
      const savedTheme = localStorage.getItem('app_theme');
      if (savedTheme === 'Light' || savedTheme === 'Dark') {
        setTheme(savedTheme as 'Light' | 'Dark');
      } else {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'Dark' : 'Light');
      }
    };

    syncTheme();
    window.addEventListener('themechange', syncTheme);
    return () => window.removeEventListener('themechange', syncTheme);
  }, []);

  const isDarkTheme = theme === 'Dark';

  const tooltipProps = {
    contentStyle: isDarkTheme ? {
      backgroundColor: '#0F172A',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      color: '#F8FAFC',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
    } : {
      backgroundColor: '#FFFFFF',
      borderColor: '#E2E8F0',
      color: '#0F172A',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
    },
    itemStyle: {
      color: isDarkTheme ? '#F8FAFC' : '#0F172A'
    }
  };

  useEffect(() => {
    if (activeTabProp) {
      setActiveTab(activeTabProp);
    }
  }, [activeTabProp]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'inactive' | 'rejected'>('all');
  const [planFilter, setPlanFilter] = useState<'all' | 'Basic' | 'Pro' | 'Enterprise'>('all');
  const [envFilter, setEnvFilter] = useState<'all' | 'production' | 'sandbox'>('all');
  const [envStatusFilter, setEnvStatusFilter] = useState<'all' | 'healthy' | 'warning' | 'critical'>('all');
  const [envSearchQuery, setEnvSearchQuery] = useState('');
  const [adminNote, setAdminNote] = useState('');

  // Pricing State
  const [pricingView, setPricingView] = useState<'Monthly' | 'Quarterly' | 'Annual'>('Monthly');
  const [plans, setPlans] = useState(defaultPlans);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.email.toLowerCase().includes(searchQuery.toLowerCase());
    const tStatus = t.status === 'suspended' ? 'inactive' : t.status;
    const matchesStatus = statusFilter === 'all' || tStatus === statusFilter;
    const tPlan = (t as any).plan || 'Basic';
    const matchesPlan = planFilter === 'all' || tPlan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const envData = tenants
    .filter(t => t.environment !== 'none')
    .flatMap(t => {
      if (t.environment === 'both') {
        return [
          { ...t, displayEnv: 'production' },
          { ...t, displayEnv: 'sandbox' }
        ];
      }
      return [{ ...t, displayEnv: t.environment }];
    });

  const filteredEnvData = envData.filter(t => {
    if (envFilter !== 'all' && t.displayEnv !== envFilter) return false;
    if (envStatusFilter !== 'all' && t.healthMetrics?.status !== envStatusFilter) return false;
    if (envSearchQuery && !t.name.toLowerCase().includes(envSearchQuery.toLowerCase()) && !`ENV-${t.displayEnv === 'production' ? 'PROD' : 'SAND'}-${t.id.split('_')[1] || '001'}`.toLowerCase().includes(envSearchQuery.toLowerCase())) return false;
    return true;
  });

  const healthyCount = envData.filter(t => t.healthMetrics?.status === 'healthy').length;
  const warningCount = envData.filter(t => t.healthMetrics?.status === 'warning').length;
  const criticalCount = envData.filter(t => t.healthMetrics?.status === 'critical').length;

  const revenueData = [
    { month: 'Jan', amount: 180000 },
    { month: 'Feb', amount: 195000 },
    { month: 'Mar', amount: 210000 },
    { month: 'Apr', amount: 225000 },
    { month: 'May', amount: 240000 },
    { month: 'Jun', amount: 248000 },
    { month: 'Jul', amount: 255000 },
    { month: 'Aug', amount: 265000 },
    { month: 'Sep', amount: 272000 },
    { month: 'Oct', amount: 280000 },
    { month: 'Nov', amount: 285000 },
    { month: 'Dec', amount: 290000 },
  ];

  const clientGrowthData = [
    { month: 'Jan', count: 140 },
    { month: 'Feb', count: 165 },
    { month: 'Mar', count: 155 },
    { month: 'Apr', count: 190 },
    { month: 'May', count: 195 },
    { month: 'Jun', count: 210 },
    { month: 'Jul', count: 230 },
    { month: 'Aug', count: 220 },
    { month: 'Sep', count: 235 },
    { month: 'Oct', count: 248 },
    { month: 'Nov', count: 240 },
    { month: 'Dec', count: 260 },
  ];

  const activeClientsData = [
    { month: 'Jan', count: 5800 },
    { month: 'Feb', count: 6000 },
    { month: 'Mar', count: 6150 },
    { month: 'Apr', count: 6300 },
    { month: 'May', count: 6500 },
    { month: 'Jun', count: 6700 },
    { month: 'Jul', count: 6900 },
    { month: 'Aug', count: 7050 },
    { month: 'Sep', count: 7150 },
    { month: 'Oct', count: 7200 },
    { month: 'Nov', count: 7250 },
    { month: 'Dec', count: 7300 },
  ];

  const churnData = [
    { month: 'Jan', new: 140, churned: 30 },
    { month: 'Feb', new: 165, churned: 32 },
    { month: 'Mar', new: 155, churned: 35 },
    { month: 'Apr', new: 190, churned: 33 },
    { month: 'May', new: 195, churned: 28 },
    { month: 'Jun', new: 210, churned: 30 },
    { month: 'Jul', new: 230, churned: 35 },
    { month: 'Aug', new: 220, churned: 38 },
    { month: 'Sep', new: 235, churned: 32 },
    { month: 'Oct', new: 248, churned: 34 },
    { month: 'Nov', new: 240, churned: 30 },
    { month: 'Dec', new: 260, churned: 28 },
  ];

  const planDistribution = [
    { name: 'Basic', value: 31, amount: '$89,500', color: '#3B82F6' },
    { name: 'Pro', value: 50, amount: '$142,800', color: '#10B981' },
    { name: 'Enterprise', value: 19, amount: '$52,290', color: '#F59E0B' },
  ];

  const paymentStatus = [
    { name: 'Paid', value: 95, clients: '1186 clients', color: '#3B82F6' },
    { name: 'Pending', value: 3, clients: '38 clients', color: '#10B981' },
    { name: 'Failed', value: 2, clients: '24 clients', color: '#F59E0B' },
  ];

  const handleSavePlan = () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setTimeout(() => {
      setPlans(plans.map(p => p.id === editingPlan.id ? editingPlan : p));
      setIsSaving(false);
      setSaveStatus('success');
      setTimeout(() => {
        setEditingPlan(null);
        setSaveStatus('idle');
      }, 1000);
    }, 1500);
  };

  const getDisplayPrice = (basePrice: number) => {
    if (pricingView === 'Monthly') return basePrice;
    if (pricingView === 'Quarterly') return Math.round(basePrice * 3 * 0.9); // 10% discount
    if (pricingView === 'Annual') return Math.round(basePrice * 12 * 0.8); // 20% discount
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Platform overview and key metrics</p>
        </div>
        <div className="relative">
            <select className="appearance-none bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 cursor-pointer">
              <option>Last 12 months</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* MRR */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
              <DollarSign size={20} />
            </div>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              <TrendingUp size={12} /> +12.5%
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Monthly Recurring Revenue</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">$284,590</h3>
            <p className="text-[10px] text-slate-400 mt-1">Total MRR</p>
          </div>
        </div>

        {/* Total Clients */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
              <Users size={20} />
            </div>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              <TrendingUp size={12} /> +8.3%
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Total Clients</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">8,429</h3>
            <p className="text-[10px] text-slate-400 mt-1">All registered clients</p>
          </div>
        </div>

        {/* Active Clients */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
              <UserCheck size={20} />
            </div>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              <TrendingUp size={12} /> +5.7%
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Active Clients</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">7,248</h3>
            <p className="text-[10px] text-slate-400 mt-1">Currently active</p>
          </div>
        </div>

        {/* Churn Rate */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
              <UserX size={20} />
            </div>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              <TrendingUp size={12} /> -0.8%
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Churn Rate</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">2.4%</h3>
            <p className="text-[10px] text-slate-400 mt-1">Monthly churn</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Growth */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue Growth (MRR)</h3>
            <p className="text-sm text-slate-500 mt-1">Monthly recurring revenue over time</p>
          </div>
          <div className="h-[300px] w-full relative min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={revenueData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} ticks={[0, 75000, 150000, 225000, 300000]} />
                <Tooltip {...tooltipProps} formatter={(value: number) => [`$${value.toLocaleString()}`, 'MRR']} />
                <Line type="monotone" dataKey="amount" stroke="none" dot={{ r: 4, fill: '#0f172a', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#0f172a' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* New Signups */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">New Signups</h3>
            <p className="text-sm text-slate-500 mt-1">Client registrations over time</p>
          </div>
          <div className="h-[300px] w-full relative min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={clientGrowthData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} ticks={[0, 65, 130, 195, 260]} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#10B981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Clients */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Active Clients</h3>
            <p className="text-sm text-slate-500 mt-1">Currently active clients over time</p>
          </div>
          <div className="h-[300px] w-full relative min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={activeClientsData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} ticks={[0, 2000, 4000, 6000, 8000]} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#3B82F6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* New vs Churned */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">New vs Churned Clients</h3>
            <p className="text-sm text-slate-500 mt-1">Client acquisition and churn comparison</p>
          </div>
          <div className="h-[300px] w-full relative min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={churnData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} ticks={[0, 65, 130, 195, 260]} />
                <Tooltip {...tooltipProps} cursor={{ fill: isDarkTheme ? '#1e293b' : '#f1f5f9' }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="new" name="New Clients" fill="#10B981" radius={[2, 2, 0, 0]} barSize={12} />
                <Bar dataKey="churned" name="Churned Clients" fill="#EF4444" radius={[2, 2, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Plan */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue by Plan</h3>
            <p className="text-sm text-slate-500 mt-1">Distribution across pricing tiers</p>
          </div>
          <div className="h-[250px] w-full flex-1 relative min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                  labelLine={true}
                >
                  {planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip {...tooltipProps} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {planDistribution.map((item) => (
              <div key={item.name} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">{item.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Status */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Payment Status</h3>
            <p className="text-sm text-slate-500 mt-1">Current payment statuses</p>
          </div>
          <div className="h-[250px] w-full flex-1 relative min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={paymentStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                  labelLine={true}
                >
                  {paymentStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip {...tooltipProps} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {paymentStatus.map((item) => (
              <div key={item.name} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">{item.clients}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPricing = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pricing</h3>
          <p className="text-sm text-slate-500">Manage subscription tiers and features</p>
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 dark:bg-amber-500/10 inline-block px-2 py-1 rounded border border-amber-200 dark:border-amber-500/20">
            Note: Maximum of 3 active plans supported. Crypto payments currently unsupported.
          </p>
        </div>
        <div className="flex bg-slate-200 dark:bg-slate-700/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          {(['Monthly', 'Quarterly', 'Annual'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setPricingView(view)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pricingView === view 
                  ? 'bg-white dark:bg-[#0B1120] text-blue-600 shadow-sm border border-slate-200 dark:border-slate-700/50' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className={`relative bg-white dark:bg-[#0B1120] border rounded-2xl p-6 flex flex-col transition-shadow hover:shadow-md ${plan.isPopular ? 'border-blue-500 shadow-blue-500/10 shadow-lg' : 'border-slate-200 dark:border-slate-700'}`}>
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-sm">
                Most Popular
              </div>
            )}
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h4>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4">
              ${getDisplayPrice(plan.price)}
              <span className="text-sm font-normal text-slate-500"> / {pricingView.toLowerCase()}</span>
            </div>
            
            <div className="space-y-3 mb-8 flex-1">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Users size={16} className="text-slate-500 dark:text-slate-400" /> {plan.usersLimit} Users
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Server size={16} className="text-slate-500 dark:text-slate-400" /> {plan.storage} Storage
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wider">Features</p>
                {plan.features.slice(0, 3).map(f => (
                  <div key={f.id} className="flex items-start gap-2 mb-2">
                    <CheckCircle2 size={16} className={f.enabled ? "text-blue-500 shrink-0" : "text-slate-700 dark:text-slate-300 dark:text-slate-300 shrink-0"} />
                    <span className={`text-sm ${f.enabled ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400 line-through'}`}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => setEditingPlan(JSON.parse(JSON.stringify(plan)))}
              className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                plan.isPopular 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white'
              }`}
            >
              Edit Plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEditPlanDrawer = () => {
    if (!editingPlan) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex justify-end">
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-white dark:bg-[#0B1120] w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700"
        >
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit {editingPlan.name} Plan</h3>
            <button onClick={() => setEditingPlan(null)} className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Basic Details</h4>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan Name</label>
                <input 
                  type="text" 
                  value={editingPlan.name}
                  onChange={e => setEditingPlan({...editingPlan, name: e.target.value})}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monthly Price ($)</label>
                  <input 
                    type="number" 
                    value={editingPlan.price}
                    onChange={e => setEditingPlan({...editingPlan, price: Number(e.target.value)})}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Limits */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Plan Limits</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Users Limit</label>
                  <input 
                    type="text" 
                    value={editingPlan.usersLimit}
                    onChange={e => setEditingPlan({...editingPlan, usersLimit: e.target.value})}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Storage</label>
                  <input 
                    type="text" 
                    value={editingPlan.storage}
                    onChange={e => setEditingPlan({...editingPlan, storage: e.target.value})}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Features</h4>
                <button 
                  onClick={() => setEditingPlan({...editingPlan, features: [...editingPlan.features, { id: Date.now().toString(), text: 'New Feature', enabled: true }]})}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Plus size={14} /> Add Feature
                </button>
              </div>
              <div className="space-y-2">
                {editingPlan.features.map((feature: any, index: number) => (
                  <div key={feature.id} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={feature.enabled}
                      onChange={e => {
                        const newFeatures = [...editingPlan.features];
                        newFeatures[index].enabled = e.target.checked;
                        setEditingPlan({...editingPlan, features: newFeatures});
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                    />
                    <input 
                      type="text"
                      value={feature.text}
                      onChange={e => {
                        const newFeatures = [...editingPlan.features];
                        newFeatures[index].text = e.target.value;
                        setEditingPlan({...editingPlan, features: newFeatures});
                      }}
                      className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button 
                      onClick={() => {
                        const newFeatures = editingPlan.features.filter((_: any, i: number) => i !== index);
                        setEditingPlan({...editingPlan, features: newFeatures});
                      }}
                      className="text-slate-500 dark:text-slate-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Payment Methods</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editingPlan.paymentMethods.stripe}
                    onChange={e => setEditingPlan({...editingPlan, paymentMethods: {...editingPlan.paymentMethods, stripe: e.target.checked}})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Credit Card (Stripe)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editingPlan.paymentMethods.bank}
                    onChange={e => setEditingPlan({...editingPlan, paymentMethods: {...editingPlan.paymentMethods, bank: e.target.checked}})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Bank Transfer</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editingPlan.paymentMethods.paypal}
                    onChange={e => setEditingPlan({...editingPlan, paymentMethods: {...editingPlan.paymentMethods, paypal: e.target.checked}})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">PayPal</span>
                </label>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
            <button 
              onClick={() => setEditingPlan(null)}
              className="flex-1 px-4 py-2 bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSavePlan}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : 
               saveStatus === 'success' ? <CheckCircle2 size={16} /> : 
               'Save Changes'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const handleDownloadInvoice = (id: string) => {
    toast.success(`Downloading invoice ${id}...`);
  };

  const renderTenantDetailsModal = () => {
    if (!selectedTenant) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-[#0B1120] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Client Details</h3>
            <button onClick={() => setSelectedTenant(null)} className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Company Information</h4>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500">Name</div>
                    <div className="font-medium text-slate-900 dark:text-white">{selectedTenant.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Industry</div>
                    <div className="font-medium text-slate-900 dark:text-white">{selectedTenant.industry}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Size</div>
                    <div className="font-medium text-slate-900 dark:text-white">{selectedTenant.size}</div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Contact Details</h4>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500">Email</div>
                    <div className="font-medium text-slate-900 dark:text-white">{selectedTenant.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Phone</div>
                    <div className="font-medium text-slate-900 dark:text-white">{selectedTenant.phone}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Address</div>
                    <div className="font-medium text-slate-900 dark:text-white">{selectedTenant.address}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-slate-100 dark:border-slate-850 dark:border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">System Status</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500 mb-1">Status</div>
                  <div className="font-medium capitalize text-slate-900 dark:text-white">{selectedTenant.status}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500 mb-1">Environment</div>
                  <div className="font-medium capitalize text-slate-900 dark:text-white">{selectedTenant.environment}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500 mb-1">Created</div>
                  <div className="font-medium text-slate-900 dark:text-white">{new Date(selectedTenant.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
            <button 
              onClick={() => setSelectedTenant(null)}
              className="px-4 py-2 bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              Close
            </button>
            {selectedTenant.status === 'pending' && (
              <button 
                onClick={() => {
                  approveTenant(selectedTenant.id);
                  setSelectedTenant(null);
                  toast.success('Tenant approved successfully');
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors"
              >
                Approve Client
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  const renderInvoiceModal = () => {
    if (!selectedInvoice) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-[#0B1120] rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Invoice Details</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Complete information for {selectedInvoice.id}</p>
            </div>
            <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">LeadCRM</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Invoice {selectedInvoice.id}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                selectedInvoice.status === 'paid' ? 'bg-emerald-500 text-white' : 
                selectedInvoice.status === 'pending' ? 'bg-amber-500 text-white' : 
                'bg-red-500 text-white'
              }`}>
                {selectedInvoice.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Bill To</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedInvoice.client}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Invoice Date</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedInvoice.date}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Payment Method</p>
                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                  {selectedInvoice.method.includes('Card') ? <CreditCard size={16} className="text-slate-500" /> : <Building2 size={16} className="text-slate-500" />}
                  {selectedInvoice.method}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Plan</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedInvoice.plan}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                <span>{selectedInvoice.plan} Plan - Monthly Subscription</span>
                <span>${selectedInvoice.amount}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-4 border-t border-slate-100 dark:border-slate-800">
                <span>Total</span>
                <span>${selectedInvoice.amount}</span>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-end gap-3">
            <button 
              onClick={() => setSelectedInvoice(null)}
              className="px-4 py-2 bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button 
              onClick={() => {
                handleDownloadInvoice(selectedInvoice.id);
                setSelectedInvoice(null);
              }}
              className="px-4 py-2 bg-[#0B1120] dark:bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download size={16} /> Download PDF
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const filteredInvoices = MOCK_INVOICES.filter(inv => {
    if (!billingSearchQuery) return true;
    const query = billingSearchQuery.toLowerCase();
    return inv.client.toLowerCase().includes(query) || 
           inv.plan.toLowerCase().includes(query) || 
           inv.id.toLowerCase().includes(query);
  });

  const renderBilling = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Billing</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage invoices and payment history</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm text-slate-500 dark:text-slate-400 mb-4">Total Revenue (This Month)</h3>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-4">$465</div>
          <div className="text-sm text-emerald-600 dark:text-emerald-400">5 paid invoices</div>
        </div>
        <div className="bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm text-slate-500 dark:text-slate-400 mb-4">Pending Revenue</h3>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-4">$398</div>
          <div className="text-sm text-amber-600 dark:text-amber-400">2 pending invoices</div>
        </div>
        <div className="bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm text-slate-500 dark:text-slate-400 mb-4">Failed Payments</h3>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-4">1</div>
          <div className="text-sm text-red-600 dark:text-red-400">Requires attention</div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="relative max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search invoices by client, plan, or invoice number..." 
              value={billingSearchQuery}
              onChange={(e) => setBillingSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold">Invoice #</th>
                <th className="px-6 py-4 font-semibold">Client</th>
                <th className="px-6 py-4 font-semibold">Plan</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Payment Method</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
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
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      inv.status === 'paid' ? 'bg-emerald-500 text-white' : 
                      inv.status === 'pending' ? 'bg-amber-500 text-white' : 
                      'bg-red-500 text-white'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => setSelectedInvoice(inv)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" title="View Details">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleDownloadInvoice(inv.id)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" title="Download PDF">
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No invoices found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500">
          <span>Showing {filteredInvoices.length} of {MOCK_INVOICES.length} invoices</span>
          <div className="flex items-center gap-2">
            <button className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50" disabled>
              <ChevronLeft size={16} />
            </button>
            <span className="px-2">Page 1 of 1</span>
            <button className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50" disabled>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="text-slate-900 dark:text-white min-h-[calc(100vh-8rem)] flex flex-col">
      <AnimatePresence>
        {renderEditPlanDrawer()}
        {renderTenantDetailsModal()}
        {renderInvoiceModal()}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1">
        {activeTab === 'dashboard' && renderDashboard()}

        {activeTab === 'clients' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Client Management</h1>
              <p className="text-sm text-slate-500 mt-1">Manage and monitor all client accounts</p>
            </div>

            <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 transition-all"
                />
              </div>
              <div className="flex gap-4">
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="appearance-none bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 cursor-pointer min-w-[160px]"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as any)}
                    className="appearance-none bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 cursor-pointer min-w-[160px]"
                  >
                    <option value="all">All Plans</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Pro">Pro</option>
                    <option value="Basic">Basic</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                  <thead className="bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Company Name</th>
                      <th className="px-6 py-4 font-semibold">Industry</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Plan</th>
                      <th className="px-6 py-4 font-semibold">Created Date</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTenants.length > 0 ? filteredTenants.map(t => {
                      const tStatus = t.status === 'suspended' ? 'inactive' : t.status;
                      const tPlan = (t as any).plan || 'Basic';
                      return (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900 dark:text-white">{t.name}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {t.industry || 'Technology'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize
                            ${tStatus === 'active' ? 'bg-emerald-500 text-white' : 
                              tStatus === 'pending' ? 'bg-amber-500 text-white' : 
                              'bg-slate-500 text-white'}`}>
                            {tStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                          {tPlan}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(t.createdAt).toISOString().split('T')[0]}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-3">
                            <button 
                              onClick={() => setSelectedTenant(t)}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Eye size={16} /> View
                            </button>
                            {tStatus === 'active' ? (
                              <button 
                                onClick={() => suspendTenant(t.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500 dark:border-red-500/50 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <UserX size={16} /> Deactivate
                              </button>
                            ) : tStatus === 'pending' ? (
                              <button 
                                onClick={() => setSelectedTenant(t)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-500 dark:border-blue-500/50 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              >
                                <CheckCircle size={16} /> Review
                              </button>
                            ) : (
                              <button 
                                onClick={() => approveTenant(t.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500 dark:border-emerald-500/50 rounded-lg text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                              >
                                <UserCheck size={16} /> Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          No clients found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500">
                <div>
                  Showing {filteredTenants.length} of {tenants.length} clients
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled>
                    <ChevronLeft size={16} />
                  </button>
                  <span>Page 1 of 1</span>
                  <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pricing' && renderPricing()}

        {activeTab === 'billing' && renderBilling()}

        {activeTab === 'environments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Environment Health</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time monitoring of client environments</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Live</span>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Environments</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{envData.length}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <Database className="text-slate-600 dark:text-slate-400" size={24} />
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">Healthy</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{healthyCount}</p>
                </div>
                <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={24} />
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">Warning</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{warningCount}</p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={24} />
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 dark:text-red-400 mb-1">Critical</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{criticalCount}</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-500/20 rounded-lg text-red-600 dark:text-red-400">
                  <XCircle size={24} />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by client name or environment ID..." 
                  value={envSearchQuery}
                  onChange={(e) => setEnvSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-4">
                <select 
                  value={envFilter}
                  onChange={(e) => setEnvFilter(e.target.value as any)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
                >
                  <option value="all">All Environments</option>
                  <option value="production">Production</option>
                  <option value="sandbox">Sandbox</option>
                </select>
                <select 
                  value={envStatusFilter}
                  onChange={(e) => setEnvStatusFilter(e.target.value as any)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
                >
                  <option value="all">All Status</option>
                  <option value="healthy">Healthy</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEnvData.map((env, i) => (
                <div key={`${env.id}-${env.displayEnv}-${i}`} className="bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{env.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">ENV-{env.displayEnv === 'production' ? 'PROD' : 'SAND'}-{env.id.split('_')[1] || '001'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${env.displayEnv === 'production' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'}`}>
                          {env.displayEnv}
                        </span>
                        {env.healthMetrics?.status === 'healthy' && <CheckCircle2 size={18} className="text-emerald-500" />}
                        {env.healthMetrics?.status === 'warning' && <AlertTriangle size={18} className="text-amber-500" />}
                        {env.healthMetrics?.status === 'critical' && <XCircle size={18} className="text-red-500" />}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 space-y-4 flex-grow">
                    {/* CPU */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <Cpu size={14} />
                          <span className="text-xs font-medium">CPU</span>
                        </div>
                        <span className={`text-xs font-bold ${env.healthMetrics?.cpuUsage && env.healthMetrics.cpuUsage > 90 ? 'text-red-500' : env.healthMetrics?.cpuUsage && env.healthMetrics.cpuUsage > 70 ? 'text-amber-500' : 'text-emerald-500'}`}>{env.healthMetrics?.cpuUsage || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${env.healthMetrics?.cpuUsage || 0}%` }}
                          className={`h-full ${env.healthMetrics?.cpuUsage && env.healthMetrics.cpuUsage > 90 ? 'bg-red-500' : env.healthMetrics?.cpuUsage && env.healthMetrics.cpuUsage > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                    </div>

                    {/* RAM */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <Activity size={14} />
                          <span className="text-xs font-medium">RAM</span>
                        </div>
                        <span className={`text-xs font-bold ${env.healthMetrics?.memoryUsage && env.healthMetrics.memoryUsage > 90 ? 'text-red-500' : env.healthMetrics?.memoryUsage && env.healthMetrics.memoryUsage > 70 ? 'text-amber-500' : 'text-emerald-500'}`}>{env.healthMetrics?.memoryUsage || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${env.healthMetrics?.memoryUsage || 0}%` }}
                          className={`h-full ${env.healthMetrics?.memoryUsage && env.healthMetrics.memoryUsage > 90 ? 'bg-red-500' : env.healthMetrics?.memoryUsage && env.healthMetrics.memoryUsage > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                    </div>

                    {/* Storage */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <HardDrive size={14} />
                          <span className="text-xs font-medium">Storage</span>
                        </div>
                        <span className={`text-xs font-bold ${env.healthMetrics?.storageUsage && env.healthMetrics.storageUsage > 90 ? 'text-red-500' : env.healthMetrics?.storageUsage && env.healthMetrics.storageUsage > 70 ? 'text-amber-500' : 'text-emerald-500'}`}>{env.healthMetrics?.storageUsage || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${env.healthMetrics?.storageUsage || 0}%` }}
                          className={`h-full ${env.healthMetrics?.storageUsage && env.healthMetrics.storageUsage > 90 ? 'bg-red-500' : env.healthMetrics?.storageUsage && env.healthMetrics.storageUsage > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800/50 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                    <span>Uptime: <span className="font-semibold text-slate-700 dark:text-slate-300">{env.healthMetrics?.uptime || '99.9%'}</span></span>
                    <span>{env.healthMetrics?.lastCheck ? new Date(env.healthMetrics.lastCheck).toLocaleTimeString() : 'Just now'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
              <span>Monitoring {filteredEnvData.length} client environments</span>
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
