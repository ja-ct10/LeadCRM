'use client';

import { apiClient } from '../../../../lib/api/client';
import type { PaginatedResponse } from '@leadcrm/shared';

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const auditApiService = {
  getAll: (params?: { page?: number; limit?: number; action?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.action) query.set('action', params.action);
    return apiClient.get<PaginatedResponse<AuditLogEntry>>(`/administration/audit?${query.toString()}`);
  },
};
