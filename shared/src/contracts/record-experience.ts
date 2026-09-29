import { z } from 'zod';

export const LEAD_STATUSES = ['Hot', 'Warm', 'Cold', 'Closed', 'Cancelled'] as const;
export const LeadStatusSchema = z.enum(LEAD_STATUSES);
export const RECORD_FILE_MAX_BYTES = 10 * 1024 * 1024;
export interface RecordFileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  uploadedBy?: string;
  url: string;
}
