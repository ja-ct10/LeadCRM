'use client';
import { PanelSectionHeading, panelBodyClass, panelFooterClass, panelInputClass, panelLabelClass, panelPrimaryButtonClass, panelSecondaryButtonClass } from '@/shared/components/side-panel-styles';
import { useState } from 'react';
import { isProductCreateAmountInput, ProductInterestCreateSchema, ProductInterestSchema, parseProductAmount, parseProductCreateAmount, PRODUCT_DEAL_VALUE_DIGITS_ERROR, PRODUCT_DEAL_VALUE_NEGATIVE_ERROR, PRODUCT_DEAL_VALUE_REQUIRED_ERROR, PRODUCT_INTEREST_NAME_MAX_ERROR, PRODUCT_INTEREST_NAME_MAX_LENGTH, PRODUCT_DESCRIPTION_MAX_LENGTH, type ProductInterest, type ProductInterestInput } from '@leadcrm/shared';
import { Button } from '@/shared/components/ui/button';
const inputClass = panelInputClass;
export function ProductEditor({ product, categories = [], busy, onSave, onCancel }: { product?: ProductInterest; categories?: string[]; busy: boolean; onSave: (data: ProductInterestInput) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category || product?.name || '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [addingCategory, setAddingCategory] = useState(false);
  const [amount, setAmount] = useState(product ? String(product.dealValue) : '');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; category?: string; description?: string; dealValue?: string }>({});
  return <form noValidate className="flex h-full min-h-0 flex-col" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    if (Object.values(fieldErrors).some(Boolean)) return;
    const dealValue = product ? parseProductAmount(amount) : parseProductCreateAmount(amount);
    const parsedName = ProductInterestSchema.shape.name.safeParse(name);
    const errors: { name?: string; category?: string; description?: string; dealValue?: string } = {};
    if (!parsedName.success) errors.name = parsedName.error.issues[0].message;
    if (dealValue === null) {
      errors.dealValue = amount.length === 0 || amount.trim().length === 0 ? PRODUCT_DEAL_VALUE_REQUIRED_ERROR : product ? 'Enter a non-negative amount with up to two decimal places.' : /^-\d+$/.test(amount) ? PRODUCT_DEAL_VALUE_NEGATIVE_ERROR : PRODUCT_DEAL_VALUE_DIGITS_ERROR;
      setFieldErrors(errors);
      return;
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    const parsed = (product ? ProductInterestSchema : ProductInterestCreateSchema).safeParse({ name, category, description, dealValue });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      return;
    }
    setFieldErrors({}); await onSave(parsed.data);
  }}>
    <div className={panelBodyClass + " space-y-4"}><PanelSectionHeading number={1}>Product Information</PanelSectionHeading><div className="grid grid-cols-1 gap-4 ">
      <label className={panelLabelClass + " min-w-0 space-y-1.5"}>Product Name {!product && <span aria-hidden="true" className="ml-1 text-red-500">*</span>}<input autoFocus aria-label="Product Name" className={`${inputClass} ${fieldErrors.name ? 'border-red-500' : ''}`} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'product-name-error' : undefined} value={name} disabled={busy} onChange={e => {
        const value = e.target.value;
        if (value.length > PRODUCT_INTEREST_NAME_MAX_LENGTH) {
          setFieldErrors(current => ({ ...current, name: PRODUCT_INTEREST_NAME_MAX_ERROR }));
          return;
        }
        setName(value);
        const result = ProductInterestSchema.shape.name.safeParse(value);
        setFieldErrors(current => ({ ...current, name: result.success ? '' : result.error.issues[0].message }));
      }} required />{fieldErrors.name && <span id="product-name-error" role="alert" className="block text-xs font-normal text-red-600">{fieldErrors.name}</span>}</label>
      <label className={panelLabelClass + " min-w-0 space-y-1.5"}>Category <span className="text-destructive">*</span>
        <select aria-label="Category" className={inputClass} required disabled={busy} value={addingCategory ? '__add__' : category} aria-invalid={!!fieldErrors.category} onChange={event => { const add = event.target.value === '__add__'; setAddingCategory(add); setCategory(add ? '' : event.target.value); setFieldErrors(current => ({ ...current, category: '' })); }}>
          <option value="">Select category</option>{[...new Set([...categories, ...(product ? [product.category || product.name] : [])])].map(label => <option key={label} value={label}>{label}</option>)}<option value="__add__">Add category…</option>
        </select>{fieldErrors.category && <span role="alert" className="block text-xs text-destructive">{fieldErrors.category}</span>}
      </label>
      {addingCategory && <label className={panelLabelClass + " min-w-0 space-y-1.5"}>New Category <span className="text-destructive">*</span><input aria-label="New Category" className={inputClass} required disabled={busy} maxLength={PRODUCT_INTEREST_NAME_MAX_LENGTH} value={category} onChange={event => { setCategory(event.target.value); setFieldErrors(current => ({ ...current, category: '' })); }} /></label>}
      <label className={panelLabelClass + " min-w-0 space-y-1.5"}>Product Description<textarea aria-label="Product Description" className={inputClass} rows={4} disabled={busy} maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH} value={description} onChange={event => { setDescription(event.target.value); setFieldErrors(current => ({ ...current, description: '' })); }} />{fieldErrors.description && <span role="alert" className="block text-xs text-destructive">{fieldErrors.description}</span>}</label>
      <label className={panelLabelClass + " min-w-0 space-y-1.5"}>Deal Value (PHP) {!product && <span aria-hidden="true" className="ml-1 text-red-500">*</span>}<span className="relative block"><span className="absolute left-3 top-3 text-sm">₱</span><input className={`${inputClass} pl-7 ${fieldErrors.dealValue ? 'border-red-500' : ''}`} aria-label="Deal Value (PHP)" aria-invalid={!!fieldErrors.dealValue} aria-describedby={fieldErrors.dealValue ? 'product-deal-value-error' : undefined} inputMode={product ? 'decimal' : 'numeric'} value={amount} disabled={busy} onChange={e => {
        const value = e.target.value;
        if (!product && !isProductCreateAmountInput(value)) {
          setFieldErrors(current => ({ ...current, dealValue: PRODUCT_DEAL_VALUE_DIGITS_ERROR }));
          return;
        }
        setAmount(value);
        const parsed = product ? parseProductAmount(value) : parseProductCreateAmount(value);
        const result = parsed === null ? undefined : (product ? ProductInterestSchema : ProductInterestCreateSchema).shape.dealValue.safeParse(parsed);
        setFieldErrors(current => ({ ...current, dealValue: parsed === null
          ? value.length === 0 || value.trim().length === 0 ? PRODUCT_DEAL_VALUE_REQUIRED_ERROR : product ? 'Enter a non-negative amount with up to two decimal places.' : /^-\d+$/.test(value) ? PRODUCT_DEAL_VALUE_NEGATIVE_ERROR : PRODUCT_DEAL_VALUE_DIGITS_ERROR
          : result?.success === false ? result.error.issues[0].message : '' }));
      }} required /></span>{fieldErrors.dealValue && <span id="product-deal-value-error" role="alert" className="block text-xs font-normal text-red-600">{fieldErrors.dealValue}</span>}</label>
    </div>
    </div><div className={panelFooterClass + " justify-end"}><Button type="button" variant="outline" className={panelSecondaryButtonClass} disabled={busy} onClick={onCancel}>Cancel</Button><Button type="submit" className={panelPrimaryButtonClass} disabled={busy}>{busy ? 'Saving…' : 'Save Product'}</Button></div>
  </form>;
}

