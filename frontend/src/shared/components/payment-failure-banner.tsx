'use client';

import React, { useState, useCallback } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { billingService } from '@/features/tenant/billing/services/billing.service';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentFailureBannerProps {
  subscriptionStatus: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Persistent banner shown when the tenant's subscription is PAST_DUE or CANCELLED.
 * Provides a direct "Update Payment" button that opens Stripe Customer Portal.
 * Dismissible per-session (reappears on navigation/refresh).
 */
export function PaymentFailureBanner({ subscriptionStatus }: PaymentFailureBannerProps): React.ReactElement | null {
  const [dismissed, setDismissed] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const shouldShow = !dismissed && (subscriptionStatus === 'PAST_DUE' || subscriptionStatus === 'CANCELLED' || subscriptionStatus === 'EXPIRED');

  const handleUpdatePayment = useCallback(async () => {
    try {
      setPortalLoading(true);
      const response = await billingService.createPortalSession();
      window.location.href = response.data.portalUrl;
    } catch {
      // Fallback: navigate to billing page
      window.location.href = '/billing/client';
    }
  }, []);

  if (!shouldShow) return null;

  const isPastDue = subscriptionStatus === 'PAST_DUE';
  const message = isPastDue
    ? 'Your payment failed. Update your payment method to avoid service interruption.'
    : 'Your subscription has ended. Resubscribe to continue using all features.';

  return (
    <div className="w-full bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/60 px-4 py-3">
      <div className="flex items-center justify-between gap-4 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 truncate">
            {message}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleUpdatePayment}
            disabled={portalLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {portalLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            Update Payment
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
