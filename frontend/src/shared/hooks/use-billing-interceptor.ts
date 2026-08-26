'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanUpgradeInfo {
  feature: string;
  currentPlan: string;
  requiredPlan: string;
}

interface UseBillingInterceptorReturn {
  upgradeInfo: PlanUpgradeInfo | null;
  showUpgradeModal: boolean;
  closeUpgradeModal: () => void;
}

// ─── Custom Events ────────────────────────────────────────────────────────────

/** Dispatch this event when the API returns 403 with code PLAN_UPGRADE_REQUIRED */
export function dispatchPlanUpgradeRequired(detail: PlanUpgradeInfo): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('plan-upgrade-required', { detail }));
}

/** Dispatch this event when the API returns 402 with code PAYMENT_REQUIRED */
export function dispatchPaymentRequired(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('payment-required'));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook that listens for plan-upgrade-required custom events and manages
 * the PlanUpgradeModal state. Wire this into the tenant layout shell.
 */
export function useBillingInterceptor(): UseBillingInterceptorReturn {
  const [upgradeInfo, setUpgradeInfo] = useState<PlanUpgradeInfo | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    function handleUpgradeRequired(e: Event): void {
      const detail = (e as CustomEvent<PlanUpgradeInfo>).detail;
      setUpgradeInfo(detail);
      setShowUpgradeModal(true);
    }

    window.addEventListener('plan-upgrade-required', handleUpgradeRequired);
    return () => {
      window.removeEventListener('plan-upgrade-required', handleUpgradeRequired);
    };
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
    setUpgradeInfo(null);
  }, []);

  return { upgradeInfo, showUpgradeModal, closeUpgradeModal };
}
