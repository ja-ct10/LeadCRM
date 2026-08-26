'use client';

import { useState, useEffect, useCallback } from 'react';
import { billingService } from '../services/billing.service';
import type { SubscriptionDetails, PricingPlan } from '../types/billing.types';

interface UseBillingDataReturn {
  subscription: SubscriptionDetails | null;
  plans: PricingPlan[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook that fetches the tenant's current subscription and available plans.
 * Handles loading, error states, and provides a refetch function.
 */
export function useBillingData(): UseBillingDataReturn {
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [subResponse, plansResponse] = await Promise.all([
        billingService.getSubscription(),
        billingService.getPlans(),
      ]);

      setSubscription(subResponse.data);
      setPlans(plansResponse.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load billing data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { subscription, plans, isLoading, error, refetch: fetchData };
}
