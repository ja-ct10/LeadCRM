'use client';

import { apiClient } from '../../../../lib/api/client';

export const pricingApiService = {
  getPlans: () =>
    apiClient.get<{ success: boolean; data: unknown[] }>('/admin/plans'),

  updatePlan: (planId: string, data: { price?: number; features?: string[]; billingCycles?: string[] }) =>
    apiClient.put<{ success: boolean; data: unknown }>(`/admin/plans/${planId}`, data),
};
