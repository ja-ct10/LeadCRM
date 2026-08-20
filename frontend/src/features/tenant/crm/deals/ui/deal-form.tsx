'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { useData } from '@/store/DataContext';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { DealAccountField } from './deal-account-field';
import { DealContactsField } from './deal-contacts-field';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { AlertCircle, ChevronDown, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Deal } from '@/store/types';

// ── Zod schemas mirroring backend CreateDealSchema / UpdateDealSchema ──────
// Backend: CreateDealSchema requires pipelineId, stageId, title
// Backend: UpdateDealSchema = CreateDealSchema.omit({ stageId, pipelineId }).partial()

const CreateDealFormSchema = z.object({
  pipelineId: z.string().min(1, 'Pipeline is required'),
  stageId: z.string().min(1, 'Stage is required'),
  title: z.string().min(1, 'Title is required').max(255, 'Max 255 characters'),
  value: z.number().positive('Must be a positive number').max(999_999_999_999, 'Value exceeds maximum').optional(),
  currency: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
  leadSource: z.string().optional(),
  organizationId: z.string().optional(),
  assignedUserId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  industry: z.string().optional(),
  address: z.string().optional(),
  productInterests: z.array(z.string()).optional(),
});

const UpdateDealFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Max 255 characters'),
  value: z.number().positive('Must be a positive number').max(999_999_999_999, 'Value exceeds maximum').optional(),
  currency: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
  leadSource: z.string().optional(),
  organizationId: z.string().optional(),
  assignedUserId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  industry: z.string().optional(),
  address: z.string().optional(),
  productInterests: z.array(z.string()).optional(),
});

export type CreateDealFormData = z.infer<typeof CreateDealFormSchema>;
export type UpdateDealFormData = z.infer<typeof UpdateDealFormSchema>;
type DealFormData = CreateDealFormData | UpdateDealFormData;

// ── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS: { value: 'LOW' | 'MEDIUM' | 'HIGH'; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const PRODUCT_OPTIONS = [
  'CCTV', 'Biometrics', 'Door Access', 'Door access/Biometrics',
  'Network/Structured Cabling', 'FDAS', 'PABX', 'PC/Laptop/Server Assembly',
  'Software/Web Development', 'Others',
];

const SOURCE_OPTIONS = [
  'Google Ads', 'Referral', 'Email Campaign', 'Website', 'LinkedIn Ads',
  'Webinar', 'Social Media Advertisement', 'Partner Referral', 'Direct Mail',
  'Cold Call', 'Content Marketing', 'YouTube Ads', 'SEO / Organic Search', 'Others',
];

// ── Props ──────────────────────────────────────────────────────────────────

export interface DealFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<Deal>;
  /** Pre-fill pipeline/stage when creating from a Kanban column */
  preselect?: { pipelineId?: string; stageId?: string };
  onSubmit: (data: DealFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface DealFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialData?: Partial<Deal>;
  preselect?: { pipelineId?: string; stageId?: string };
  onSubmit: (data: DealFormData) => Promise<void>;
  isLoading?: boolean;
}

// ── Main Form Component ────────────────────────────────────────────────────

