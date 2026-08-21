'use client';

import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { handleApiError } from '@/shared/utils/handle-api-error';
import type { Deal } from '@/store/types';

interface DealActionResponse {
  success: boolean;
  data: Deal;
}

/**
 * Restore an archived deal.
 * PATCH /api/v1/crm/deals/:id/restore
 */
export async function restoreDeal(dealId: string): Promise<Deal> {
  try {
    const response = await apiClient.patch<DealActionResponse>(
      `/crm/deals/${dealId}/restore`
    );
    toast.success('Deal restored successfully');
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Duplicate an existing deal.
 * POST /api/v1/crm/deals/:id/duplicate
 */
export async function duplicateDeal(dealId: string): Promise<Deal> {
  try {
    const response = await apiClient.post<DealActionResponse>(
      `/crm/deals/${dealId}/duplicate`,
      {}
    );
    toast.success('Deal duplicated successfully');
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}
