'use client';

import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  Shield,
  ShieldCheck,
  Zap,
  PhoneCall,
  UserCheck,
  Globe,
  Server,
  Lock,
  ArrowRight,
  TrendingUp,
  Layers,
  Users,
  Database,
  Radio,
  FileCheck,
  Check,
  Info,
  Calendar,
  AlertCircle,
  HelpCircle,
  Clock,
  ExternalLink,
  Download,
  X,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BillingCycle = 'monthly' | 'annually';

export type PlanTierId = 'starter' | 'professional' | 'scale';

export interface PlanFeature {
  text: string;
  highlight?: boolean;
  tooltip?: string;
}

export interface PlanTier {
  id: PlanTierId;
  name: string;
  badge?: string;
  tagline: string;
  monthlyPrice: number;
  annualMonthlyEquivalent: number;
  popular?: boolean;
  current?: boolean;
  seatsLabel: string;
  contactsLimit: string;
  features: PlanFeature[];
}

export interface AddonItem {
  id: string;
  name: string;
  category: 'Telephony & Media' | 'Advisory & Support' | 'Branding & Domain' | 'Infrastructure' | 'Compliance & Security';
  description: string;
  monthlyPrice: number;
  annualMonthlyEquivalent: number;
  icon: LucideIcon;
  badge?: string;
}

// ── Constants & Configuration ─────────────────────────────────────────────────

export const PLAN_TIERS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Essential CRM pipelines and lead capture for fast-moving sales reps.',
    monthlyPrice: 29,
    annualMonthlyEquivalent: 24,
    seatsLabel: 'Up to 3 team members',
    contactsLimit: '5,000 Contacts & Leads',
    features: [
      { text: '3 Sales Pipelines & Visual Deal Boards' },
      { text: '5,000 Active Contacts & Accounts' },
      { text: 'Custom Contact & Deal Fields (Up to 20)' },
      { text: 'Email & SMS Broadcast Sequences' },
      { text: 'Standard Webhooks & REST API Access' },
      { text: 'Community & Email Support (24h response)' },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    badge: 'Most Popular',
    popular: true,
    current: true,
    tagline: 'Advanced automation workflows, calling, and multi-pipeline scale for growing revenue teams.',
    monthlyPrice: 79,
    annualMonthlyEquivalent: 64,
    seatsLabel: 'Up to 10 team members',
    contactsLimit: '25,000 Contacts & Leads',
    features: [
      { text: 'Unlimited Sales & Onboarding Pipelines', highlight: true },
      { text: '25,000 Active Contacts & Accounts' },
      { text: 'Visual Automation Workflow Builder', highlight: true },
      { text: 'Integrated VoIP Call Dialing & Call Logging', highlight: true },
      { text: 'Dynamic Lead Scoring & Deal Health Indicators' },
      { text: 'Role-Based Access Control (RBAC) & Team Permissions' },
      { text: 'Priority Chat & Email Support (4h SLA)' },
    ],
  },
  {
    id: 'scale',
    name: 'Scale & Enterprise',
    badge: 'Enterprise Grade',
    tagline: 'High-velocity infrastructure, multi-entity controls, and institutional security.',
    monthlyPrice: 199,
    annualMonthlyEquivalent: 159,
    seatsLabel: 'Unlimited seats (First 25 included)',
    contactsLimit: '100,000+ Contacts & Leads',
    features: [
      { text: 'Everything in Professional, plus:', highlight: true },
      { text: '100,000+ Contacts & Unlimited Deal Archives' },
      { text: 'Multi-Brand & Multi-Entity Workspace Isolation' },
      { text: 'Advanced SLA Escalations & Round-Robin Routing', highlight: true },
      { text: 'High-Concurrency VoIP Dialing & Caller ID Pools' },
      { text: 'SAML / Okta SSO & Enforced 2FA Policies', highlight: true },
      { text: 'Custom Contract & Dedicated Customer Success Manager' },
    ],
  },
];

