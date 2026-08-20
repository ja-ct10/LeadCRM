'use client';

import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

export interface BulkOperationResult {
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; reason: string }>;
}

interface BulkOperationResponse {
  success: boolean;
  data: BulkOperationResult;
}

function showBulkToast(
  result: BulkOperationResult,
  successVerb: string,
  failureVerb: string
): void {
  const { succeeded, failed, errors } = result;

  if (succeeded > 0 && failed === 0) {
    toast.success(`${succeeded} deal${succeeded > 1 ? 's' : ''} ${successVerb}`);
  } else if (succeeded > 0 && failed > 0) {
    toast.warning(`${succeeded} ${successVerb}, ${failed} failed`, {
      description: errors.map((e) => e.reason).join('; '),
    });
  } else {
    toast.error(`${failureVerb} failed`, {
      description: errors.length > 0
        ? errors.map((e) => e.reason).join('; ')
        : `No deals were ${successVerb}.`,
    });
  }
}

export async function bulkArchiveDeals(
  dealIds: string[],
  archiveReason?: string
): Promise<BulkOperationResult> {
  const response = await apiClient.post<BulkOperationResponse>(
    '/crm/deals/bulk/archive',
    { dealIds, archiveReason }
  );
  const result = response.data;
  showBulkToast(result, 'archived', 'Archive');
  return result;
}

export async function bulkReassignDeals(
  dealIds: string[],
  assignedUserId: string
): Promise<BulkOperationResult> {
  const response = await apiClient.post<BulkOperationResponse>(
    '/crm/deals/bulk/reassign',
    { dealIds, assignedUserId }
  );
  const result = response.data;
  showBulkToast(result, 'reassigned', 'Reassign');
  return result;
}

export async function bulkStageChangeDeals(
  dealIds: string[],
  stageId: string,
  note?: string,
  lostReason?: string
): Promise<BulkOperationResult> {
  const response = await apiClient.post<BulkOperationResponse>(
    '/crm/deals/bulk/stage',
    { dealIds, stageId, note, lostReason }
  );
  const result = response.data;
  showBulkToast(result, 'moved', 'Stage change');
  return result;
}
