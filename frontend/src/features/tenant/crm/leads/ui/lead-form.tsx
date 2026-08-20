'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lead } from '@/store/types';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { useData } from '@/store/DataContext';
import { useScrollToError } from '@/shared/hooks/use-scroll-to-error';
import {
  Mail,
  MapPin,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import {
  COUNTRY_CODES,
  getPlaceholderForCountryCode,
} from '@/lib/countries';

// ── Zod schemas mirroring backend CreateContactSchema / UpdateContactSchema ──
// Backend route POST /crm/leads validates against CreateContactSchema from contacts.dto.ts.

// Unified form schema — used for both Create and Edit.
// On create: firstName + lastName are required (min 1).
// On edit: all fields pre-populated, same constraints apply for non-empty values.
// Backend UpdateContactSchema makes all fields optional, but the form always
// sends populated values (pre-filled from initialData), so using the Create schema
// for validation is correct for both modes.
const LeadFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'Max 100 characters'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Max 100 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  status: z.string().min(1),
  source: z.string().optional(),
  accountId: z.string().optional(),
  assignedUserId: z.string().optional(),
  productInterest: z.array(z.string()).optional(),
  address: z.string().optional(),
});

type LeadFormData = z.infer<typeof LeadFormSchema>;

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

const STATUS_OPTIONS = [
  { value: 'Inquiry', label: 'Inquiry' },
  { value: 'Hot', label: 'Hot' },
  { value: 'Warm', label: 'Warm' },
  { value: 'Cold', label: 'Cold' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const SOURCE_OPTIONS = [
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

interface LeadFormProps {
  initialData?: Lead;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Lead>) => void;
}

interface AddLeadFormProps {
  initialData?: Lead;
  onSave: (data: Partial<Lead>) => void;
  onCancel: () => void;
}

export function AddLeadForm({ initialData, onSave, onCancel }: AddLeadFormProps) {
  const { users } = useData();
  const isEdit = !!initialData;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setFocus,
  } = useForm<LeadFormData>({
    resolver: zodResolver(LeadFormSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      companyName: '',
      status: 'Inquiry',
      source: '',
      accountId: '',
      assignedUserId: '',
      productInterest: [],
      address: '',
    },
  });

  // Product interest state (for custom dropdown UX)
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [customProduct, setCustomProduct] = useState<string>('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Phone helpers for country code splitting
  const [phoneCode, setPhoneCode] = useState('+63');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Scroll to first error on submit via shared hook
  const formRef = useRef<HTMLFormElement>(null);
  useScrollToError({ errors, formRef, setFocus });

  useEffect(() => {
    if (initialData) {
      const phone = initialData.phone || '';
      const matchedCode = COUNTRY_CODES.find((c) => phone.startsWith(c.code));
      const code = matchedCode ? matchedCode.code : '+63';
      let number = phone;
      if (matchedCode) {
        number = phone.startsWith(code + ' ')
          ? phone.substring(code.length + 1)
          : phone.substring(code.length);
      }
      setPhoneCode(code);
      setPhoneNumber(number);

      // Determine product interest from existing data
      const prod = initialData.productInterests?.[0] || initialData.productInterest?.[0] || '';
      if (prod) {
        const matched = PRODUCTS.find((p) => p.toLowerCase() === prod.toLowerCase());
        if (matched) {
          setSelectedProduct(matched);
          setCustomProduct('');
        } else {
          setSelectedProduct('Others');
          setCustomProduct(prod);
        }
      }

      reset({
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        email: initialData.email || '',
        phone: phone,
        companyName: initialData.companyName || '',
        status: initialData.status || 'Inquiry',
        source: initialData.leadSource || initialData.source || '',
        accountId: initialData.accountId || initialData.organizationId || '',
        assignedUserId: initialData.assignedUserId || '',
        productInterest: initialData.productInterests || initialData.productInterest || [],
        address: initialData.address || '',
      });
    } else {
      setSelectedProduct('');
      setCustomProduct('');
      setPhoneCode('+63');
      setPhoneNumber('');
      reset({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        companyName: '',
        status: 'Inquiry',
        source: '',
        accountId: '',
        assignedUserId: '',
        productInterest: [],
        address: '',
      });
    }
  }, [initialData, reset]);

  const onFormSubmit = (data: LeadFormData): void => {
    // Build phone from code + number
    const fullPhone = phoneNumber ? `${phoneCode} ${phoneNumber}`.trim() : '';

    // Build productInterest array
    const finalProduct = selectedProduct === 'Others' ? customProduct : selectedProduct;
    const productInterest = finalProduct ? [finalProduct] : [];

    // Build payload matching backend CreateContactSchema field names exactly.
    // No phantom fields — adapter handles any remaining mapping.
    const payload: Partial<Lead> = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || undefined,
      phone: fullPhone || undefined,
      companyName: data.companyName || undefined,
      status: data.status || 'Inquiry',
      source: data.source || undefined,
      accountId: data.accountId || undefined,
      assignedUserId: data.assignedUserId || undefined,
      productInterest: productInterest,
      address: data.address || undefined,
    };

    onSave(payload);
  };

  // Shared field classes
  const inputCls = 'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
  const selectCls = 'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl pl-3.5 pr-8 py-2.5 text-sm text-slate-900 dark:text-white outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all [&>option]:bg-white dark:[&>option]:bg-slate-900';
  const errorInputCls = '!border-red-500 focus:!ring-red-500/20';

  return (
    <form ref={formRef} onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col h-full" noValidate>
      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <SectionHeader num={1} title="Basic Information" />
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="First Name *" error={errors.firstName?.message}>
              <input
                {...register('firstName')}
                className={`${inputCls}${errors.firstName ? ` ${errorInputCls}` : ''}`}
                placeholder="Enter first name"
              />
            </FieldWrap>
            <FieldWrap label="Last Name *" error={errors.lastName?.message}>
              <input
                {...register('lastName')}
                className={`${inputCls}${errors.lastName ? ` ${errorInputCls}` : ''}`}
                placeholder="Enter last name"
              />
            </FieldWrap>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Email" error={errors.email?.message}>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="email"
                  {...register('email')}
                  className={`${inputCls} pl-9${errors.email ? ` ${errorInputCls}` : ''}`}
                  placeholder="email@example.com"
                />
              </div>
            </FieldWrap>
            <FieldWrap label="Phone">
              <div className="flex bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 overflow-hidden text-sm transition-all">
                <div className="relative border-r border-gray-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] flex items-center shrink-0 w-[90px]">
                  <select
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    className="w-full h-full py-2.5 pl-2.5 pr-6 bg-transparent text-slate-900 dark:text-slate-100 border-none outline-none appearance-none cursor-pointer text-xs [&>option]:text-slate-900 [&>option]:bg-white dark:[&>option]:text-white dark:[&>option]:bg-slate-800"
                  >
                    <option value="" disabled>Code</option>
                    {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
                <input
                  type="tel"
                  placeholder={getPlaceholderForCountryCode(phoneCode)}
                  className="flex-1 px-3 py-2.5 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 text-slate-900 dark:text-white min-w-0 text-sm"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            </FieldWrap>
          </div>
          <FieldWrap label="Company Name">
            <input
              {...register('companyName')}
              className={inputCls}
              placeholder="Enter company name"
            />
          </FieldWrap>
        </div>

        {/* Section 2: Status & Interest */}
        <div className="space-y-4">
          <SectionHeader num={2} title="Status & Interest" />
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Status">
              <div className="relative">
                <select
                  {...register('status')}
                  className={selectCls}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
            <FieldWrap label="Product Interest">
              <div className="space-y-2">
                <div className="relative">
                  <div
                    className={`${inputCls} flex items-center justify-between cursor-pointer select-none`}
                    onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                  >
                    <span className={selectedProduct ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                      {selectedProduct || 'Select product...'}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {isProductDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsProductDropdownOpen(false)} />
                      <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-xl shadow-blue-900/5 dark:shadow-black/40 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto">
                        {PRODUCTS.map((p) => (
                          <div
                            key={p}
                            className={`px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${selectedProduct === p ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}
                            onClick={() => {
                              setSelectedProduct(p);
                              setIsProductDropdownOpen(false);
                            }}
                          >
                            {p}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {selectedProduct === 'Others' && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <input
                      type="text"
                      autoFocus
                      className="w-full bg-white dark:bg-white/[0.04] border border-blue-400 dark:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm shadow-blue-500/10"
                      placeholder="Specify product or service"
                      value={customProduct}
                      onChange={(e) => setCustomProduct(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </FieldWrap>
          </div>
        </div>

        {/* Section 3: Additional Information */}
        <div className="space-y-4">
          <SectionHeader num={3} title="Additional Information" />
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Lead Source">
              <div className="relative">
                <select
                  {...register('source')}
                  className={selectCls}
                >
                  <option value="">Select source...</option>
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
            <FieldWrap label="Assigned Agent">
              <div className="relative">
                <select
                  {...register('assignedUserId')}
                  className={selectCls}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
          </div>
          <FieldWrap label="Full Address">
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 text-slate-400" size={14} />
              <textarea
                {...register('address')}
                rows={3}
                className="w-full pl-9 pr-4 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none overflow-hidden"
                placeholder="123 Main St, Apt 4B, City, State, Zip Code"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight + 2}px`;
                }}
              />
            </div>
          </FieldWrap>
        </div>

      </div>{/* end scrollable body */}

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
          className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl transition-all shadow-lg shadow-blue-500/25"
        >
          {isEdit ? 'Save Changes' : 'Create Lead'}
        </button>
      </div>
    </form>
  );
}

// ── Small reusable helpers ─────────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: number; title: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">
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

// ── Sheet wrapper ──────────────────────────────────────────────────────────────

export function LeadFormSheet({ initialData, isOpen, onClose, onSave }: LeadFormProps): React.ReactElement {
  return (
    <SlidingDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Lead' : 'New Lead'}
      subtitle="Complete the lead details below."
    >
      <AddLeadForm initialData={initialData} onSave={onSave} onCancel={onClose} />
    </SlidingDrawer>
  );
}
