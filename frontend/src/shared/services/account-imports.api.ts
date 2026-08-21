import { apiClient } from '@/lib/api/client';

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
}

export function createAccountImport(payload: CreateAccountImportPayload): Promise<{ success: boolean; data: AccountImportSummary }> {
  return apiClient.post('/crm/accounts/imports', payload);
}

export function getAccountImport(importId: string): Promise<{ success: boolean; data: AccountImportSummary }> {
  return apiClient.get(`/crm/accounts/imports/${importId}`);
}
