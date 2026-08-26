'use client';

import { apiClient } from '@/lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebhookEvent {
  id: string;
  stripeEventId: string;
  type: string;
  payload: unknown;
  status: 'RECEIVED' | 'PROCESSED' | 'FAILED';
  error: string | null;
  attempts: number;
  processedAt: string | null;
  createdAt: string;
}

interface WebhookEventsResponse {
  success: boolean;
  data: WebhookEvent[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

interface ReplayResponse {
  success: boolean;
  data: {
    message: string;
    status: 'PROCESSED' | 'FAILED';
    error?: string;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const adminWebhookService = {
  /** GET /admin/billing/webhook-events — paginated list with filters */
  listEvents: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) =>
    apiClient.get<WebhookEventsResponse>('/admin/billing/webhook-events', {
      params: params as Record<string, unknown>,
    }),

  /** POST /admin/billing/webhook-events/:id/replay — reprocess a failed event */
  replayEvent: (eventId: string) =>
    apiClient.post<ReplayResponse>(`/admin/billing/webhook-events/${eventId}/replay`, {}),
};
