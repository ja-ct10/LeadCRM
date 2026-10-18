import { describe, expect, it } from 'vitest';
import {
  parseProductCreateAmount,
  ProductInterestCreateSchema,
  ProductInterestPatchSchema,
  ProductInterestConfigSchema,
  MAX_ACTIVE_PRODUCTS,
  ProductCategoryMutationSchema,
} from '@leadcrm/shared';

describe('new Product Interest validation', () => {
  it('requires a trimmed non-empty name and digit-only integer deal value', () => {
    expect(ProductInterestCreateSchema.parse({ name: '   CCTV Surveillance System   ', category: 'CCTV', dealValue: 25000 }))
      .toEqual({ name: 'CCTV Surveillance System', category: 'CCTV', description: '', dealValue: 25000 });
    expect(ProductInterestCreateSchema.safeParse({ name: '   ', dealValue: 25000 }).success).toBe(false);
    expect(ProductInterestCreateSchema.safeParse({ name: 'Product', dealValue: undefined }).success).toBe(false);
    expect(ProductInterestCreateSchema.safeParse({ name: 'P'.repeat(201), dealValue: 25000 }).success).toBe(false);
  });

  it.each(['₱25000', '25,000', 'abc', '-500', '12abc', '25000.50', ' 25000', '25000 '])('rejects raw amount %s', amount => {
    expect(parseProductCreateAmount(amount)).toBeNull();
    expect(ProductInterestCreateSchema.safeParse({ name: 'Product', dealValue: amount }).success).toBe(false);
  });

  it('retains decimal numeric updates for existing products', () => {
    expect(ProductInterestPatchSchema.safeParse({ dealValue: 25000.5 }).success).toBe(true);
  });

  it.each([undefined, null, '', ' '])('requires category on create and rejects empty supplied update categories: %s', category => {
    expect(ProductInterestCreateSchema.safeParse({ name: 'Camera', category, dealValue: 25 }).success).toBe(false);
    if (category !== undefined) expect(ProductInterestPatchSchema.safeParse({ category }).success).toBe(false);
  });

  it('shares required category validation across add and rename', () => {
    expect(ProductCategoryMutationSchema.parse({ action: 'add', name: '  CCTV  ' })).toEqual({ action: 'add', name: 'CCTV' });
    expect(ProductCategoryMutationSchema.safeParse({ action: 'rename', name: 'CCTV', newName: ' ' }).success).toBe(false);
    expect(ProductCategoryMutationSchema.safeParse({ action: 'add', name: 'x'.repeat(201) }).success).toBe(false);
  });

  it('uses the same active catalog ceiling as creation and restoration', () => {
    const products = Array.from({ length: MAX_ACTIVE_PRODUCTS }, (_, index) => ({ name: `Product ${index}`, category: 'Catalog', dealValue: 0 }));
    expect(ProductInterestConfigSchema.safeParse(products).success).toBe(true);
    expect(ProductInterestConfigSchema.safeParse([...products, { name: 'Overflow', dealValue: 0 }]).success).toBe(false);
  });
});
