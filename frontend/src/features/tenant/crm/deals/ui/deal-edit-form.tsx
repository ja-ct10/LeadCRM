'use client';

import React, { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, MapPin, DollarSign, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/store/DataContext';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { DealAccountField } from './deal-account-field';
import { DealContactsField } from './deal-contacts-field';
import type { Deal } from '@/store/types';

// ── UpdateDealSchema — mirrors backend (CreateDealSchema minus stageId & pipelineId, all optional) ──

const id = () => z.string().min(1);

const UpdateDealFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Max 255 characters').optional(),
  value: z.number().positive('Value must be positive').optional().or(z.literal(0)).or(z.literal(undefined)),
  currency: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
  leadSource: z.string().optional(),
  organizationId: id().optional().or(z.literal('')),
  assignedUserId: id().optional().or(z.literal('')),
  contactIds: z.array(id()).optional(),
  industry: z.string().optional(),
  address: z.string().optional(),
  productInterests: z.array(z.string()).optional(),
});

type UpdateDealFormData = z.infer<typeof UpdateDealFormSchema>;

// ── Priority Options ────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

// ── Product Interest Options ────────────────────────────────────────────────

const PRODUCT_OPTIONS = [
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

// ── Props ───────────────────────────────────────────────────────────────────

interface DealEditFormProps {
  /** The deal record to edit — pre-populates the form */
  deal: Deal;
  /** Submit handler — receives the partial update payload */
  onSave: (data: Partial<UpdateDealFormData>) => void;
  /** Close/cancel handler */
  onCancel: () => void;
}

interface DealEditFormSheetProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<UpdateDealFormData>) => void;
}

// ── Main Form Component ─────────────────────────────────────────────────────

export function DealEditForm({ deal, onSave, onCancel }: DealEditFormProps): React.ReactElement {
  const { users } = useData();
  const canEdit = useHasPermission('deals.edit');

  const formRef = useRef<HTMLFormElement>(null);

  // Map deal priority to DTO enum format (deal uses 'Low'/'Medium'/'High', DTO uses 'LOW'/'MEDIUM'/'HIGH')
  const mapPriorityToDto = (priority?: string): 'LOW' | 'MEDIUM' | 'HIGH' => {
    if (!priority) return 'MEDIUM';
    const upper = priority.toUpperCase();
    if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH') return upper as 'LOW' | 'MEDIUM' | 'HIGH';
    return 'MEDIUM';
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setFocus,
  } = useForm<UpdateDealFormData>({
    resolver: zodResolver(UpdateDealFormSchema),
    defaultValues: {
      title: deal.title || '',
      value: deal.value || undefined,
      currency: 'PHP',
      priority: mapPriorityToDto(deal.priority),
      expectedCloseDate: deal.expectedCloseDate
        ? deal.expectedCloseDate.split('T')[0]
        : '',
      description: deal.description || '',
      leadSource: deal.leadSource || '',
      organizationId: deal.organizationId || deal.companyId || '',
      assignedUserId: deal.assignedUserId || '',
      contactIds: deal.contactIds || [],
      industry: deal.industry || '',
      address: deal.address || '',
      productInterests: deal.productInterests || [],
    },
  });

  // Scroll to first error field on submit
  useEffect(() => {
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey && formRef.current) {
      const field = formRef.current.querySelector(`[name="${firstErrorKey}"]`);
      if (field) {
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try {
          setFocus(firstErrorKey as keyof UpdateDealFormData);
        } catch { /* noop */ }
      }
    }
  }, [errors, setFocus]);

  const onFormSubmit = (data: UpdateDealFormData): void => {
    // Build payload — only send non-empty values
    const payload: Partial<UpdateDealFormData> = {};

    if (data.title) payload.title = data.title;
    if (data.value !== undefined && data.value !== 0) payload.value = data.value;
    if (data.currency) payload.currency = data.currency;
    if (data.priority) payload.priority = data.priority;
    if (data.expectedCloseDate) payload.expectedCloseDate = new Date(data.expectedCloseDate).toISOString();
    if (data.description) payload.description = data.description;
    if (data.leadSource) payload.leadSource = data.leadSource;
    if (data.organizationId) payload.organizationId = data.organizationId;
    if (data.assignedUserId) payload.assignedUserId = data.assignedUserId;
    if (data.contactIds && data.contactIds.length > 0) payload.contactIds = data.contactIds;
    if (data.industry) payload.industry = data.industry;
    if (data.address) payload.address = data.address;
    if (data.productInterests && data.productInterests.length > 0) payload.productInterests = data.productInterests;

    onSave(payload);
  };

  // Shared input class strings
  const inputCls = 'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
  const selectCls = 'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl pl-3.5 pr-8 py-2.5 text-sm text-slate-900 dark:text-white outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all [&>option]:bg-white dark:[&>option]:bg-slate-900';
  const errorInputCls = '!border-red-500 focus:!ring-red-500/20';

  return (
    <form ref={formRef} onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col h-full" noValidate>
      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Section 1: Deal Information */}
        <div className="space-y-4">
          <SectionHeader num={1} title="Deal Information" />

          <FieldWrap label="Deal Title *" error={errors.title?.message}>
            <input
              {...register('title')}
              className={cn(inputCls, errors.title && errorInputCls)}
              placeholder="Enter deal title"
              aria-required="true"
            />
          </FieldWrap>

          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Value" error={errors.value?.message}>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="999999999.99"
                  {...register('value', { valueAsNumber: true })}
                  className={cn(inputCls, 'pl-9', errors.value && errorInputCls)}
                  placeholder="0.00"
                />
              </div>
            </FieldWrap>

            <FieldWrap label="Priority" error={errors.priority?.message}>
              <div className="relative">
                <select
                  {...register('priority')}
                  className={cn(selectCls, errors.priority && errorInputCls)}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronIcon />
              </div>
            </FieldWrap>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Expected Close Date" error={errors.expectedCloseDate?.message}>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="date"
                  {...register('expectedCloseDate')}
                  className={cn(inputCls, 'pl-9', errors.expectedCloseDate && errorInputCls)}
                />
              </div>
            </FieldWrap>

            <FieldWrap label="Lead Source" error={errors.leadSource?.message}>
              <input
                {...register('leadSource')}
                className={cn(inputCls, errors.leadSource && errorInputCls)}
                placeholder="e.g. Referral, Website"
              />
            </FieldWrap>
          </div>

          <FieldWrap label="Description" error={errors.description?.message}>
            <textarea
              {...register('description')}
              rows={3}
              className={cn(inputCls, 'resize-none', errors.description && errorInputCls)}
              placeholder="Deal description (optional)"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight + 2}px`;
              }}
            />
          </FieldWrap>
        </div>

        {/* Section 2: Relationships */}
        <div className="space-y-4">
          <SectionHeader num={2} title="Relationships" />

          <Controller
            name="organizationId"
            control={control}
            render={({ field }) => (
              <DealAccountField
                value={field.value || null}
                onChange={(id) => field.onChange(id || '')}
                error={errors.organizationId?.message}
                disabled={!canEdit}
              />
            )}
          />

          <Controller
            name="contactIds"
            control={control}
            render={({ field }) => (
              <DealContactsField
                values={field.value || []}
                onChange={(ids) => field.onChange(ids)}
                error={errors.contactIds?.message}
                disabled={!canEdit}
              />
            )}
          />

          <FieldWrap label="Assigned User" error={errors.assignedUserId?.message}>
            <div className="relative">
              <select
                {...register('assignedUserId')}
                className={cn(selectCls, errors.assignedUserId && errorInputCls)}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </FieldWrap>
        </div>

        {/* Section 3: Additional Details */}
        <div className="space-y-4">
          <SectionHeader num={3} title="Additional Details" />

          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Industry" error={errors.industry?.message}>
              <input
                {...register('industry')}
                className={cn(inputCls, errors.industry && errorInputCls)}
                placeholder="e.g. Technology, Healthcare"
              />
            </FieldWrap>

            <FieldWrap label="Product Interests" error={errors.productInterests?.message}>
              <Controller
                name="productInterests"
                control={control}
                render={({ field }) => (
                  <ProductInterestsSelect
                    value={field.value || []}
                    onChange={field.onChange}
                  />
                )}
              />
            </FieldWrap>
          </div>

          <FieldWrap label="Address" error={errors.address?.message}>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 text-slate-400" size={14} />
              <textarea
                {...register('address')}
                rows={2}
                className={cn(inputCls, 'pl-9 resize-none', errors.address && errorInputCls)}
                placeholder="123 Main St, City, State, Zip"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight + 2}px`;
                }}
              />
            </div>
          </FieldWrap>
        </div>
      </div>

      {/* Sticky Footer with RBAC-gated submit */}
      <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-white/[0.06] bg-white dark:bg-slate-900 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-white/[0.08] rounded-xl transition-colors"
        >
          Cancel
        </button>
        {canEdit && (
          <button
            type="submit"
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl transition-all shadow-lg shadow-blue-500/25"
          >
            Save Changes
          </button>
        )}
      </div>
    </form>
  );
}

