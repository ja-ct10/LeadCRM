'use client';

import React from 'react';
import type { ProductInterest } from '@leadcrm/shared';
import { useProductInterests } from '@/shared/hooks/use-product-interests';
import { CheckboxDropdownSelect } from '@/shared/components/ui/checkbox-dropdown-select';

interface Props {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  products: ProductInterest[];
  valueMode?: 'id' | 'name';
  disabled?: boolean;
  single?: boolean;
  labels?: Record<string, string>;
  ariaLabel?: string;
  searchable?: boolean;
}

/** One catalog-backed selector; name mode preserves the Contact/Account snapshot API. */
export function ProductInterestSelect({ id, values, onChange, products, valueMode = 'id', disabled, single = false, labels = {}, ariaLabel = 'Product Interest', searchable = false }: Props) {
  const [category, setCategory] = React.useState('');
  const categoryId = React.useId();
  const categories = [...new Set(products.map(product => product.category).filter((value): value is string => !!value))].sort();
  const selected = [...new Set(values)];
  const options = products.filter(product => !category || (category === '__uncategorized' ? !product.category : product.category === category)).map(p => ({ value: valueMode === 'id' ? p.id : p.name, label: p.name }));
  for (const value of selected) if (!options.some(p => p.value === value)) options.push({ value, label: products.find(product => (valueMode === 'id' ? product.id : product.name) === value)?.name || labels[value] || (valueMode === 'name' ? value : 'Unavailable product') });
  return <div className="space-y-2"><label className="block text-xs text-muted-foreground" htmlFor={categoryId}>Product category</label><select id={categoryId} aria-label="Product category filter" className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" disabled={disabled} value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option><option value="__uncategorized">Uncategorized</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select><CheckboxDropdownSelect id={id} values={values} options={options} onChange={onChange} disabled={disabled} single={single} searchable={searchable} ariaLabel={ariaLabel} contentAriaLabel="Product interests" placeholder="Select product interests…" emptyMessage={category ? "No products match this category." : "No configured Product Interests."} /></div>;
}

export function CatalogProductInterestSelect(props: Omit<Props, 'products'>) {
  const { products, loading, error, refresh } = useProductInterests();
  return <><ProductInterestSelect {...props} products={products} disabled={props.disabled || loading || !!error} />{error && <p role="alert" className="text-xs text-destructive">{error} <button type="button" onClick={refresh}>Retry products</button></p>}</>;
}
