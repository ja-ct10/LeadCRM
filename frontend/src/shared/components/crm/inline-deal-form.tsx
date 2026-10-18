'use client';

import React, { useMemo, useRef } from 'react';
import { useRecordCustomFields } from './record-custom-fields';
import { ConfiguredFormLayout } from './configured-form-layout';
import type { ClosingValues } from '@leadcrm/shared';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { Label } from '@/shared/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProductInterestSelect } from './product-interest-select';
import { useProductInterests } from '@/shared/hooks/use-product-interests';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { useData } from '@/store/DataContext';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────

function getDatePlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

// ── Zod Schema ─────────────────────────────────────────────────────────────

const InlineDealSchema = z.object({
  associationType: z.enum(['', 'lead', 'contact']).optional(),
  associationId: z.string().optional(),
  title: z.string().trim().min(1, 'Title is required').max(255),
  productInterestIds: z.array(z.string().uuid()).length(1, 'Select exactly one Product Interest.'),
  pipelineId: z.string().min(1, 'Pipeline is required'),
  stageId: z.string().min(1, 'Stage is required'),
  expectedCloseDate: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
}).superRefine((data, ctx) => {
  if (!data.associationType) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['associationType'], message: 'Choose Lead or Contact.' });
  if (data.associationType && !data.associationId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['associationId'], message: `Select a ${data.associationType === 'lead' ? 'Lead' : 'Contact'}.` });
});

type InlineDealFormData = z.infer<typeof InlineDealSchema>;

// ── Props ──────────────────────────────────────────────────────────────────

