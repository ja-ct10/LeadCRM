'use client';

import React, { useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useData } from '@/store/DataContext';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { useScrollToError } from '@/shared/hooks/use-scroll-to-error';
import { toast } from 'sonner';
import {
  Mail,
  MapPin,
  AlertCircle,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  CreateContactFormSchema,
  UpdateContactFormSchema,
  type CreateContactFormValues,
  type UpdateContactFormValues,
} from '../schemas/contact-form.schema';
import type { Contact } from '@/store/types';

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

const SOURCES = [
  'Google Ads',
  'Referral',
  'Email Campaign',
  'Website',
  'LinkedIn Ads',
  'Webinar',
  'Social Media Advertisement',
  'Partner Referral',
  'Direct Mail',
  'Cold Call',
  'Content Marketing',
  'YouTube Ads',
  'SEO / Organic Search',
  'Others',
];

const STATUS_OPTIONS = [
  { value: 'Inquiry', label: 'Inquiry' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Hot', label: 'Hot' },
  { value: 'Warm', label: 'Warm' },
  { value: 'Cold', label: 'Cold' },
];

// ─── Props ─────────────────────────────────────────────────────────────────

interface ContactFormProps {
  initialData?: Contact;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Contact>) => void;
}

interface ContactFormInnerProps {
  initialData?: Contact;
  onSave: (data: Partial<Contact>) => void;
  onCancel: () => void;
}

// ─── Form Component ────────────────────────────────────────────────────────

