import { apiClient } from '@/lib/api/client';

export interface ImportRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
}

export interface CreateImportPayload {
  fileName: string;
  rows: ImportRow[];
}

export interface ImportSummary {
  id: string;
  fileName: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  status: 'pending' | 'importing' | 'completed' | 'completed_with_errors' | 'failed';
  createdAt: string;
  completedAt: string | null;
  createdBy?: { id: string; firstName: string; lastName: string };
}

export interface ImportResultRow {
  id: string;
  importId: string;
  rowNumber: number;
  status: 'imported' | 'failed';
  leadId: string | null;
  remarks: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  address: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

/**
 * Start a new lead import.
 */
export function createLeadImport(payload: CreateImportPayload): Promise<{ success: boolean; data: ImportSummary }> {
  return apiClient.post('/crm/leads/imports', payload);
}

/**
 * Get a single import by ID.
 */
export function getLeadImport(importId: string): Promise<{ success: boolean; data: ImportSummary }> {
  return apiClient.get(`/crm/leads/imports/${importId}`);
}

/**
 * List all imports (paginated).
 */
export function listLeadImports(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<ImportSummary>> {
  return apiClient.get('/crm/leads/imports', { params: params as Record<string, unknown> });
}

/**
 * Get paginated results for an import.
 */
export function getLeadImportResults(
  importId: string,
  params?: { page?: number; limit?: number; status?: string },
): Promise<PaginatedResponse<ImportResultRow>> {
  return apiClient.get(`/crm/leads/imports/${importId}/results`, { params: params as Record<string, unknown> });
}