interface InlineDealFormProps {
  relatedRecord?: {
    type: 'lead' | 'contact' | 'account';
    id: string;
    organizationId?: string;
  };
  onSubmit: (data: {
    customFieldValues?: ClosingValues;
    title: string;
    productInterestIds: string[];
    pipelineId: string;
    stageId: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    expectedCloseDate?: string;
    leadId?: string;
    contactId?: string;
    organizationId?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  onError?: (error: unknown) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function InlineDealForm({
  relatedRecord,
  onSubmit,
  onCancel,
  isLoading = false,
  onError,
}: InlineDealFormProps): React.ReactElement {
  const submitting = useRef(false);
  const { products, loading, error } = useProductInterests();
  const customFields = useRecordCustomFields('deals');
  const { pipelines: allPipelines } = useData();
  const pipelines = useMemo(() => allPipelines.filter(p => p.name.trim().toLowerCase() === 'sales pipeline'), [allPipelines]);

  // Keep the configured starting stage even when display order changes.
  const defaultPipeline = pipelines[0];
  const defaultStage = defaultPipeline?.stages?.find(stage => stage.name.trim().toLowerCase() === 'lead' && !stage.isWon && !stage.isLost);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isValid, isSubmitting },
  } = useForm<InlineDealFormData>({
    resolver: zodResolver(InlineDealSchema),
    defaultValues: {
      associationType: relatedRecord?.type === 'lead' || relatedRecord?.type === 'contact' ? relatedRecord.type : '',
      associationId: relatedRecord?.type === 'lead' || relatedRecord?.type === 'contact' ? relatedRecord.id : '',
      title: '',
      productInterestIds: [],
      pipelineId: defaultPipeline?.id || '',
      stageId: defaultStage?.id || '',
      expectedCloseDate: getDatePlusDays(30),
      priority: 'MEDIUM',
    },
    mode: 'onChange',
  });

  React.useEffect(() => {
    if (defaultPipeline) setValue('pipelineId', defaultPipeline.id, { shouldValidate: true });
    if (defaultStage) setValue('stageId', defaultStage.id, { shouldValidate: true });
  }, [defaultPipeline?.id, defaultStage?.id, setValue]);

  const associationType = watch('associationType');
  const associationId = watch('associationId');
  const selectedProductIds = watch('productInterestIds');
  const productValue = products.filter(p => selectedProductIds.includes(p.id)).reduce((sum, p) => sum + Math.round(p.dealValue * 100), 0) / 100;
  const productFieldId = React.useId();

  const onFormSubmit = async (formData: InlineDealFormData): Promise<void> => {
    if (!customFields.validate()) return;
    const payload: Parameters<typeof onSubmit>[0] = {
      customFieldValues: customFields.payload(),
      title: formData.title,
      productInterestIds: formData.productInterestIds,
      pipelineId: formData.pipelineId,
      stageId: formData.stageId,
      priority: formData.priority,
      expectedCloseDate: formData.expectedCloseDate || undefined,
    };

    if (formData.associationType === 'lead') payload.leadId = formData.associationId;
    else payload.contactId = formData.associationId;

    try {
      await onSubmit(payload);
    } catch (error) {
      if (!onError) throw error;
      onError(error);
      return;
    }
    reset();
    onCancel?.();
    toast.success('Deal created successfully');
  };

  // ── Shared Styling ──────────────────────────────────────────────────────
  const inputCls =
    'w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:ring-2 focus:ring-ring/20 focus:border-primary';
  const selectCls =
    'w-full bg-card border border-border rounded-lg pl-3 pr-8 py-2 text-sm text-foreground outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all [&>option]:bg-card';
  const errorCls = '!border-destructive focus:!ring-destructive/20';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

  const isSubmitDisabled = !defaultPipeline || !defaultStage || !isValid || loading || !!error || !selectedProductIds.length || isSubmitting || isLoading;

  return (
    <form onSubmit={event => {
      if (submitting.current) { event.preventDefault(); return; }
      submitting.current = true;
      void handleSubmit(onFormSubmit)(event).finally(() => { submitting.current = false; });
    }} className="space-y-3" noValidate>
      <ConfiguredFormLayout form={customFields} module="deals">
      {/* Title */}
      <div data-crm-field-key="title">
        <label htmlFor={`${productFieldId}-title`} className={labelCls}>Title <span className="text-red-500">*</span></label>
        <input
          id={`${productFieldId}-title`}
          aria-required="true"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? `${productFieldId}-title-error` : undefined}
          maxLength={255}
          {...register('title')}
          className={cn(inputCls, errors.title && errorCls)}
          placeholder="Deal title"
        />
        {errors.title && (
          <p id={`${productFieldId}-title-error`} className="text-xs text-destructive mt-0.5">{errors.title.message}</p>
        )}
      </div>

      <div data-crm-field-key="productInterestIds">
        <label htmlFor={productFieldId} className={labelCls}>Product Interest</label>
        <ProductInterestSelect single id={productFieldId} products={products} values={selectedProductIds} onChange={values => setValue('productInterestIds', values, { shouldValidate: true })} disabled={loading || !!error} />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <div data-crm-field-key="value">
        <label htmlFor={`${productFieldId}-value`} className={labelCls}>Value</label>
        <input id={`${productFieldId}-value`} readOnly className={inputCls} value={new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(productValue)} />
      </div>

      <input type="hidden" {...register('pipelineId')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div data-crm-field-key="priority">
          <label htmlFor={`${productFieldId}-priority`} className={labelCls}>Priority</label>
          <select id={`${productFieldId}-priority`} {...register('priority')} className={selectCls}>
            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
          </select>
        </div>
        <div data-crm-field-key="stageId">
          <label htmlFor={`${productFieldId}-stage`} className={labelCls}>Starting stage</label>
          <input type="hidden" {...register('stageId')} />
          <input id={`${productFieldId}-stage`} readOnly className={inputCls} value={defaultStage?.name ?? 'Unavailable'} />
          {errors.stageId && <p className="text-xs text-destructive">{errors.stageId.message}</p>}
        </div>
      </div>
      <div data-crm-field-key="expectedCloseDate">
        <label htmlFor={`${productFieldId}-close`} className={labelCls}>Expected Close Date</label>
        <input id={`${productFieldId}-close`} type="date" {...register('expectedCloseDate')} className={cn(inputCls, 'min-w-0')} />
      </div>
      {!defaultPipeline && <p role="alert" className="text-xs text-destructive">Sales Pipeline is unavailable.</p>}
      {defaultPipeline && !defaultStage && <p role="alert" className="text-xs text-destructive">The Lead starting stage is unavailable.</p>}

      </ConfiguredFormLayout>
      <div className="min-w-0 space-y-3">
        <div>
          <Label htmlFor={`${productFieldId}-association-type`} className={labelCls}>Associate Deal To <span className="text-red-500">*</span></Label>
          <select id={`${productFieldId}-association-type`} aria-required aria-invalid={!!errors.associationType} value={associationType ?? ''} disabled={isSubmitting || isLoading} className={selectCls} onChange={event => {
            setValue('associationType', event.target.value as 'lead' | 'contact' | '', { shouldDirty: true, shouldValidate: true });
            setValue('associationId', '', { shouldDirty: true, shouldValidate: true });
          }}><option value="">Select Lead or Contact...</option><option value="lead">Lead</option><option value="contact">Contact</option></select>
          {errors.associationType && <p role="alert" className="text-xs text-destructive">{errors.associationType.message}</p>}
        </div>
        {associationType && <div>
          <Label htmlFor={`${productFieldId}-association`} className={labelCls}>{associationType === 'lead' ? 'Lead' : 'Contact'} <span className="text-red-500">*</span></Label>
          <EntityCombobox key={associationType} id={`${productFieldId}-association`} aria-required="true" entityType={associationType === 'lead' ? 'leads' : 'contacts'} value={associationId || null} onChange={id => setValue('associationId', id || '', { shouldDirty: true, shouldValidate: true })} error={errors.associationId?.message} disabled={isSubmitting || isLoading} />
        </div>}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitDisabled || customFields.blocked}
          className="flex-1"
        >
          {(isSubmitting || isLoading) && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Create Deal
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting || isLoading}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export { InlineDealSchema };
export type { InlineDealFormProps, InlineDealFormData };
