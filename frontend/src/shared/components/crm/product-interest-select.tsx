'use client';

import React from 'react';
import type { ProductInterest } from '@leadcrm/shared';
import { useProductInterests } from '@/shared/hooks/use-product-interests';
import { CheckboxDropdownSelect } from '@/shared/components/ui/checkbox-dropdown-select';

interface Props {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  products: Pick<ProductInterest, 'id' | 'name' | 'category'>[];
  categories?: string[];
  showUncategorized?: boolean;
  valueMode?: 'id' | 'name';
  disabled?: boolean;
  single?: boolean;
  labels?: Record<string, string>;
  ariaLabel?: string;
  searchable?: boolean;
  presentation?: 'dropdown' | 'checkbox-list';
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

/** One catalog-backed selector; name mode preserves the Contact/Account snapshot API. */
export function ProductInterestSelect({ id, values, onChange, products, categories: catalogCategories, showUncategorized = true, valueMode = 'id', disabled, single = false, labels = {}, ariaLabel = 'Product Interest', searchable = false, presentation = 'dropdown', ariaInvalid, ariaDescribedBy }: Props) {
  const [category, setCategory] = React.useState('');
  const categoryId = React.useId();
  const categories = [...new Set(catalogCategories ?? products.map(product => product.category).filter((value): value is string => !!value))].sort();
  const selected = [...new Set(values)];
  const options = products.filter(product => !category || (category === '__uncategorized' ? !product.category : product.category === category)).map(p => ({ value: valueMode === 'id' ? p.id : p.name, label: p.name }));
  if (presentation === 'dropdown') for (const value of selected) if (!options.some(p => p.value === value)) options.push({ value, label: products.find(product => (valueMode === 'id' ? product.id : product.name) === value)?.name || labels[value] || (valueMode === 'name' ? value : 'Unavailable product') });
  const emptyMessage = category ? 'No products match this category.' : 'No configured Product Interests.';
  return <div className="min-w-0 space-y-2">
    <label className="block text-xs text-muted-foreground" htmlFor={categoryId}>Product category</label>
    <select id={categoryId} aria-label="Product category filter" className="min-h-10 w-full min-w-0 max-w-full rounded-lg border border-border bg-background px-3 text-sm" disabled={disabled} value={category} onChange={event => setCategory(event.target.value)}>
      <option value="">All categories</option>{showUncategorized && <option value="__uncategorized">Uncategorized</option>}{categories.map(value => <option key={value} value={value}>{value}</option>)}
    </select>
    {presentation === 'checkbox-list' ? <div id={id} tabIndex={-1} role="group" aria-label={ariaLabel} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy} className="max-h-60 overflow-y-auto rounded border p-2">
      {options.length ? options.map(option => <label key={option.value} className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" disabled={disabled} className="shrink-0" checked={selected.includes(option.value)} onChange={event => onChange(event.target.checked ? [...new Set([...selected, option.value])] : selected.filter(value => value !== option.value))} />
        <span className="min-w-0 [overflow-wrap:anywhere]">{option.label}</span>
      </label>) : <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
    </div> : <CheckboxDropdownSelect id={id} values={values} options={options} onChange={onChange} disabled={disabled} single={single} searchable={searchable} ariaLabel={ariaLabel} ariaInvalid={ariaInvalid} ariaDescribedBy={ariaDescribedBy} contentAriaLabel="Product interests" placeholder="Select product interests…" emptyMessage={emptyMessage} />}
  </div>;
}

export function CatalogProductInterestSelect(props: Omit<Props, 'products'>) {
  const { products, categories, loading, error, refresh } = useProductInterests();
  return <><ProductInterestSelect {...props} products={products} categories={props.categories ?? categories} disabled={props.disabled || loading || !!error} />{error && <p role="alert" className="text-xs text-destructive">{error} <button type="button" onClick={refresh}>Retry products</button></p>}</>;
}
