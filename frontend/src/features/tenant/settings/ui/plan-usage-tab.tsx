'use client';

import React from 'react';
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';

// ── Plan Display Data ─────────────────────────────────────────────────────────
// Read-only plan info for the settings page. Actual billing operations happen at /billing/client.

interface PlanInfo {
  name: string;
  planType: string;
  badge?: string;
  features: string[];
}

const PLAN_INFO: Record<string, PlanInfo> = {
  FREE: {
    name: 'Free',
    planType: 'FREE',
    features: [
      'Basic CRM (Leads, Contacts, Deals)',
      'Up to 3 team members',
      '1,000 contacts limit',
      'Community support',
    ],
  },
  PRO: {
    name: 'Professional',
    planType: 'PRO',
    badge: 'Current',
    features: [
      'Everything in Free',
      'Workflow Automation',
      'Advanced Reporting & Export',
      'Up to 15 team members',
      '25,000 contacts limit',
      'Priority email support',
      'API access',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    planType: 'ENTERPRISE',
    features: [
      'Everything in Pro',
      'Marketing Campaigns',
      'Unlimited team members',
      'Unlimited contacts',
      'Custom fields & modules',
      'Dedicated account manager',
      'SSO & advanced security',
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Plan & Usage tab for the Settings page.
 *
 * This is a READ-ONLY summary of the tenant's current plan.
 * All billing operations (subscribe, upgrade, downgrade, manage payment, seats)
 * happen on the dedicated /billing/client page via Stripe.
 *
 * This pattern follows SaaS best practices:
 * - Settings = configuration (profile, preferences, notifications)
 * - Billing = money (subscriptions, payments, invoices)
 */
export function PlanUsageTab(): React.ReactElement {
  const router = useRouter();

  // The tenant type doesn't include billing fields directly.
  // Billing details are fetched via the dedicated billing API on /billing/client.
  // Here we show a simple summary — the user should go to /billing/client for full details.

  return (
    <div className="space-y-8 max-w-4xl">
      {/* ── Current Plan Summary Card ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-6 shadow-sm"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
              <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Subscription & Billing
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage your plan, payment methods, invoices, and team seats.
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          All billing operations — subscribing, upgrading, downgrading, managing payment methods, viewing invoices, and adding team seats — are handled through your dedicated billing portal powered by Stripe.
        </p>

        {/* CTA: Manage Billing */}
        <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => router.push('/billing/client')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <ExternalLink className="h-4 w-4" />
            Manage Subscription & Billing
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            View your current plan, upgrade or downgrade, manage payment methods, view invoices, and add seats.
          </p>
        </div>
      </motion.div>

      {/* ── Plan Comparison (Read-Only) ────────────────────────────────────── */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Available Plans</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.values(PLAN_INFO).map((plan) => (
            <div
              key={plan.planType}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 transition-colors"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-slate-400" />
                <h5 className="text-sm font-bold text-slate-900 dark:text-white">{plan.name}</h5>
              </div>
              <ul className="space-y-1.5">
                {plan.features.slice(0, 4).map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
                {plan.features.length > 4 && (
                  <li className="text-xs text-slate-400 dark:text-slate-500 pl-4.5">
                    +{plan.features.length - 4} more features
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => router.push('/billing/client')}
                className="mt-4 w-full text-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors cursor-pointer"
              >
                View on Billing Page →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PlanUsageTab;
