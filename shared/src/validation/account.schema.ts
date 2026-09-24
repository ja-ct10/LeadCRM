import { z } from 'zod';

/** Tax IDs stay strings so leading zeros are preserved. Empty means not provided. */
export const OptionalTaxIdSchema = z.string()
  .regex(/^(?:[0-9]{9})?$/, 'Tax ID must contain exactly 9 digits.')
  .optional();
