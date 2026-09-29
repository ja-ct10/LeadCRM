import { z } from 'zod';

export const ProductInterestSchema = z.object({
  name: z.string().trim().min(1).max(200).refine(v => !/[\u0000-\u001f\u007f]/.test(v), 'Invalid product name'),
  value: z.number().finite().min(0).max(999_999_999_999).multipleOf(0.01),
}).strict();
export const ProductInterestConfigSchema = z.array(ProductInterestSchema).min(1).max(100).refine(
  rows => new Set(rows.map(row => row.name.toLowerCase())).size === rows.length, 'Product names must be unique',
);
export type ProductInterestConfig = z.infer<typeof ProductInterestConfigSchema>;
