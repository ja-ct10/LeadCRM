'use client';

import React from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlanUpgradeModalProps {
  isOpen: boolean;
  feature: string;
  currentPlan: string;
  requiredPlan: string;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal shown when a user attempts an action that requires a higher plan.
 * Triggered by a 403 response with code: 'PLAN_UPGRADE_REQUIRED'.
 * Navigates to the billing page when the user clicks "Upgrade Now".
 */
export function PlanUpgradeModal({
  isOpen,
  feature,
  currentPlan,
  requiredPlan,
  onClose,
}: PlanUpgradeModalProps): React.ReactElement | null {
  const router = useRouter();

  const handleUpgrade = (): void => {
    onClose();
    router.push('/billing/client');
  };

  const featureLabel = feature
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl mx-4"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Upgrade Required
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                <strong className="text-slate-700 dark:text-slate-200">{featureLabel}</strong> requires
                the <strong className="text-indigo-600 dark:text-indigo-400">{requiredPlan}</strong> plan
                or higher.
              </p>
            </div>

            {/* Plan comparison */}
            <div className="flex items-center justify-center gap-3 mb-6 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {currentPlan}
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                {requiredPlan}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Maybe Later
              </button>
              <button
                type="button"
                onClick={handleUpgrade}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
              >
                Upgrade Now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
