import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AccountImportRow {
  rowNumber: number;
  name: string;
  industry: string;
  website: string;
  address: string;
  city: string;
  province: string;
  country: string;
}

export interface CreateAccountImportPayload {
  fileName: string;
  rows: AccountImportRow[];
}

export interface AccountImportSummary {
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

export interface AccountImportResultRow {
  id: string;
  importId: string;
  rowNumber: number;
  status: 'imported' | 'failed';
  accountId: string | null;
  remarks: string | null;
  name: string | null;
  industry: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
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

// ── API Functions ─────────────────────────────────────────────────────────────

/**
 * Start a new account import.
 */
export function createAccountImport(payload: CreateAccountImportPayload): Promise<{ success: boolean; data: AccountImportSummary }> {
  return apiClient.post('/crm/accounts/imports', payload);
}

/**
 * Get a single account import by ID.
 */
export function getAccountImport(importId: string): Promise<{ success: boolean; data: AccountImportSummary }> {
  return apiClient.get(`/crm/accounts/imports/${importId}`);
}

/**
 * List all account imports (paginated).
 */
export function listAccountImports(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<AccountImportSummary>> {
  return apiClient.get('/crm/accounts/imports', { params: params as Record<string, unknown> });
}

/**
 * Get paginated results for an account import.
 */
export function getAccountImportResults(
  importId: string,
  params?: { page?: number; limit?: number; status?: string },
): Promise<PaginatedResponse<AccountImportResultRow>> {
  return apiClient.get(`/crm/accounts/imports/${importId}/results`, { params: params as Record<string, unknown> });
}