// ── Sheet Wrapper ───────────────────────────────────────────────────────────

export function DealEditFormSheet({ deal, isOpen, onClose, onSave }: DealEditFormSheetProps): React.ReactElement {
  return (
    <SlidingDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Deal"
      subtitle="Update deal details below. Stage changes use the pipeline board."
    >
      {deal && <DealEditForm deal={deal} onSave={onSave} onCancel={onClose} />}
    </SlidingDrawer>
  );
}

// ── Small Reusable Helpers ──────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: number; title: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold shrink-0">
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
        <p className="text-[11px] text-red-500 flex items-center gap-1" role="alert">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

function ChevronIcon(): React.ReactElement {
  return (
    <svg
      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Product Interests Multi-Select ──────────────────────────────────────────

interface ProductInterestsSelectProps {
  value: string[];
  onChange: (values: string[]) => void;
}

function ProductInterestsSelect({ value, onChange }: ProductInterestsSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);

  const toggleItem = (item: string): void => {
    if (value.includes(item)) {
      onChange(value.filter((v) => v !== item));
    } else {
      onChange([...value, item]);
    }
  };

  return (
    <div className="relative">
      <div
        className="w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
        role="combobox"
        aria-expanded={isOpen}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <span className={value.length > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
          {value.length > 0 ? `${value.length} selected` : 'Select products...'}
        </span>
        <ChevronIcon />
      </div>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {value.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800/40"
            >
              {item}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item);
                }}
                className="ml-0.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 rounded-sm p-0.5 transition-colors"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-xl shadow-blue-900/5 dark:shadow-black/40 py-1 overflow-hidden max-h-52 overflow-y-auto">
            {PRODUCT_OPTIONS.map((product) => {
              const isSelected = value.includes(product);
              return (
                <div
                  key={product}
                  className={cn(
                    'px-3.5 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2',
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                  )}
                  onClick={() => toggleItem(product)}
                >
                  <div
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-600',
                    )}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  {product}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default DealEditForm;
