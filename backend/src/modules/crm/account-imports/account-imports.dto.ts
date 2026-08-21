import { z } from 'zod';

/**
 * Schema for a single row of account data being imported.
 */
export const ImportAccountRowSchema = z.object({
  name:     z.string().min(1, 'Company Name is required').max(255),
  industry: z.string().optional().default(''),
  website:  z.string().optional().default(''),
  address:  z.string().optional().default(''),
  city:     z.string().optional().default(''),
  province: z.string().optional().default(''),
  country:  z.string().optional().default(''),
});

export type ImportAccountRowDto = z.infer<typeof ImportAccountRowSchema>;

/**
 * Schema for the import request body.
 */
export const CreateAccountImportSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  rows: z
    .array(
      z.object({
        rowNumber: z.number().int().min(2),
        name:     z.string().optional().default(''),
        industry: z.string().optional().default(''),
        website:  z.string().optional().default(''),
        address:  z.string().optional().default(''),
        city:     z.string().optional().default(''),
        province: z.string().optional().default(''),
        country:  z.string().optional().default(''),
      }),
    )
    .min(1, 'At least one row is required')
    .max(5000, 'Maximum 5000 rows per import'),
});

export type CreateAccountImportDto = z.infer<typeof CreateAccountImportSchema>;

export const ListAccountImportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const ListAccountImportResultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['imported', 'failed']).optional(),
});
