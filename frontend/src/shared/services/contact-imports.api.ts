import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContactImportRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
}

export interface CreateContactImportPayload {
  fileName: string;
  rows: ContactImportRow[];
}

export interface ContactImportSummary {
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

export interface ContactImportResultRow {
  id: string;
  importId: string;
  rowNumber: number;
  status: 'imported' | 'failed';
  contactId: string | null;
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

// ── API Functions ─────────────────────────────────────────────────────────────

/**
 * Start a new contact import.
 */
export function createContactImport(payload: CreateContactImportPayload): Promise<{ success: boolean; data: ContactImportSummary }> {
  return apiClient.post('/crm/contacts/imports', payload);
}

/**
 * Get a single contact import by ID.
 */
export function getContactImport(importId: string): Promise<{ success: boolean; data: ContactImportSummary }> {
  return apiClient.get(`/crm/contacts/imports/${importId}`);
}

/**
 * List all contact imports (paginated).
 */
export function listContactImports(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<ContactImportSummary>> {
  return apiClient.get('/crm/contacts/imports', { params: params as Record<string, unknown> });
}

/**
 * Get paginated results for a contact import.
 */
export function getContactImportResults(
  importId: string,
  params?: { page?: number; limit?: number; status?: string },
): Promise<PaginatedResponse<ContactImportResultRow>> {
  return apiClient.get(`/crm/contacts/imports/${importId}/results`, { params: params as Record<string, unknown> });
}
