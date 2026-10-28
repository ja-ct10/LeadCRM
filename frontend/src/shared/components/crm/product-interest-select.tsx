'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
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
  layout?: 'stacked' | 'paired';
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

const ProductFieldContext = React.createContext<{ label: string; id: string; error?: string } | null>(null);

/** Keeps the configured field label and its error attached to the actual picker. */
export function ProductInterestField({ label, htmlFor, error, children }: { label: string; htmlFor?: string; error?: string; children: React.ReactNode; fieldKey?: string }) {
  const generatedId = React.useId();
  const id = htmlFor ?? generatedId;
  return <ProductFieldContext.Provider value={{ label, id, error }}>
    <div className="min-w-0 space-y-1.5 sm:col-span-2">
      {children}
      {error && <p role="alert" id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
    </div>
  </ProductFieldContext.Provider>;
}

/** The default presentation and name-mode payloads remain compatible with existing consumers. */
export function ProductInterestSelect({ id, values, onChange, products, categories: catalogCategories, showUncategorized = true, valueMode = 'id', disabled, single = false, labels = {}, ariaLabel, searchable = false, presentation = 'dropdown', layout, ariaInvalid, ariaDescribedBy }: Props) {
  const field = React.useContext(ProductFieldContext);
  const [category, setCategory] = React.useState('');
  const categoryId = React.useId();
  const generatedId = React.useId();
  const productId = id ?? field?.id ?? generatedId;
  const paired = (layout ?? (field ? 'paired' : 'stacked')) === 'paired';
  const displayLabel = field?.label ?? ariaLabel ?? 'Product Interest';
  const required = displayLabel.endsWith(' *');
  const plainLabel = required ? displayLabel.slice(0, -2) : displayLabel;
  const productAriaLabel = ariaLabel ?? plainLabel;
  const invalid = ariaInvalid ?? !!field?.error;
  const description = ariaDescribedBy ?? (field?.error ? `${field.id}-error` : undefined);
  const categories = [...new Set((catalogCategories ?? products.map(product => product.category).filter((value): value is string => !!value)).filter(value => value.trim().length > 0))].sort();
  const selected = [...new Set(values)];
  const options = products.filter(product => !category || (category === '__uncategorized' ? !product.category : product.category === category)).map(product => ({ value: valueMode === 'id' ? product.id : product.name, label: product.name }));
  if (presentation === 'dropdown') for (const value of selected) if (!options.some(option => option.value === value)) options.push({ value, label: products.find(product => (valueMode === 'id' ? product.id : product.name) === value)?.name || labels[value] || (valueMode === 'name' ? value : 'Unavailable product') });
  const emptyMessage = category ? 'No products match this category.' : 'No configured Product Interests.';
  const picker = presentation === 'checkbox-list' ? <div id={productId} tabIndex={-1} role="group" aria-label={productAriaLabel} aria-invalid={invalid} aria-describedby={description} className="max-h-60 overflow-y-auto rounded border p-2">
    {options.length ? options.map(option => <label key={option.value} className="flex min-h-10 items-center gap-2 text-sm">
      <input type="checkbox" disabled={disabled} className="shrink-0" checked={selected.includes(option.value)} onChange={event => onChange(event.target.checked ? [...new Set([...selected, option.value])] : selected.filter(value => value !== option.value))} />
      <span className="min-w-0 [overflow-wrap:anywhere]">{option.label}</span>
    </label>) : <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
  </div> : <CheckboxDropdownSelect id={productId} values={values} options={options} onChange={onChange} disabled={disabled} single={single} searchable={searchable} ariaLabel={productAriaLabel} ariaInvalid={invalid} ariaDescribedBy={description} matchTriggerWidth={paired} contentAriaLabel="Product interests" placeholder="Select product interests…" emptyMessage={emptyMessage} />;
  const categoryControl = <select id={categoryId} aria-label="Product category filter" className={paired ? 'min-h-11 w-full min-w-0 appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50' : 'min-h-10 w-full min-w-0 max-w-full rounded-lg border border-border bg-background px-3 text-sm'} disabled={disabled} value={category} onChange={event => setCategory(event.target.value)}>
    <option value="">All categories</option>{showUncategorized && <option value="__uncategorized">Uncategorized</option>}{categories.map(value => <option key={value} value={value}>{value}</option>)}
  </select>;

  if (!paired) return <div className="min-w-0 space-y-2">
    <label className="block text-xs text-muted-foreground" htmlFor={categoryId}>Product category</label>
    {categoryControl}{picker}
  </div>;

  return <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
    <label htmlFor={categoryId} className="order-1 block text-xs font-semibold text-muted-foreground">Product Category</label>
    <div className="relative order-2 min-w-0 sm:order-3">{categoryControl}<ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>
    <label htmlFor={productId} className="order-3 mt-2 block text-xs font-semibold text-muted-foreground sm:order-2 sm:mt-0">{plainLabel}{required && <span aria-hidden="true" className="text-destructive"> *</span>}</label>
    <div className="order-4 min-w-0">{picker}</div>
  </div>;
}

export function CatalogProductInterestSelect({ onCatalog, ...props }: Omit<Props, 'products'> & { onCatalog?: (products: ProductInterest[]) => void }) {
  const { products, categories, loading, error, refresh } = useProductInterests();
  React.useEffect(() => { onCatalog?.(products); }, [products, onCatalog]);
  return <><ProductInterestSelect {...props} products={products} categories={props.categories ?? categories} disabled={props.disabled || loading || !!error} />{error && <p role="alert" className="text-xs text-destructive">{error} <button type="button" onClick={refresh}>Retry products</button></p>}</>;
}
