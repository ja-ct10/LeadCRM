import React from 'react';
import type { ProductInterestRecord } from '@leadcrm/shared';

export function productCategoriesForSelection(values: string[], products: ProductInterestRecord[], valueMode: 'id' | 'name' = 'id'): string {
  const categories = values.flatMap(value => {
    const matches = products.filter(product => (valueMode === 'id' ? product.id : product.name) === value);
    return matches.length === 1 ? [matches[0].category?.trim() || 'Uncategorized'] : [];
  });
  return [...new Set(categories)].join(', ') || '—';
}

export function ProductCategoryValue({ values, products, valueMode = 'id' }: { values: string[]; products: ProductInterestRecord[]; valueMode?: 'id' | 'name' }) {
  return <div className="mb-3 space-y-1.5" aria-live="polite">
    <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Product Category</span>
    <p className="text-sm text-slate-900 dark:text-white [overflow-wrap:anywhere]">{productCategoriesForSelection(values, products, valueMode)}</p>
  </div>;
}
