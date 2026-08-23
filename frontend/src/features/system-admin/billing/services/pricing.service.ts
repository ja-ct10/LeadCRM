'use client';

import { apiClient } from '@/lib/api/client';
import type { PricingPlanDto, UpdatePlanRequest } from '@leadcrm/shared';

export const pricingApiService = {
  /** GET /admin/plans — returns all active pricing plans with features */
  getPlans: () =>
    apiClient.get<{ success: boolean; data: PricingPlanDto[] }>('/admin/plans'),

  /**
   * PUT /admin/plans/:id — update plan name, price, and/or feature list.
   * Features array is the full replacement list; disabled features are
   * stored with enabled:false so the UI can display them struck-through.
   */
  updatePlan: (planId: string, data: UpdatePlanRequest) =>
    apiClient.put<{ success: boolean; data: PricingPlanDto }>(`/admin/plans/${planId}`, data),
};