export const ADDONS_LIST: AddonItem[] = [
  {
    id: 'call-retention',
    name: 'Call Recording Retention (90 Days)',
    category: 'Telephony & Media',
    description: 'Compliant high-fidelity audio retention, searchable call logs, and extended waveform storage.',
    monthlyPrice: 35,
    annualMonthlyEquivalent: 28,
    icon: PhoneCall,
    badge: 'Popular',
  },
  {
    id: 'dedicated-manager',
    name: 'Dedicated Account Manager & Priority SLA',
    category: 'Advisory & Support',
    description: 'Direct Slack connect channel, monthly revenue funnel reviews, and guaranteed 1-hour critical response.',
    monthlyPrice: 150,
    annualMonthlyEquivalent: 120,
    icon: UserCheck,
    badge: 'VIP Service',
  },
  {
    id: 'custom-domain',
    name: 'Custom Domain & White-Label Client Portal',
    category: 'Branding & Domain',
    description: 'Host forms, client dashboards, and invoices on your branded CNAME with custom SSL and DKIM signatures.',
    monthlyPrice: 49,
    annualMonthlyEquivalent: 39,
    icon: Globe,
  },
  {
    id: 'dedicated-ip-pool',
    name: 'Dedicated IP & Outbound Telephony Pool',
    category: 'Infrastructure',
    description: 'Clean isolated IP pool for 99.8% email sequence deliverability plus 5 reserved local dialer numbers.',
    monthlyPrice: 65,
    annualMonthlyEquivalent: 52,
    icon: Server,
  },
  {
    id: 'audit-compliance',
    name: 'Immutable Audit Logs & SOC2 Compliance Vault',
    category: 'Compliance & Security',
    description: '1-year tamper-proof activity ledger, comprehensive change diffs, IP allowlisting, and automated compliance exports.',
    monthlyPrice: 89,
    annualMonthlyEquivalent: 71,
    icon: Lock,
  },
];

// ── Main Component ────────────────────────────────────────────────────────────