export function DealForm({
  mode,
  initialData,
  preselect,
  onSubmit,
  onCancel,
  isLoading = false,
}: DealFormProps): React.ReactElement {
  const { pipelines } = useData();
  const canCreate = useHasPermission('deals.create');
  const canEdit = useHasPermission('deals.edit');
  const isCreateMode = mode === 'create';
  const hasPermission = isCreateMode ? canCreate : canEdit;

  // Build default values from initialData (edit) or preselect (create)
  const defaultValues = useMemo(() => {
    if (isCreateMode) {
      return {
        pipelineId: preselect?.pipelineId || '',
        stageId: preselect?.stageId || '',
        title: '',
        value: undefined,
        currency: 'PHP',
        priority: 'MEDIUM' as const,
        expectedCloseDate: '',
        description: '',
        leadSource: '',
        organizationId: '',
        assignedUserId: '',
        contactIds: [] as string[],
        industry: '',
        address: '',
        productInterests: [] as string[],
      };
    }
    // Edit mode — pre-fill from initialData
    return {
      title: initialData?.title || '',
      value: initialData?.value || undefined,
      currency: initialData?.currency || 'PHP',
      priority: (normalizedPriority(initialData?.priority) || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH',
      expectedCloseDate: initialData?.expectedCloseDate
        ? initialData.expectedCloseDate.split('T')[0]
        : '',
      description: initialData?.description || '',
      leadSource: initialData?.leadSource || '',
      organizationId: initialData?.organizationId || '',
      assignedUserId: initialData?.assignedUserId || '',
      contactIds: initialData?.contactIds || [],
      industry: initialData?.industry || '',
      address: initialData?.address || '',
      productInterests: initialData?.productInterests || [],
    };
  }, [isCreateMode, initialData, preselect]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isValid, isSubmitting },
    setFocus,
  } = useForm<CreateDealFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RHF v7.82 + resolvers v5.4 type mismatch with optional number
    resolver: zodResolver(isCreateMode ? CreateDealFormSchema : UpdateDealFormSchema) as never,
    defaultValues: defaultValues as never,
    mode: 'onChange',
  });

  const formRef = useRef<HTMLFormElement>(null);
  const selectedPipelineId = watch('pipelineId');

  // Get stages for selected pipeline (only relevant in create mode)
  const stagesForPipeline = useMemo(() => {
    const pipelineId = isCreateMode ? selectedPipelineId : initialData?.pipelineId;
    if (!pipelineId) return [];
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    return pipeline?.stages || [];
  }, [isCreateMode, selectedPipelineId, initialData?.pipelineId, pipelines]);

  // Reset stageId when pipeline changes (create mode only)
  useEffect(() => {
    if (isCreateMode && selectedPipelineId && !preselect?.stageId) {
      setValue('stageId', '');
    }
    // Only run when pipeline changes in create mode, not on initial mount with preselect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPipelineId]);

  // Scroll to first error on submit attempt
  useEffect(() => {
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey && formRef.current) {
      const field = formRef.current.querySelector(`[name="${firstErrorKey}"]`);
      if (field) {
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try {
          setFocus(firstErrorKey as keyof CreateDealFormData);
        } catch { /* noop */ }
      }
    }
  }, [errors, setFocus]);

  const onFormSubmit = async (data: CreateDealFormData): Promise<void> => {
    // Clean optional empty strings before submission
    const cleaned: DealFormData = {
      ...data,
      expectedCloseDate: data.expectedCloseDate
        ? data.expectedCloseDate.includes('T')
          ? data.expectedCloseDate
          : `${data.expectedCloseDate}T00:00:00.000Z`
        : undefined,
      description: data.description || undefined,
      leadSource: data.leadSource || undefined,
      organizationId: data.organizationId || undefined,
      assignedUserId: data.assignedUserId || undefined,
      contactIds: data.contactIds?.length ? data.contactIds : undefined,
      industry: data.industry || undefined,
      address: data.address || undefined,
      productInterests: data.productInterests?.length ? data.productInterests : undefined,
    };
    await onSubmit(cleaned);
  };

  // ── Shared styling ────────────────────────────────────────────────────
  const inputCls =
    'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
  const selectCls =
    'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl pl-3.5 pr-8 py-2.5 text-sm text-slate-900 dark:text-white outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all [&>option]:bg-white dark:[&>option]:bg-slate-900';
  const errorInputCls = '!border-red-500 focus:!ring-red-500/20';

  const isSubmitDisabled = !isValid || isSubmitting || isLoading || !hasPermission;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onFormSubmit)}
      className="flex flex-col h-full"
      noValidate
    >
      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Section 1: Pipeline & Stage (Create mode only — edit does not change pipeline/stage here) */}
        {isCreateMode && (
          <div className="space-y-4">
            <SectionHeader num={1} title="Pipeline & Stage" />
            <div className="grid grid-cols-2 gap-4">
              <FieldWrap label="Pipeline *" error={errors.pipelineId?.message}>
                <div className="relative">
                  <select
                    {...register('pipelineId')}
                    className={cn(selectCls, errors.pipelineId && errorInputCls)}
                  >
                    <option value="">Select pipeline...</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
              </FieldWrap>
              <FieldWrap label="Stage *" error={errors.stageId?.message}>
                <div className="relative">
                  <select
                    {...register('stageId')}
                    className={cn(selectCls, errors.stageId && errorInputCls)}
                    disabled={!selectedPipelineId}
                  >
                    <option value="">{selectedPipelineId ? 'Select stage...' : 'Select pipeline first'}</option>
                    {stagesForPipeline.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
              </FieldWrap>
            </div>
          </div>
        )}

        {/* Section 2: Deal Information */}
        <div className="space-y-4">
          <SectionHeader num={isCreateMode ? 2 : 1} title="Deal Information" />
          <FieldWrap label="Title *" error={errors.title?.message}>
            <input
              {...register('title')}
              className={cn(inputCls, errors.title && errorInputCls)}
              placeholder="Enter deal title"
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
                  {...register('value', { valueAsNumber: true })}
                  className={cn(inputCls, 'pl-9', errors.value && errorInputCls)}
                  placeholder="0.00"
                  onKeyDown={(e) => {
                    if (!/[0-9.]/.test(e.key) && !['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
              </div>
            </FieldWrap>
            <FieldWrap label="Currency">
              <input {...register('currency')} className={inputCls} placeholder="PHP" />
            </FieldWrap>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Priority" error={errors.priority?.message}>
              <div className="relative">
                <select {...register('priority')} className={selectCls}>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
            <FieldWrap label="Expected Close Date">
              <input type="date" {...register('expectedCloseDate')} className={inputCls} />
            </FieldWrap>
          </div>
          <FieldWrap label="Description">
            <textarea
              {...register('description')}
              rows={3}
              className={cn(inputCls, 'resize-none')}
              placeholder="Add deal description..."
            />
          </FieldWrap>
        </div>

        {/* Section 3: Relationships */}
        <div className="space-y-4">
          <SectionHeader num={isCreateMode ? 3 : 2} title="Relationships" />
          <Controller
            name="organizationId"
            control={control}
            render={({ field }) => (
              <DealAccountField
                value={field.value || null}
                onChange={(id) => field.onChange(id || '')}
                error={errors.organizationId?.message}
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
              />
            )}
          />
          <FieldWrap label="Assigned User">
            <Controller
              name="assignedUserId"
              control={control}
              render={({ field }) => (
                <EntityCombobox
                  entityType="users"
                  multiple={false}
                  value={field.value || null}
                  onChange={(id) => field.onChange(id || '')}
                  placeholder="Search users..."
                  error={errors.assignedUserId?.message}
                />
              )}
            />
          </FieldWrap>
        </div>

        {/* Section 4: Additional Details */}
        <div className="space-y-4">
          <SectionHeader num={isCreateMode ? 4 : 3} title="Additional Details" />
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Lead Source">
              <div className="relative">
                <select {...register('leadSource')} className={selectCls}>
                  <option value="">Select source...</option>
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
            <FieldWrap label="Industry">
              <input {...register('industry')} className={inputCls} placeholder="e.g. Technology, Healthcare" />
            </FieldWrap>
          </div>
          <FieldWrap label="Address">
            <textarea
              {...register('address')}
              rows={2}
              className={cn(inputCls, 'resize-none')}
              placeholder="Enter address..."
            />
          </FieldWrap>
          <FieldWrap label="Product Interests">
            <Controller
              name="productInterests"
              control={control}
              render={({ field }) => (
                <ProductInterestsSelect values={field.value || []} onChange={field.onChange} />
              )}
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
        {hasPermission && (
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={cn(
              'px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all shadow-lg shadow-blue-500/25',
              isSubmitDisabled
                ? 'bg-blue-400 cursor-not-allowed opacity-60'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95',
            )}
          >
            {isLoading || isSubmitting ? 'Saving...' : isCreateMode ? 'Create Deal' : 'Update Deal'}
          </button>
        )}
      </div>
    </form>
  );
}

// ── Backward-compat exports ────────────────────────────────────────────────
// Legacy callers that still use the old DealCreateForm interface.

interface LegacyDealCreateFormProps {
  onSave: (data: CreateDealFormData) => void;
  onCancel: () => void;
}

export function DealCreateForm({ onSave, onCancel }: LegacyDealCreateFormProps): React.ReactElement {
  const handleSubmit = async (data: DealFormData): Promise<void> => {
    onSave(data as CreateDealFormData);
  };
  return <DealForm mode="create" onSubmit={handleSubmit} onCancel={onCancel} />;
}

// ── Product Interests Multi-Select ─────────────────────────────────────────

interface ProductInterestsSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
}

function ProductInterestsSelect({ values, onChange }: ProductInterestsSelectProps): React.ReactElement {
  const toggleProduct = (product: string): void => {
    if (values.includes(product)) {
      onChange(values.filter((v) => v !== product));
    } else {
      onChange([...values, product]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRODUCT_OPTIONS.map((product) => {
          const isSelected = values.includes(product);
          return (
            <button
              key={product}
              type="button"
              onClick={() => toggleProduct(product)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]',
              )}
            >
              {product}
            </button>
          );
        })}
      </div>
      {values.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Selected: {values.join(', ')}</p>
      )}
    </div>
  );
}

// ── Reusable Helpers ───────────────────────────────────────────────────────

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
        <p className="text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

/** Normalize priority casing from the frontend Deal type (which allows display casing) */
function normalizedPriority(priority: string | undefined): 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
  if (!priority) return undefined;
  const upper = priority.toUpperCase();
  if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH') return upper;
  return undefined;
}

// ── Sheet Wrapper ──────────────────────────────────────────────────────────

export function DealFormSheet({
  isOpen,
  onClose,
  mode,
  initialData,
  preselect,
  onSubmit,
  isLoading,
}: DealFormSheetProps): React.ReactElement {
  const title = mode === 'create' ? 'New Deal' : 'Edit Deal';
  const subtitle = mode === 'create'
    ? 'Complete the deal details below.'
    : 'Update the deal information.';

  return (
    <SlidingDrawer isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle}>
      <DealForm
        mode={mode}
        initialData={initialData}
        preselect={preselect}
        onSubmit={onSubmit}
        onCancel={onClose}
        isLoading={isLoading}
      />
    </SlidingDrawer>
  );
}