export function ContactFormInner({ initialData, onSave, onCancel }: ContactFormInnerProps): React.ReactElement {
  const { users } = useData();
  const isEdit = !!initialData;

  // Map initialData to form values that match the backend schema
  const defaultValues = useMemo((): CreateContactFormValues => ({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    companyName: initialData?.companyName || '',
    status: initialData?.status || 'Inquiry',
    source: initialData?.leadSource || '',
    accountId: initialData?.organizationId || '',
    assignedUserId: initialData?.assignedUserId || '',
    productInterest: initialData?.productInterests || initialData?.productInterest || [],
    address: initialData?.address || '',
  }), [initialData]);

  // UpdateContactFormSchema makes firstName/lastName optional; the form still uses
  // CreateContactFormValues shape for field registration. Cast is safe because both
  // schemas share the same field keys — only required/optional differs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema = isEdit ? UpdateContactFormSchema : CreateContactFormSchema;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    setFocus,
  } = useForm<CreateContactFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RHF v7.82 + resolvers v5.4 type mismatch
    resolver: zodResolver(schema) as never,
    defaultValues,
    mode: 'onBlur',
  });

  // Scroll to first error on submit
  const formRef = useRef<HTMLFormElement>(null);
  useScrollToError({ errors, formRef, setFocus });

  const selectedProducts = watch('productInterest') || [];

  const onSubmit = (data: CreateContactFormValues | UpdateContactFormValues): void => {
    // Build payload using frontend Contact type field names.
    // The adapter (toBackendCreateContact/toBackendUpdateContact) handles
    // mapping to backend DTO names (e.g. leadSource → source, productInterest → productInterest).
    const cleaned: Partial<Contact> = {
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      companyName: data.companyName || undefined,
      status: data.status || 'Inquiry',
      leadSource: data.source || undefined,
      assignedUserId: data.assignedUserId || undefined,
      productInterest: data.productInterest || [],
      address: data.address || undefined,
    };

    // Pass accountId through directly — adapter maps it correctly
    if (data.accountId) {
      (cleaned as Record<string, unknown>).accountId = data.accountId;
    }

    onSave(cleaned);
  };

  // Product interest management
  const toggleProduct = (product: string): void => {
    const current = selectedProducts;
    if (current.includes(product)) {
      setValue('productInterest', current.filter((p) => p !== product), { shouldValidate: true });
    } else {
      setValue('productInterest', [...current, product], { shouldValidate: true });
    }
  };

  const removeProduct = (product: string): void => {
    setValue(
      'productInterest',
      selectedProducts.filter((p) => p !== product),
      { shouldValidate: true },
    );
  };

  // Style classes
  const inputCls =
    'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
  const inputErrorCls = '!border-red-500 focus:!ring-red-500/20';
  const selectCls =
    'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl pl-3.5 pr-8 py-2.5 text-sm text-slate-900 dark:text-white outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all [&>option]:bg-white dark:[&>option]:bg-slate-900';

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full" noValidate>
      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <SectionHeader num={1} title="Basic Information" />

          {/* First & Last Name (required) */}
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="First Name *" error={errors.firstName?.message}>
              <input
                {...register('firstName')}
                className={`${inputCls} ${errors.firstName ? inputErrorCls : ''}`}
                placeholder="Enter first name"
              />
            </FieldWrap>
            <FieldWrap label="Last Name *" error={errors.lastName?.message}>
              <input
                {...register('lastName')}
                className={`${inputCls} ${errors.lastName ? inputErrorCls : ''}`}
                placeholder="Enter last name"
              />
            </FieldWrap>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Email" error={errors.email?.message}>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="email"
                  {...register('email')}
                  className={`${inputCls} pl-9 ${errors.email ? inputErrorCls : ''}`}
                  placeholder="email@example.com"
                />
              </div>
            </FieldWrap>
            <FieldWrap label="Phone" error={errors.phone?.message}>
              <input
                type="tel"
                {...register('phone')}
                className={`${inputCls} ${errors.phone ? inputErrorCls : ''}`}
                placeholder="+63 912 345 6789"
              />
            </FieldWrap>
          </div>

          {/* Company Name */}
          <FieldWrap label="Company Name" error={errors.companyName?.message}>
            <input
              {...register('companyName')}
              className={`${inputCls} ${errors.companyName ? inputErrorCls : ''}`}
              placeholder="Company or organization name"
            />
          </FieldWrap>
        </div>

        {/* Section 2: Status & Classification */}
        <div className="space-y-4">
          <SectionHeader num={2} title="Status & Classification" />

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <FieldWrap label="Status" error={errors.status?.message}>
              <div className="relative">
                <select
                  {...register('status')}
                  className={`${selectCls} ${errors.status ? inputErrorCls : ''}`}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>

            {/* Source */}
            <FieldWrap label="Source" error={errors.source?.message}>
              <div className="relative">
                <select
                  {...register('source')}
                  className={`${selectCls} ${errors.source ? inputErrorCls : ''}`}
                >
                  <option value="">Select source...</option>
                  {SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
          </div>
        </div>

        {/* Section 3: Relationships */}
        <div className="space-y-4">
          <SectionHeader num={3} title="Relationships" />

          {/* Account (organization) selector */}
          <FieldWrap label="Account" error={errors.accountId?.message}>
            <Controller
              name="accountId"
              control={control}
              render={({ field }) => (
                <EntityCombobox
                  entityType="accounts"
                  value={field.value || null}
                  onChange={(id) => field.onChange(id || '')}
                  placeholder="Search accounts..."
                  error={errors.accountId?.message}
                />
              )}
            />
          </FieldWrap>

          {/* Assigned User */}
          <FieldWrap label="Assigned Agent" error={errors.assignedUserId?.message}>
            <div className="relative">
              <select
                {...register('assignedUserId')}
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

        {/* Section 4: Product Interest & Address */}
        <div className="space-y-4">
          <SectionHeader num={4} title="Additional Information" />

          {/* Product Interest (multi-select chips) */}
          <FieldWrap label="Product Interest">
            <div className="space-y-2">
              {/* Selected chips */}
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedProducts.map((product) => (
                    <span
                      key={product}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-500/20"
                    >
                      {product}
                      <button
                        type="button"
                        onClick={() => removeProduct(product)}
                        className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 rounded-sm p-0.5 transition-colors"
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
                      toggleProduct(e.target.value);
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

          {/* Address */}
          <FieldWrap label="Address" error={errors.address?.message}>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 text-slate-400" size={14} />
              <textarea
                {...register('address')}
                rows={3}
                className={`w-full pl-9 pr-4 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none ${errors.address ? inputErrorCls : ''}`}
                placeholder="123 Main St, City, State, Zip Code"
              />
            </div>
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
          className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Contact'}
        </button>
      </div>
    </form>
  );
}

// ─── Sheet Wrapper ─────────────────────────────────────────────────────────

export function ContactFormSheet({ initialData, isOpen, onClose, onSave }: ContactFormProps): React.ReactElement {
  return (
    <SlidingDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Contact' : 'New Contact'}
      subtitle="Complete the contact details below."
    >
      <ContactFormInner initialData={initialData} onSave={onSave} onCancel={onClose} />
    </SlidingDrawer>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: number; title: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-500 text-white text-[11px] font-bold shrink-0">
        {num}
      </div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">{title}</h3>
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.06]" />
    </div>
  );
}

function FieldWrap({ label, error, children }: { label: string; error?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
        <span>{label}</span>
        {error && <span className="text-red-500 font-normal text-[10px]">{error}</span>}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}