export function PlanUsageTab(): React.ReactElement {
  const { tenant } = useAuth();
  const { contacts, users, pipelines, workflows, deals, organizations } = useData();

  // State Management
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annually');
  const [selectedPlan, setSelectedPlan] = useState<PlanTierId>('professional');
  const [selectedAddons, setSelectedAddons] = useState<string[]>(['call-retention']);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [lastOrderPayload, setLastOrderPayload] = useState<any>(null);

  // Active Plan reference
  const selectedTier = useMemo(() => {
    return PLAN_TIERS.find((p) => p.id === selectedPlan) || PLAN_TIERS[1];
  }, [selectedPlan]);

  // Selected Addons reference
  const activeAddonsList = useMemo(() => {
    return ADDONS_LIST.filter((addon) => selectedAddons.includes(addon.id));
  }, [selectedAddons]);

  // Financial Calculations
  const calculations = useMemo(() => {
    const isAnnual = billingCycle === 'annually';

    // Monthly rates calculation
    const baseMonthlyPrice = isAnnual ? selectedTier.annualMonthlyEquivalent : selectedTier.monthlyPrice;
    const baseAnnualPrice = selectedTier.annualMonthlyEquivalent * 12;

    const addonsMonthlyPrice = activeAddonsList.reduce(
      (acc, addon) => acc + (isAnnual ? addon.annualMonthlyEquivalent : addon.monthlyPrice),
      0
    );
    const addonsAnnualPrice = activeAddonsList.reduce(
      (acc, addon) => acc + addon.annualMonthlyEquivalent * 12,
      0
    );

    // Monthly equivalent shown to user
    const totalMonthlyEquivalent = baseMonthlyPrice + addonsMonthlyPrice;

    // Total Due Today calculation
    const totalDueToday = isAnnual ? baseAnnualPrice + addonsAnnualPrice : totalMonthlyEquivalent;

    // What it would cost for 12 months at standard monthly rates
    const unadjusted12MonthTotal =
      (selectedTier.monthlyPrice + activeAddonsList.reduce((acc, a) => acc + a.monthlyPrice, 0)) * 12;
    const annualSavings = isAnnual ? Math.max(0, unadjusted12MonthTotal - (baseAnnualPrice + addonsAnnualPrice)) : 0;
    const savingsPercent = isAnnual && unadjusted12MonthTotal > 0 ? Math.round((annualSavings / unadjusted12MonthTotal) * 100) : 0;

    return {
      isAnnual,
      baseMonthlyPrice,
      baseAnnualPrice,
      addonsMonthlyPrice,
      addonsAnnualPrice,
      totalMonthlyEquivalent,
      totalDueToday,
      unadjusted12MonthTotal,
      annualSavings,
      savingsPercent: savingsPercent || 20,
    };
  }, [billingCycle, selectedTier, activeAddonsList]);

  // Toggle addon handler
  const handleToggleAddon = (addonId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  // Checkout submission handler
  const handleProceedToPayment = () => {
    setIsProcessing(true);

    const payload = {
      event: 'leadcrm_subscription_checkout',
      timestamp: new Date().toISOString(),
      tenant: {
        id: tenant?.id || 'tenant_prod_894',
        name: tenant?.name || 'LeadCRM Enterprise Workspace',
      },
      order: {
        billingCycle,
        selectedTier: {
          id: selectedTier.id,
          name: selectedTier.name,
          monthlyEquivalent: calculations.baseMonthlyPrice,
          annualTotal: calculations.baseAnnualPrice,
        },
        selectedAddons: activeAddonsList.map((addon) => ({
          id: addon.id,
          name: addon.name,
          category: addon.category,
          pricePerMonth: calculations.isAnnual ? addon.annualMonthlyEquivalent : addon.monthlyPrice,
          annualAmount: calculations.isAnnual ? addon.annualMonthlyEquivalent * 12 : undefined,
        })),
        pricingSummary: {
          currency: 'USD',
          billingCadence: billingCycle === 'annually' ? 'Annual (Prepaid 1 Year)' : 'Monthly Recurring',
          totalMonthlyEquivalent: calculations.totalMonthlyEquivalent,
          annualDiscountSavings: calculations.annualSavings,
          totalDueToday: calculations.totalDueToday,
        },
      },
    };

    console.log('[LeadCRM Checkout] Processed Payment Payload:', payload);
    setLastOrderPayload(payload);

    setTimeout(() => {
      setIsProcessing(false);
      setShowReceiptModal(true);
      toast.success('Subscription plan updated successfully!', {
        description: `${selectedTier.name} plan with ${activeAddonsList.length} add-on(s) configured (${billingCycle}).`,
      });
    }, 600);
  };

  // Active usage calculations from real context
  const activeContactsCount = (contacts?.filter((c) => !c.isArchived)?.length || 0) + (organizations?.filter((o) => !o.isArchived)?.length || 0);
  const activeUsersCount = users?.filter((u) => !u.isArchived)?.length || 1;
  const activePipelinesCount = pipelines?.filter((p) => !p.isArchived)?.length || 1;
  const activeAutomationsCount = workflows?.filter((w) => !w.isArchived)?.length || 0;
  const activeDealsCount = deals?.filter((d) => !d.isArchived)?.length || 0;
  const currentPlanName = (tenant as any)?.subscriptionPlan || 'Professional';

  const contactsMax = selectedPlan === 'starter' ? 5000 : selectedPlan === 'professional' ? 25000 : 100000;
  const usersMax = selectedPlan === 'starter' ? 3 : selectedPlan === 'professional' ? 10 : 25;
  const workflowsMax = selectedPlan === 'starter' ? 5 : selectedPlan === 'professional' ? 25 : 100;

  const contactsPct = Math.min(100, Math.round((activeContactsCount / contactsMax) * 100));
  const usersPct = Math.min(100, Math.round((activeUsersCount / usersMax) * 100));
  const workflowsPct = Math.min(100, Math.round((activeAutomationsCount / workflowsMax) * 100));

  return (
    <div className="w-full space-y-8 pb-12">
      {/* ── Section 1: Active Workspace Quota & Header ────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-gradient-to-b from-white to-slate-50/50 dark:from-[#1A222D] dark:to-[#141B24] p-6 lg:p-8 shadow-xl shadow-slate-200/40 dark:shadow-black/30 backdrop-blur-xl">
        {/* Glow decoration */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Subscription
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Workspace: {tenant?.name || 'LeadCRM Workspace'}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Plan & Resource Utilization
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Scale your CRM capabilities seamlessly. Select your base plan, attach infrastructure add-ons, and observe real-time dynamic pricing.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-[#202B37]/80 px-4 py-3 shadow-sm backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Current Tier
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white">{currentPlanName}</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">({billingCycle === 'annually' ? 'Annual' : 'Monthly'})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Resource Meters */}
        <div className="relative z-10 mt-8 pt-6 border-t border-slate-200/80 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Contacts Meter */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.05] bg-white/60 dark:bg-[#1E2630]/60 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Database className="w-3.5 h-3.5 text-blue-500" /> Contacts & Accounts
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {activeContactsCount.toLocaleString()} / {contactsMax.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${contactsPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">{contactsPct}% quota utilized</p>
          </div>

          {/* Pipelines Meter */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.05] bg-white/60 dark:bg-[#1E2630]/60 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Layers className="w-3.5 h-3.5 text-emerald-500" /> Active Pipelines
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {activePipelinesCount} {selectedPlan === 'starter' ? '/ 3' : '/ Unlimited'}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/60 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: selectedPlan === 'starter' ? `${Math.min(100, (activePipelinesCount / 3) * 100)}%` : '35%' }} />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">{activeDealsCount} active deals in pipeline</p>
          </div>

          {/* Automations Meter */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.05] bg-white/60 dark:bg-[#1E2630]/60 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Active Workflows
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {activeAutomationsCount} / {workflowsMax}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
                style={{ width: `${workflowsPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">{workflowsPct}% quota utilized</p>
          </div>

          {/* Seats Meter */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.05] bg-white/60 dark:bg-[#1E2630]/60 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Users className="w-3.5 h-3.5 text-purple-500" /> Team Seats
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {activeUsersCount} / {usersMax}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${usersPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">{Math.max(0, usersMax - activeUsersCount)} seat slots remaining</p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Billing Cycle Switcher ──────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="inline-flex items-center p-1.5 rounded-full border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#1B232D]/90 shadow-lg shadow-slate-200/50 dark:shadow-black/40 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'relative px-5 py-2 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer',
              billingCycle === 'monthly'
                ? 'text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            {billingCycle === 'monthly' && (
              <motion.div
                layoutId="activeCyclePill"
                className="absolute inset-0 rounded-full bg-slate-100 dark:bg-white/[0.12] border border-slate-200/60 dark:border-white/[0.1]"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">Monthly Billing</span>
          </button>

          <button
            type="button"
            onClick={() => setBillingCycle('annually')}
            className={cn(
              'relative px-5 py-2 text-xs font-bold rounded-full transition-all duration-300 flex items-center gap-2 cursor-pointer',
              billingCycle === 'annually'
                ? 'text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            {billingCycle === 'annually' && (
              <motion.div
                layoutId="activeCyclePill"
                className="absolute inset-0 rounded-full bg-slate-100 dark:bg-white/[0.12] border border-slate-200/60 dark:border-white/[0.1]"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-10">Annual Billing</span>
            <span className="relative z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              Save up to 20%
            </span>
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {billingCycle === 'annually'
            ? '✨ Annual plan locks in a 20% discount and is billed in one upfront payment.'
            : '🔄 Flexible month-to-month contract. Switch or cancel anytime.'}
        </p>
      </div>

      {/* ── Section 3: Main Layout (2/3 Plans & Addons + 1/3 Sticky Summary) ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Tiers Grid & Addons (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-10">
          {/* Plan Tiers Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-500" />
                  Select Core Plan Tier
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pick the operational tier that fits your pipeline velocity and team size.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLAN_TIERS.map((tier) => {
                const isSelected = selectedPlan === tier.id;
                const displayPrice = billingCycle === 'annually' ? tier.annualMonthlyEquivalent : tier.monthlyPrice;

                return (
                  <div
                    key={tier.id}
                    onClick={() => setSelectedPlan(tier.id)}
                    className={cn(
                      'group relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-300 cursor-pointer',
                      'bg-white/80 dark:bg-[#1E2630]/80 backdrop-blur-xl border',
                      isSelected
                        ? 'border-blue-500/80 dark:border-blue-500 ring-2 ring-blue-500/90 ring-offset-2 ring-offset-slate-50 dark:ring-offset-[#121418] shadow-2xl shadow-blue-500/15 dark:shadow-blue-500/10'
                        : 'border-slate-200/80 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.15] hover:shadow-xl shadow-sm'
                    )}
                  >
                    {/* Glowing highlight when selected */}
                    {isSelected && (
                      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-blue-500/5 via-transparent to-transparent dark:from-blue-500/10" />
                    )}

                    {/* Top Badges */}
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between min-h-[26px]">
                        {tier.badge ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
                              tier.popular
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/30'
                                : 'bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1]'
                            )}
                          >
                            {tier.popular && <Sparkles className="w-3 h-3" />}
                            {tier.badge}
                          </span>
                        ) : (
                          <span />
                        )}

                        {tier.current && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Current Plan
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          {tier.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[32px] line-clamp-2 leading-relaxed">
                          {tier.tagline}
                        </p>
                      </div>

                      {/* Price Tag */}
                      <div className="pt-2 pb-1 border-b border-slate-100 dark:border-white/[0.06]">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            ${displayPrice}
                          </span>
                          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400">
                            / user / mo
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 font-medium">
                          {billingCycle === 'annually'
                            ? `Billed annually ($${displayPrice * 12}/yr)`
                            : 'Billed monthly'}
                        </p>
                      </div>

                      {/* Seat & Contact Callouts */}
                      <div className="space-y-1.5 py-1 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tier.seatsLabel}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                          <Database className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tier.contactsLimit}</span>
                        </div>
                      </div>

                      {/* Features List */}
                      <div className="pt-3 space-y-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                          Included Capabilities
                        </p>
                        <ul className="space-y-2">
                          {tier.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs leading-snug">
                              <CheckCircle2
                                className={cn(
                                  'w-4 h-4 shrink-0 mt-0.5',
                                  feature.highlight
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                )}
                              />
                              <span
                                className={cn(
                                  feature.highlight
                                    ? 'font-bold text-slate-900 dark:text-white'
                                    : 'text-slate-600 dark:text-slate-400'
                                )}
                              >
                                {feature.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Card Button */}
                    <div className="relative z-10 mt-6 pt-4">
                      <button
                        type="button"
                        className={cn(
                          'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-sm',
                          isSelected
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 ring-1 ring-blue-400/30'
                            : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/[0.08]'
                        )}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Selected Plan
                          </>
                        ) : (
                          <>Choose {tier.name}</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Section 4: Non-AI Add-ons Section ──────────────────────────────── */}
          <div className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  Optional Infrastructure & Service Add-ons
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Supercharge your CRM workspace with enterprise telephony retention, dedicated SLAs, and white-labeling.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-3 py-1 rounded-full w-fit">
                {selectedAddons.length} active add-on{selectedAddons.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="space-y-3">
              {ADDONS_LIST.map((addon) => {
                const isSelected = selectedAddons.includes(addon.id);
                const displayPrice = billingCycle === 'annually' ? addon.annualMonthlyEquivalent : addon.monthlyPrice;
                const Icon = addon.icon;

                return (
                  <div
                    key={addon.id}
                    onClick={() => handleToggleAddon(addon.id)}
                    className={cn(
                      'group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl transition-all duration-200 cursor-pointer',
                      'bg-white/80 dark:bg-[#1E2630]/80 backdrop-blur-xl border',
                      isSelected
                        ? 'border-blue-500/70 dark:border-blue-500/80 bg-blue-50/20 dark:bg-blue-950/15 shadow-md shadow-blue-500/5'
                        : 'border-slate-200/80 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-slate-50/60 dark:hover:bg-white/[0.02]'
                    )}
                  >
                    <div className="flex items-start sm:items-center gap-4 flex-1">
                      <div
                        className={cn(
                          'p-3 rounded-xl border transition-colors shrink-0',
                          isSelected
                            ? 'bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                            : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border-slate-200/70 dark:border-white/[0.06]'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {addon.name}
                          </h4>
                          {addon.badge && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              {addon.badge}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded">
                            {addon.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                          {addon.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/[0.05]">
                      <div className="text-left sm:text-right">
                        <div className="flex items-baseline gap-1 sm:justify-end">
                          <span className="text-base font-black text-slate-900 dark:text-white">
                            +${displayPrice}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">/ mo</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {billingCycle === 'annually'
                            ? `$${displayPrice * 12}/yr billed annually`
                            : 'billed monthly'}
                        </p>
                      </div>

                      {/* Custom Switch Component */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleAddon(addon.id);
                        }}
                        className={cn(
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                          isSelected
                            ? 'bg-blue-600 dark:bg-blue-500'
                            : 'bg-slate-300 dark:bg-slate-700'
                        )}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                            isSelected ? 'translate-x-5' : 'translate-x-0'
                          )}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right Column: Sticky Real-time Order Summary ─────────────────────── */}
        <div className="lg:col-span-1 sticky top-6">
          <div className="relative rounded-3xl border border-slate-200/90 dark:border-white/[0.09] bg-gradient-to-b from-white/95 to-slate-50/90 dark:from-[#1E2630]/95 dark:to-[#171E27]/95 p-6 shadow-2xl shadow-slate-300/40 dark:shadow-black/60 backdrop-blur-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Order Summary
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time checkout preview</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 rounded-full border border-slate-200 dark:border-white/[0.08]">
                <Shield className="w-3 h-3 text-emerald-500" />
                256-bit Encrypted
              </span>
            </div>

            {/* Base Tier Breakdown */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Selected Plan
              </p>

              <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedTier.name} Tier
                    </span>
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/50 capitalize">
                      {billingCycle}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    ${calculations.baseMonthlyPrice}
                    <span className="text-[10px] font-normal text-slate-400">/mo</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{selectedTier.seatsLabel}</span>
                  <span>{selectedTier.contactsLimit}</span>
                </div>
              </div>
            </div>

            {/* Add-ons Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Configured Add-ons
                </p>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  {activeAddonsList.length} Selected
                </span>
              </div>

              {activeAddonsList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] p-4 text-center">
                  <p className="text-xs text-slate-400">No add-ons selected.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Toggle optional add-ons to customize.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAddonsList.map((addon) => {
                    const price = calculations.isAnnual ? addon.annualMonthlyEquivalent : addon.monthlyPrice;
                    return (
                      <div
                        key={addon.id}
                        className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-slate-50/60 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04]"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                          <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                            {addon.name}
                          </span>
                        </div>
                        <span className="text-slate-900 dark:text-white font-bold shrink-0">
                          +${price}/mo
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subtotal & Discount Calculation */}
            <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-white/[0.08] text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Monthly Equivalent</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  ${calculations.totalMonthlyEquivalent}/mo
                </span>
              </div>

              {calculations.isAnnual && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Annual Discount Savings (20%)
                  </span>
                  <span className="font-bold">-${calculations.annualSavings}/yr</span>
                </div>
              )}
            </div>

            {/* Total Due Today */}
            <div className="rounded-2xl bg-slate-900 dark:bg-black/50 text-white p-4 space-y-1.5 shadow-inner">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-slate-300">Total Due Today</span>
                <div className="text-right">
                  <span className="text-3xl font-black tracking-tight text-white">
                    ${calculations.totalDueToday}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">
                    {calculations.isAnnual ? '/ year' : '/ month'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 text-right">
                {calculations.isAnnual
                  ? `Billed annually at $${calculations.totalDueToday} USD / year`
                  : `Renews monthly at $${calculations.totalDueToday} USD / month`}
              </p>
            </div>

            {/* Guarantees & Features list */}
            <div className="space-y-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>14-day full refund satisfaction guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Instant provisioning & zero downtime upgrade</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Switch tiers or cancel anytime with 1 click</span>
              </div>
            </div>

            {/* Checkout CTA Button */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleProceedToPayment}
              className={cn(
                'w-full py-3.5 px-6 rounded-2xl text-sm font-bold text-white transition-all duration-300 cursor-pointer',
                'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500',
                'shadow-lg shadow-blue-500/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2 ring-1 ring-white/20'
              )}
            >
              {isProcessing ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Processing Secure Checkout...</span>
                </>
              ) : (
                <>
                  <span>Proceed to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500">
              By confirming, you authorize LeadCRM to update your workspace billing according to these terms.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 5: Checkout Success & Receipt Modal ──────────────────────── */}
      <AnimatePresence>
        {showReceiptModal && lastOrderPayload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#1E2630] p-6 lg:p-8 shadow-2xl relative space-y-6"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowReceiptModal(false)}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-white/[0.06] transition-colors cursor-pointer"
                aria-label="Close receipt modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Payment Payload Prepared
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The plan configuration was successfully dispatched and logged to the developer console.
                </p>
              </div>

              {/* Order Receipt Box */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-black/30 p-5 space-y-3 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-white/[0.06]">
                  <span className="font-medium">Selected Tier</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {lastOrderPayload.order.selectedTier.name} ({lastOrderPayload.order.billingCycle})
                  </span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-white/[0.06]">
                  <span className="font-medium">Active Add-ons</span>
                  <span className="font-bold text-slate-900 dark:text-white text-right">
                    {lastOrderPayload.order.selectedAddons.length > 0
                      ? lastOrderPayload.order.selectedAddons.map((a: any) => a.name).join(', ')
                      : 'None'}
                  </span>
                </div>

                {lastOrderPayload.order.pricingSummary.annualDiscountSavings > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 pb-2 border-b border-slate-200 dark:border-white/[0.06]">
                    <span className="font-medium">Annual Discount (20%)</span>
                    <span className="font-bold">
                      -${lastOrderPayload.order.pricingSummary.annualDiscountSavings} USD
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-slate-900 dark:text-white pt-1 text-sm font-black">
                  <span>Total Due Today</span>
                  <span className="text-blue-600 dark:text-blue-400 text-base">
                    ${lastOrderPayload.order.pricingSummary.totalDueToday} USD
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReceiptModal(false);
                    toast.info('Invoice downloaded to local system.');
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200/80 dark:hover:bg-white/[0.1] text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PlanUsageTab;
