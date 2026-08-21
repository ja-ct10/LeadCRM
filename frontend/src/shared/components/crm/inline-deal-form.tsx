'use client';

import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, DollarSign, Loader2 } from 'lucide-react';
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
  value: z.number().positive().max(999_999_999_999, 'Value exceeds maximum').optional(),
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
    value?: number;
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
}

// ── Component ──────────────────────────────────────────────────────────────

export function InlineDealForm({
  relatedRecord,
  onSubmit,
  onCancel,
  isLoading = false,
}: InlineDealFormProps): React.ReactElement {
  const { pipelines } = useData();

  // Auto-select first pipeline and first stage as defaults
  const defaultPipeline = pipelines[0];
  const defaultStage = defaultPipeline?.stages?.[0];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<InlineDealFormData>({
    resolver: zodResolver(InlineDealSchema),
    defaultValues: {
      title: '',
      value: undefined,
      pipelineId: defaultPipeline?.id || '',
      stageId: defaultStage?.id || '',
      expectedCloseDate: getDatePlusDays(30),
      confidence: 50,
      description: '',
    },
    mode: 'onChange',
  });

  const selectedPipelineId = watch('pipelineId');

  const stagesForPipeline = useMemo(() => {
    if (!selectedPipelineId) return [];
    const pipeline = pipelines.find((p) => p.id === selectedPipelineId);
    return pipeline?.stages ?? [];
  }, [selectedPipelineId, pipelines]);

  const onFormSubmit = async (formData: InlineDealFormData): Promise<void> => {
    const payload: Parameters<typeof onSubmit>[0] = {
      title: formData.title,
      value: formData.value,
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

    await onSubmit(payload);
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

  const isSubmitDisabled = !isValid || isSubmitting || isLoading;

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3" noValidate>
      {/* Title */}
      <div>
        <label className={labelCls}>Title *</label>
        <input
          {...register('title')}
          className={cn(inputCls, errors.title && errorCls)}
          placeholder="Deal title"
        />
        {errors.title && (
          <p className="text-xs text-destructive mt-0.5">{errors.title.message}</p>
        )}
      </div>

      {/* Value */}
      <div>
        <label className={labelCls}>Value</label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('value', { valueAsNumber: true })}
            className={cn(inputCls, 'pl-8', errors.value && errorCls)}
            placeholder="0.00"
          />
        </div>
        {errors.value && (
          <p className="text-xs text-destructive mt-0.5">{errors.value.message}</p>
        )}
      </div>

      {/* Pipeline & Stage */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Pipeline *</label>
          <div className="relative">
            <select
              {...register('pipelineId')}
              className={cn(selectCls, errors.pipelineId && errorCls)}
            >
              <option value="">Select pipeline</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
          {errors.pipelineId && (
            <p className="text-xs text-destructive mt-0.5">{errors.pipelineId.message}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Stage *</label>
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
