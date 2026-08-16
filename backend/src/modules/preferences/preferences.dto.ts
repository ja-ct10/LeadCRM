import { z } from 'zod';

// Re-export shared validation schemas (single source of truth)
export {
  ColumnModuleParamsSchema,
  ColumnItemSchema,
  SaveColumnsBodySchema,
} from '@leadcrm/shared';

// Re-export inferred types from shared
export type {
  ColumnModuleParams,
  ColumnItem,
  SaveColumnsBody,
} from '@leadcrm/shared';

// Backend alias for route parameter validation (GET/DELETE endpoints)
import { ColumnModuleParamsSchema } from '@leadcrm/shared';
export const GetColumnsParamsSchema = ColumnModuleParamsSchema;
export type GetColumnsParams = z.infer<typeof GetColumnsParamsSchema>;
