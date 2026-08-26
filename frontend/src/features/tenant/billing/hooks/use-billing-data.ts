'use client';

import { useState, useEffect, useCallback } from 'react';
import { billingService } from '../services/billing.service';
import type { SubscriptionDetails, PricingPlan, SeatUsage } from '../types/billing.types';

interface UseBillingDataReturn {
  subscription: SubscriptionDetails | null;
  plans: PricingPlan[];
  seats: SeatUsage | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refetchSeats: () => Promise<void>;
}

/**
 * Hook that fetches the tenant's current subscription, available plans, and seat usage.
 * Handles loading, error states, and provides refetch functions.
 */
export function useBillingData(): UseBillingDataReturn {
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [seats, setSeats] = useState<SeatUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [subResponse, plansResponse, seatsResponse] = await Promise.all([
        billingService.getSubscription(),
        billingService.getPlans(),
        billingService.getSeats().catch(() => ({ success: false, data: null })),
      ]);

      setSubscription(subResponse.data);
      setPlans(plansResponse.data);
      if (seatsResponse.data) {
        setSeats(seatsResponse.data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load billing data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetchSeats = useCallback(async () => {
    try {
      const response = await billingService.getSeats();
      setSeats(response.data);
    } catch {
      // Seat fetch failure is non-critical
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { subscription, plans, seats, isLoading, error, refetch: fetchData, refetchSeats };
}
