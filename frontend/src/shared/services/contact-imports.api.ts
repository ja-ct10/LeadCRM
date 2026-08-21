import { apiClient } from '@/lib/api/client';

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
}

export function createContactImport(payload: CreateContactImportPayload): Promise<{ success: boolean; data: ContactImportSummary }> {
  return apiClient.post('/crm/contacts/imports', payload);
}

export function getContactImport(importId: string): Promise<{ success: boolean; data: ContactImportSummary }> {
  return apiClient.get(`/crm/contacts/imports/${importId}`);
}
