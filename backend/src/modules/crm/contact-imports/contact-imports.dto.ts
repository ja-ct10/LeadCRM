import { z } from 'zod';

export const ImportContactRowSchema = z.object({
  firstName:   z.string().min(1, 'First Name is required').max(100),
  lastName:    z.string().min(1, 'Last Name is required').max(100),
  email:       z.string().min(1, 'Email is required').email('Invalid email address'),
  phone:       z.string().min(1, 'Phone Number is required'),
  companyName: z.string().min(1, 'Company Name is required').max(200),
  address:     z.string().min(1, 'Full Address is required').max(500),
});

export type ImportContactRowDto = z.infer<typeof ImportContactRowSchema>;

export const CreateContactImportSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  rows: z
    .array(
      z.object({
        rowNumber: z.number().int().min(2),
        firstName: z.string().optional().default(''),
        lastName: z.string().optional().default(''),
        email: z.string().optional().default(''),
        phone: z.string().optional().default(''),
        companyName: z.string().optional().default(''),
        address: z.string().optional().default(''),
      }),
    )
    .min(1, 'At least one row is required')
    .max(5000, 'Maximum 5000 rows per import'),
});

export type CreateContactImportDto = z.infer<typeof CreateContactImportSchema>;

export const ListContactImportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const ListContactImportResultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['imported', 'failed']).optional(),
});
