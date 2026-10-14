import { describe, expect, it } from 'vitest';
import {
  parseProductCreateAmount,
  ProductInterestCreateSchema,
  ProductInterestPatchSchema,
  ProductInterestConfigSchema,
  MAX_ACTIVE_PRODUCTS,
} from '@leadcrm/shared';

describe('new Product Interest validation', () => {
  it('requires a trimmed non-empty name and digit-only integer deal value', () => {
    expect(ProductInterestCreateSchema.parse({ name: '   CCTV Surveillance System   ', dealValue: 25000 }))
      .toEqual({ name: 'CCTV Surveillance System', dealValue: 25000 });
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

  it('uses the same active catalog ceiling as creation and restoration', () => {
    const products = Array.from({ length: MAX_ACTIVE_PRODUCTS }, (_, index) => ({ name: `Product ${index}`, dealValue: 0 }));
    expect(ProductInterestConfigSchema.safeParse(products).success).toBe(true);
    expect(ProductInterestConfigSchema.safeParse([...products, { name: 'Overflow', dealValue: 0 }]).success).toBe(false);
  });
});
