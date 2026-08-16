import { z } from 'zod';

/**
 * Shared Zod validation schemas for column preference endpoints.
 * Used by both backend (request validation) and frontend (form validation).
 */

/** Path parameter schema — validates the :module URL parameter. */
export const ColumnModuleParamsSchema = z.object({
  module: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_-]*$/, {
    message: 'Module must start with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores',
  }),
});

/** Single column item in a save payload. */
export const ColumnItemSchema = z.object({
  id: z.string().min(1).max(255).regex(/^[a-zA-Z0-9]+$/, {
    message: 'Column id must contain only alphanumeric characters',
  }),
  visible: z.boolean(),
  order: z.number().int().nonnegative(),
});

/** Full save payload — max 64KB enforced at middleware level. */
export const SaveColumnsBodySchema = z.object({
  columns: z.array(ColumnItemSchema).min(1).max(100),
}).refine(
  (data) => new Set(data.columns.map((c) => c.id)).size === data.columns.length,
  { message: 'Duplicate column ids are not allowed' }
);

/** Inferred types from schemas. */
export type ColumnModuleParams = z.infer<typeof ColumnModuleParamsSchema>;
export type ColumnItem = z.infer<typeof ColumnItemSchema>;
export type SaveColumnsBody = z.infer<typeof SaveColumnsBodySchema>;
