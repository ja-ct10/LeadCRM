'use client';

import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@leadcrm/shared';

export interface ReportSummary {
  contacts:    { total: number; hot: number; warm: number; cold: number };
  deals:       { total: number; totalValue: number; wonCount: number };
  campaigns:   { total: number; sent: number; openRate: number };
  workflows:   { total: number; active: number; executions: number };
}

export const reportingService = {
  getSummary: (): Promise<ApiResponse<ReportSummary>> =>
    apiClient.get<ApiResponse<ReportSummary>>('/reporting/summary'),
};
