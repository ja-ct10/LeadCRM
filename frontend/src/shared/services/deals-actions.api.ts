'use client';

import { apiClient } from '@/lib/api/client';
import { toast } from '@/shared/utils/toast';
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
