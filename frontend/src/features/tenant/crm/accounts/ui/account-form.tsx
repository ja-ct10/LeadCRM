'use client';

import React, { useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useData } from '@/store/DataContext';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { useScrollToError } from '@/shared/hooks/use-scroll-to-error';
import {
  AlertCircle,
  ChevronDown,
  X,
  Globe,
  MapPin,
  Building2,
} from 'lucide-react';
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  COMPANY_SIZE_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  type AccountFormValues,
} from '../schemas/account.schema';
import { COMPANY_INDUSTRIES } from '../constants/account.constants';
import type { Account } from '../types/account.types';

// ─── Constants ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  'CCTV',
  'Biometrics',
  'Door Access',
  'Door access/Biometrics',
  'Network/Structured Cabling',
  'FDAS',
  'PABX',
  'PC/Laptop/Server Assembly',
  'Software/Web Development',
  'Others',
];

// ─── Props ─────────────────────────────────────────────────────────────────

interface AccountFormSheetProps {
  initialData?: Account | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Account>) => void;
}

interface AccountFormInnerProps {
  initialData?: Account | null;
  onSave: (data: Partial<Account>) => void;
  onCancel: () => void;
}

// ─── Form Component ────────────────────────────────────────────────────────

export function AccountFormInner({ initialData, onSave, onCancel }: AccountFormInnerProps): React.ReactElement {
  const { users } = useData();
  const isEdit = !!initialData;

  // Map initialData to form values matching CreateCompanySchema
  const defaultValues = useMemo((): AccountFormValues => ({
    name: initialData?.name || '',
    industry: initialData?.industry || '',
    size: (initialData?.size as AccountFormValues['size']) || '',
    website: initialData?.website || '',
    taxId: initialData?.taxId || '',
    tags: initialData?.tags || [],
    address: initialData?.address || '',
    city: initialData?.city || '',
    province: initialData?.province || '',
    country: 'Philippines',
    assignedUserId: initialData?.assignedUserId || '',
    notes: initialData?.notes || '',
    internalNotes: initialData?.internalNotes || '',
    productInterests: initialData?.productInterests || [],
    customerType: (initialData?.customerType as AccountFormValues['customerType']) || '',
    customerSince: initialData?.customerSince || '',
    activeProducts: initialData?.activeProducts || [],
  }), [initialData]);

  const schema = isEdit ? UpdateAccountSchema : CreateAccountSchema;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    setFocus,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues,
    mode: 'onBlur',
  });

  // Scroll to first error on submit
  const fieldId = React.useId();
  const formRef = useRef<HTMLFormElement>(null);
  useScrollToError({ errors, formRef, setFocus });

  const taxId = watch('taxId') ?? '';
  const setTaxId = (value: string): void => {
    setValue('taxId', value.replace(/[^0-9]/g, '').slice(0, 9), { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  const selectedProducts = watch('productInterests') || [];
  const selectedActiveProducts = watch('activeProducts') || [];

  const onSubmit = (data: AccountFormValues): void => {
    // Build payload matching backend CreateCompanySchema field names
    const payload: Partial<Account> = {
      name: data.name || undefined,
      industry: data.industry || undefined,
      size: data.size || undefined,
      website: data.website || undefined,
      taxId: data.taxId ?? '',
      tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      province: data.province || undefined,
      country: 'Philippines',
      assignedUserId: data.assignedUserId || undefined,
      notes: data.notes || undefined,
      internalNotes: data.internalNotes || undefined,
      productInterests: data.productInterests && data.productInterests.length > 0 ? data.productInterests : undefined,
      customerType: data.customerType || undefined,
      customerSince: data.customerSince || undefined,
      activeProducts: data.activeProducts && data.activeProducts.length > 0 ? data.activeProducts : undefined,
    };

    onSave(payload);
  };

  // Product interest management
  const toggleProductInterest = (product: string): void => {
    const current = selectedProducts;
    if (current.includes(product)) {
      setValue('productInterests', current.filter((p) => p !== product), { shouldValidate: true });
    } else {
      setValue('productInterests', [...current, product], { shouldValidate: true });
    }
  };

  const removeProductInterest = (product: string): void => {
    setValue(
      'productInterests',
      selectedProducts.filter((p) => p !== product),
      { shouldValidate: true },
    );
  };

  // Active products management
  const toggleActiveProduct = (product: string): void => {
    const current = selectedActiveProducts;
    if (current.includes(product)) {
      setValue('activeProducts', current.filter((p) => p !== product), { shouldValidate: true });
    } else {
      setValue('activeProducts', [...current, product], { shouldValidate: true });
    }
  };

  const removeActiveProduct = (product: string): void => {
    setValue(
      'activeProducts',
      selectedActiveProducts.filter((p) => p !== product),
      { shouldValidate: true },
    );
  };

  // Style classes
  const inputCls =
    'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500';
  const inputErrorCls = '!border-red-500 focus:!ring-red-500/20';
  const selectCls =
    'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl pl-3.5 pr-8 py-2.5 text-sm text-slate-900 dark:text-white outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all [&>option]:bg-white dark:[&>option]:bg-slate-900';

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full" noValidate>
      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <SectionHeader num={1} title="Basic Information" />

          {/* Account Name (required) */}
          <FieldWrap label="Account Name *" htmlFor={`${fieldId}-name`} error={errors.name?.message}>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                {...register('name')}
                id={`${fieldId}-name`}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${fieldId}-name-error` : undefined}
                className={`${inputCls} pl-9 ${errors.name ? inputErrorCls : ''}`}
                placeholder="Enter account name"
              />
            </div>
          </FieldWrap>

          {/* Industry & Size */}
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Industry" htmlFor={`${fieldId}-industry`} error={errors.industry?.message}>
              <div className="relative">
                <select
                  {...register('industry')}
                  id={`${fieldId}-industry`}
                  aria-invalid={!!errors.industry}
                  aria-describedby={errors.industry ? `${fieldId}-industry-error` : undefined}
                  className={`${selectCls} ${errors.industry ? inputErrorCls : ''}`}
                >
                  <option value="">Select industry</option>
                  {COMPANY_INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
            <FieldWrap label="Size" htmlFor={`${fieldId}-size`} error={errors.size?.message}>
              <div className="relative">
                <select
                  {...register('size')}
                  id={`${fieldId}-size`}
                  aria-invalid={!!errors.size}
                  aria-describedby={errors.size ? `${fieldId}-size-error` : undefined}
                  className={`${selectCls} ${errors.size ? inputErrorCls : ''}`}
                >
                  <option value="">Select size</option>
                  {COMPANY_SIZE_OPTIONS.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
          </div>

          {/* Website & Tax ID */}
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Website" htmlFor={`${fieldId}-website`} error={errors.website?.message}>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="url"
                  {...register('website')}
                  id={`${fieldId}-website`}
                  aria-invalid={!!errors.website}
                  aria-describedby={errors.website ? `${fieldId}-website-error` : undefined}
                  className={`${inputCls} pl-9 ${errors.website ? inputErrorCls : ''}`}
                  placeholder="https://company.com"
                />
              </div>
            </FieldWrap>
            <FieldWrap label="Tax ID" htmlFor={`${fieldId}-taxId`} error={errors.taxId?.message}>
              <input
                {...register('taxId')}
                type="text" inputMode="numeric" maxLength={9}
                value={taxId}
                onChange={(event) => setTaxId(event.target.value)}
                onPaste={(event) => {
                  event.preventDefault();
                  const input = event.currentTarget;
                  const pasted = event.clipboardData.getData('text').replace(/[^0-9]/g, '');
                  const start = input.selectionStart ?? taxId.length;
                  const end = input.selectionEnd ?? start;
                  const insertion = pasted.slice(0, 9 - (taxId.length - (end - start)));
                  setTaxId(taxId.slice(0, start) + insertion + taxId.slice(end));
                }}
                id={`${fieldId}-taxId`}
                aria-invalid={!!errors.taxId}
                aria-describedby={errors.taxId ? `${fieldId}-taxId-error` : undefined}
                className={`${inputCls} ${errors.taxId ? inputErrorCls : ''}`}
                placeholder="123456789"
              />
            </FieldWrap>
          </div>
        </div>

        {/* Section 2: Customer Classification */}
        <div className="space-y-4">
          <SectionHeader num={2} title="Customer Classification" />

          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Customer Type" htmlFor={`${fieldId}-customerType`} error={errors.customerType?.message}>
              <div className="relative">
                <select
                  {...register('customerType')}
                  id={`${fieldId}-customerType`}
                  aria-invalid={!!errors.customerType}
                  aria-describedby={errors.customerType ? `${fieldId}-customerType-error` : undefined}
                  className={`${selectCls} ${errors.customerType ? inputErrorCls : ''}`}
                >
                  <option value="">Select type</option>
                  {CUSTOMER_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
            <FieldWrap label="Customer Since" htmlFor={`${fieldId}-customerSince`} error={errors.customerSince?.message}>
              <input
                type="date"
                {...register('customerSince')}
                id={`${fieldId}-customerSince`}
                aria-invalid={!!errors.customerSince}
                aria-describedby={errors.customerSince ? `${fieldId}-customerSince-error` : undefined}
                className={`${inputCls} ${errors.customerSince ? inputErrorCls : ''}`}
              />
            </FieldWrap>
          </div>
        </div>

        {/* Section 3: Address */}
        <div className="space-y-4">
          <SectionHeader num={3} title="Address" />

          <FieldWrap label="Street Address" htmlFor={`${fieldId}-address`} error={errors.address?.message}>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 text-slate-400" size={14} />
              <textarea
                {...register('address')}
                id={`${fieldId}-address`}
                aria-invalid={!!errors.address}
                aria-describedby={errors.address ? `${fieldId}-address-error` : undefined}
                rows={2}
                className={`w-full pl-9 pr-4 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none ${errors.address ? inputErrorCls : ''}`}
                placeholder="123 Main Street, Suite 100"
              />
            </div>
          </FieldWrap>

          <div className="grid grid-cols-3 gap-4">
            <FieldWrap label="City" htmlFor={`${fieldId}-city`} error={errors.city?.message}>
              <input
                {...register('city')}
                id={`${fieldId}-city`}
                aria-invalid={!!errors.city}
                aria-describedby={errors.city ? `${fieldId}-city-error` : undefined}
                className={`${inputCls} ${errors.city ? inputErrorCls : ''}`}
                placeholder="Makati City"
              />
            </FieldWrap>
            <FieldWrap label="Province" htmlFor={`${fieldId}-province`} error={errors.province?.message}>
              <input
                {...register('province')}
                id={`${fieldId}-province`}
                aria-invalid={!!errors.province}
                aria-describedby={errors.province ? `${fieldId}-province-error` : undefined}
                className={`${inputCls} ${errors.province ? inputErrorCls : ''}`}
                placeholder="Metro Manila"
              />
            </FieldWrap>
            <FieldWrap label="Country" htmlFor={`${fieldId}-country`} error={errors.country?.message}>
              <input
                value="Philippines" readOnly
                id={`${fieldId}-country`}
                aria-invalid={!!errors.country}
                aria-describedby={errors.country ? `${fieldId}-country-error` : undefined}
                className={`${inputCls} ${errors.country ? inputErrorCls : ''}`}
                placeholder="Philippines"
              />
            </FieldWrap>
          </div>
        </div>

        {/* Section 4: Relationships */}
        <div className="space-y-4">
          <SectionHeader num={4} title="Relationships" />

          {/* Assigned User */}
          <FieldWrap label="Assigned Agent" htmlFor={`${fieldId}-assignedUserId`} error={errors.assignedUserId?.message}>
            <div className="relative">
              <select
                {...register('assignedUserId')}
                id={`${fieldId}-assignedUserId`}
                aria-invalid={!!errors.assignedUserId}
                aria-describedby={errors.assignedUserId ? `${fieldId}-assignedUserId-error` : undefined}
                className={`${selectCls} ${errors.assignedUserId ? inputErrorCls : ''}`}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
            </div>
          </FieldWrap>
        </div>

        {/* Section 5: Products & Interests */}
        <div className="space-y-4">
          <SectionHeader num={5} title="Products & Interests" />

          {/* Product Interests (multi-select chips) */}
          <FieldWrap label="Product Interests">
            <div className="space-y-2">
              {/* Selected chips */}
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedProducts.map((product) => (
                    <span
                      key={product}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-500/20"
                    >
                      {product}
                      <button
                        type="button"
                        onClick={() => removeProductInterest(product)}
                        className="ml-0.5 text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 rounded-sm p-0.5 transition-colors"
                        aria-label={`Remove ${product}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Product dropdown */}
              <div className="relative">
                <select
                  className={selectCls}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      toggleProductInterest(e.target.value);
                    }
                  }}
                >
                  <option value="">Add a product interest...</option>
                  {PRODUCTS.filter((p) => !selectedProducts.includes(p)).map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </div>
          </FieldWrap>

          {/* Active Products (multi-select chips) */}
          <FieldWrap label="Active Products">
            <div className="space-y-2">
              {/* Selected chips */}
              {selectedActiveProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedActiveProducts.map((product) => (
                    <span
                      key={product}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 rounded-md border border-green-200 dark:border-green-500/20"
                    >
                      {product}
                      <button
                        type="button"
                        onClick={() => removeActiveProduct(product)}
                        className="ml-0.5 text-green-400 hover:text-green-600 dark:hover:text-green-200 rounded-sm p-0.5 transition-colors"
                        aria-label={`Remove ${product}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Product dropdown */}
              <div className="relative">
                <select
                  className={selectCls}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      toggleActiveProduct(e.target.value);
                    }
                  }}
                >
                  <option value="">Add an active product...</option>
                  {PRODUCTS.filter((p) => !selectedActiveProducts.includes(p)).map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </div>
          </FieldWrap>
        </div>

        {/* Section 6: Notes */}
        <div className="space-y-4">
          <SectionHeader num={6} title="Notes" />

          <FieldWrap label="Notes" htmlFor={`${fieldId}-notes`} error={errors.notes?.message}>
            <textarea
              {...register('notes')}
              id={`${fieldId}-notes`}
              aria-invalid={!!errors.notes}
              aria-describedby={errors.notes ? `${fieldId}-notes-error` : undefined}
              rows={3}
              className={`w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none ${errors.notes ? inputErrorCls : ''}`}
              placeholder="General notes about this account..."
            />
          </FieldWrap>

          <FieldWrap label="Internal Notes" htmlFor={`${fieldId}-internalNotes`} error={errors.internalNotes?.message}>
            <textarea
              {...register('internalNotes')}
              id={`${fieldId}-internalNotes`}
              aria-invalid={!!errors.internalNotes}
              aria-describedby={errors.internalNotes ? `${fieldId}-internalNotes-error` : undefined}
              rows={3}
              className={`w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none ${errors.internalNotes ? inputErrorCls : ''}`}
              placeholder="Internal-only notes (not visible to the client)..."
            />
          </FieldWrap>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-white/[0.06] bg-white dark:bg-slate-900 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-white/[0.08] rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Account'}
        </button>
      </div>
    </form>
  );
}

// ─── Sheet Wrapper ─────────────────────────────────────────────────────────

export function AccountFormSheet({ initialData, isOpen, onClose, onSave }: AccountFormSheetProps): React.ReactElement {
  return (
    <SlidingDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Account' : 'New Account'}
      subtitle="Complete the account details below."
    >
      <AccountFormInner initialData={initialData} onSave={onSave} onCancel={onClose} />
    </SlidingDrawer>
  );
}

// ─── Default Export (backward compatibility) ───────────────────────────────

export default function AccountForm({ initial, onSubmit, onCancel }: {
  initial?: Account | null;
  onSubmit: (data: Partial<Account>) => void;
  onCancel: () => void;
}): React.ReactElement {
  return <AccountFormInner initialData={initial} onSave={onSubmit} onCancel={onCancel} />;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: number; title: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-[11px] font-bold shrink-0">
        {num}
      </div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">{title}</h3>
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.06]" />
    </div>
  );
}

function FieldWrap({ label, error, htmlFor, children }: { label: string; error?: string; htmlFor?: string; children: React.ReactNode }): React.ReactElement {
  const isRequired = label.endsWith(' *');
  const displayText = isRequired ? label.slice(0, -2) : label;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
        <span>{displayText}{isRequired && <span className="text-red-500"> *</span>}</span>
      </label>
      {children}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}
