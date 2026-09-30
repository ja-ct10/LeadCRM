'use client';

import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProductInterestSelect } from './product-interest-select';
import { useProductInterests } from '@/shared/hooks/use-product-interests';
import { ChevronDown, Loader2 } from 'lucide-react';
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
  title: z.string().min(1, 'Title is required').max(255),
  productInterestIds: z.array(z.string().uuid()).min(1, 'Select at least one Product Interest.'),
  pipelineId: z.string().min(1, 'Pipeline is required'),
  stageId: z.string().min(1, 'Stage is required'),
  expectedCloseDate: z.string().optional(),
  confidence: z.number().min(0).max(100),
  description: z.string().optional(),
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
    title: string;
    productInterestIds: string[];
    pipelineId: string;
    stageId: string;
    expectedCloseDate?: string;
    description?: string;
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
  const { products, loading, error } = useProductInterests();
  const { pipelines: allPipelines } = useData();
  const pipelines = useMemo(() => allPipelines.filter(p => p.name.trim().toLowerCase() === 'sales pipeline'), [allPipelines]);

  // Keep the configured starting stage even when display order changes.
  const defaultPipeline = pipelines[0];
  const defaultStage = defaultPipeline?.stages?.find(stage => stage.isDefault) ?? defaultPipeline?.stages?.[0];

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
      title: '',
      productInterestIds: [],
      pipelineId: defaultPipeline?.id || '',
      stageId: defaultStage?.id || '',
      expectedCloseDate: getDatePlusDays(30),
      confidence: 50,
      description: '',
    },
    mode: 'onChange',
  });

  const selectedPipelineId = watch('pipelineId');
  const selectedProductIds = watch('productInterestIds');
  const productValue = products.filter(p => selectedProductIds.includes(p.id)).reduce((sum, p) => sum + Math.round(p.dealValue * 100), 0) / 100;
  const productFieldId = React.useId();

  const stagesForPipeline = useMemo(() => {
    if (!selectedPipelineId) return [];
    const pipeline = pipelines.find((p) => p.id === selectedPipelineId);
    return pipeline?.stages ?? [];
  }, [selectedPipelineId, pipelines]);

  const onFormSubmit = async (formData: InlineDealFormData): Promise<void> => {
    const payload: Parameters<typeof onSubmit>[0] = {
      title: formData.title,
      productInterestIds: formData.productInterestIds,
      pipelineId: formData.pipelineId,
      stageId: formData.stageId,
      expectedCloseDate: formData.expectedCloseDate || undefined,
      description: formData.description || undefined,
    };

    // Auto-link from relatedRecord
    if (relatedRecord) {
      if (relatedRecord.type === 'lead') {
        payload.leadId = relatedRecord.id;
      } else if (relatedRecord.type === 'contact') {
        payload.contactId = relatedRecord.id;
      }
      if (relatedRecord.organizationId) {
        payload.organizationId = relatedRecord.organizationId;
      }
    }

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

  const isSubmitDisabled = !isValid || loading || !!error || !selectedProductIds.length || isSubmitting || isLoading;

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3" noValidate>
      {/* Title */}
      <div>
        <label className={labelCls}>Title <span className="text-red-500">*</span></label>
        <input
          {...register('title')}
          className={cn(inputCls, errors.title && errorCls)}
          placeholder="Deal title"
        />
        {errors.title && (
          <p className="text-xs text-destructive mt-0.5">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor={productFieldId} className={labelCls}>Product Interest</label>
        <ProductInterestSelect id={productFieldId} products={products} values={selectedProductIds} onChange={values => setValue('productInterestIds', values, { shouldValidate: true })} disabled={loading || !!error} />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <div>
        <label htmlFor={`${productFieldId}-value`} className={labelCls}>Value</label>
        <input id={`${productFieldId}-value`} readOnly className={inputCls} value={new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(productValue)} />
      </div>

      {/* Pipeline & Stage */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Pipeline <span className="text-red-500">*</span></label>
          <p className="py-2 text-sm">Sales Pipeline</p><input type="hidden" {...register('pipelineId')} />
          {errors.pipelineId && (
            <p className="text-xs text-destructive mt-0.5">{errors.pipelineId.message}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Stage <span className="text-red-500">*</span></label>
          <div className="relative">
            <select
              {...register('stageId')}
              className={cn(selectCls, errors.stageId && errorCls)}
              disabled={!selectedPipelineId}
            >
              <option value="">{selectedPipelineId ? 'Select stage' : 'Select pipeline first'}</option>
              {stagesForPipeline.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
          {errors.stageId && (
            <p className="text-xs text-destructive mt-0.5">{errors.stageId.message}</p>
          )}
        </div>
      </div>

      {/* Expected Close Date & Confidence */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Expected Close</label>
          <input
            type="date"
            {...register('expectedCloseDate')}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Confidence (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            {...register('confidence', { valueAsNumber: true })}
            className={cn(inputCls, errors.confidence && errorCls)}
            placeholder="50"
          />
          {errors.confidence && (
            <p className="text-xs text-destructive mt-0.5">{errors.confidence.message}</p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          {...register('description')}
          className={cn(inputCls, 'resize-none h-16')}
          placeholder="Brief description..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitDisabled}
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
