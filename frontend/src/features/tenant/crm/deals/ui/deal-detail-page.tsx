'use client';

import React, { useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Layers, Users, Clock, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

import { useRecordDetail } from '@/shared/hooks/use-record-detail';
import { useData } from '@/store/DataContext';
import { RecordDetailLayout } from '@/shared/components/crm/record-detail-layout';
import { RecordOverviewTab } from '@/shared/components/crm/record-overview-tab';
import { RecordRelatedTab } from '@/shared/components/crm/record-related-tab';
import { RecordTimelineTab } from '@/shared/components/crm/record-timeline-tab';
import { RecordFilesTab } from '@/shared/components/crm/record-files-tab';
import { PipelineProgressBar } from '@/shared/components/crm/pipeline-progress-bar';
import { dealDetailConfig } from '../config/record-detail.config';
import type { ActionConfig } from '@/shared/components/crm/record-detail-layout';

export default function DealDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const recordId = params?.id as string | undefined;

  const { record, relationships, activities, isLoading, isNotFound, refetch } = useRecordDetail({
    module: 'deals',
    id: recordId,
  });

  const { updateDeal, deleteDeal, moveDealStage, pipelines } = useData();

  // ── Field save handler ──────────────────────────────────────────────────
  const handleFieldSave = useCallback(async (key: string, value: unknown): Promise<void> => {
    if (!recordId) return;
    await updateDeal(recordId, { [key]: value });
  }, [recordId, updateDeal]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const actions: ActionConfig[] = useMemo(() => {
    return dealDetailConfig.actionTemplates.map((tpl) => ({
      ...tpl,
      onClick: () => {
        switch (tpl.id) {
          case 'edit':
            toast.info('Edit form coming soon — use the side panel for now');
            break;
          case 'duplicate':
            import('@/shared/services/deals-actions.api').then(({ duplicateDeal }) => {
              if (recordId) {
                duplicateDeal(recordId).then(() => toast.success('Deal duplicated')).catch(() => toast.error('Failed to duplicate'));
              }
            });
            break;
          case 'archive':
            if (recordId && window.confirm('Archive this deal?')) {
              deleteDeal(recordId).then(() => {
                toast.success('Deal archived');
                router.push('/crm/deals');
              }).catch(() => toast.error('Failed to archive'));
            }
            break;
          case 'delete':
            if (recordId && window.confirm('Permanently delete this deal?')) {
              deleteDeal(recordId).then(() => {
                toast.success('Deal deleted');
                router.push('/crm/deals');
              }).catch(() => toast.error('Failed to delete'));
            }
            break;
        }
      },
    }));
  }, [recordId, deleteDeal, router]);

  // ── Derived display data ────────────────────────────────────────────────
  const title = (record?.title as string) ?? 'Loading...';
  const subtitle = (record?.companyName as string) ?? undefined;
  const dealValue = typeof record?.value === 'number' ? record.value : 0;

  // Pipeline + Stage info
  const dealPipelineId = record?.pipelineId as string | undefined;
  const dealStageId = record?.stageId as string | undefined;
  const dealPipeline = pipelines.find((p) => p.id === dealPipelineId) ?? pipelines[0];
  const currentStageObj = dealPipeline?.stages.find((s) => s.id === dealStageId);
  const isWon = currentStageObj?.isWon ?? false;
  const isLost = currentStageObj?.isLost ?? false;

  // Status derived from stage
  const statusLabel = isWon ? 'Won' : isLost ? 'Lost' : 'In Progress';
  const statusVariant = isWon ? 'success' : isLost ? 'danger' : 'info';

  // ── Pipeline progress bar (header extra) ────────────────────────────────
  const progressStages = useMemo(() => {
    return (dealPipeline?.stages ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      isWon: s.isWon,
      isLost: s.isLost,
      order: s.order,
    }));
  }, [dealPipeline]);

  const handleStageClick = useCallback(async (stageId: string): Promise<void> => {
    if (!recordId) return;
    try {
      await moveDealStage(recordId, stageId);
      const stageName = dealPipeline?.stages.find((s) => s.id === stageId)?.name ?? 'new stage';
      toast.success(`Stage moved to ${stageName}`);
    } catch {
      toast.error('Failed to change stage');
    }
  }, [recordId, moveDealStage, dealPipeline]);

  const headerExtra = dealPipeline && dealStageId ? (
    <PipelineProgressBar
      stages={progressStages}
      currentStageId={dealStageId}
      isWon={isWon}
      isLost={isLost}
      onStageClick={handleStageClick}
      canChangeStage={true}
    />
  ) : null;

  // ── Avatar ──────────────────────────────────────────────────────────────
  const avatar = (
    <div className="h-11 w-11 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">
      ₱
    </div>
  );

  // ── Field sections ──────────────────────────────────────────────────────
  const fieldSections = useMemo(() => {
    if (!record) return [];
    return dealDetailConfig.buildFieldSections(record, handleFieldSave);
  }, [record, handleFieldSave]);

  // ── Related sections ────────────────────────────────────────────────────
  const relatedSections = useMemo(() => {
    return dealDetailConfig.buildRelatedSections(relationships as Record<string, unknown> | null);
  }, [relationships]);

  // ── Tabs ────────────────────────────────────────────────────────────────
  const tabs = useMemo(() => [
    {
      id: 'overview',
      label: 'Overview',
      icon: Layers,
      content: (
        <RecordOverviewTab
          sections={fieldSections}
          editPermission={dealDetailConfig.editPermission}
          customFields={(record?.customFields as Record<string, string>) ?? undefined}
          onCustomFieldSave={async (fields) => {
            if (recordId) await updateDeal(recordId, { customFields: fields });
          }}
        />
      ),
    },
    {
      id: 'related',
      label: 'Related',
      icon: Users,
      count: relatedSections.reduce((sum, s) => sum + s.records.length, 0) || undefined,
      content: <RecordRelatedTab sections={relatedSections} />,
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: Clock,
      count: activities.length || undefined,
      content: (
        <RecordTimelineTab
          activities={activities}
          module="deals"
          recordId={recordId ?? ''}
          onActivityCreated={refetch}
        />
      ),
    },
    {
      id: 'files',
      label: 'Files',
      icon: Paperclip,
      content: (
        <RecordFilesTab
          files={[]}
          deletePermission={dealDetailConfig.deletePermission}
        />
      ),
    },
  ], [fieldSections, relatedSections, activities, recordId, record, updateDeal, refetch]);

  return (
    <RecordDetailLayout
      module="deals"
      title={`${title}${dealValue > 0 ? ` — ₱${dealValue.toLocaleString()}` : ''}`}
      subtitle={subtitle}
      avatar={avatar}
      status={{ label: statusLabel, variant: statusVariant as 'success' | 'danger' | 'info' }}
      breadcrumbs={[
        { label: 'CRM', href: '/crm/deals' },
        { label: 'Deals', href: '/crm/deals' },
        { label: title },
      ]}
      actions={actions}
      tabs={tabs}
      headerExtra={headerExtra}
      isLoading={isLoading}
      isNotFound={isNotFound}
      defaultTab="overview"
    />
  );
}
