import { z } from 'zod';

/**
 * Merge Preview DTO — validates the request body for POST /crm/merge/preview.
 */
export const MergePreviewSchema = z.object({
  entityType: z.enum(['lead', 'contact', 'account']),
  primaryId: z.string().min(1, 'Primary record ID is required'),
  secondaryId: z.string().min(1, 'Secondary record ID is required'),
}).refine(
  (data) => data.primaryId !== data.secondaryId,
  { message: 'Primary and secondary records must be different', path: ['secondaryId'] },
);

/**
 * Merge Execute DTO — validates the request body for POST /crm/merge.
 */
export const MergeExecuteSchema = z.object({
  entityType: z.enum(['lead', 'contact', 'account']),
  primaryId: z.string().min(1, 'Primary record ID is required'),
  secondaryId: z.string().min(1, 'Secondary record ID is required'),
  fieldResolutions: z.record(z.string(), z.enum(['primary', 'secondary'])),
}).refine(
  (data) => data.primaryId !== data.secondaryId,
  { message: 'Primary and secondary records must be different', path: ['secondaryId'] },
);

export type MergePreviewDto = z.infer<typeof MergePreviewSchema>;
export type MergeExecuteDto = z.infer<typeof MergeExecuteSchema>;
