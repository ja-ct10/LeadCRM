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
import { contactDetailConfig } from '../config/record-detail.config';
import type { ActionConfig } from '@/shared/components/crm/record-detail-layout';

export default function ContactDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const recordId = params?.id as string | undefined;

  const { record, relationships, activities, isLoading, isNotFound, refetch } = useRecordDetail({
    module: 'contacts',
    id: recordId,
  });

  const { updateContact, deleteContact } = useData();

  // ── Field save handler ──────────────────────────────────────────────────
  const handleFieldSave = useCallback(async (key: string, value: unknown): Promise<void> => {
    if (!recordId) return;
    await updateContact(recordId, { [key]: value });
  }, [recordId, updateContact]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const actions: ActionConfig[] = useMemo(() => {
    return contactDetailConfig.actionTemplates.map((tpl) => ({
      ...tpl,
      onClick: () => {
        switch (tpl.id) {
          case 'edit':
            toast.info('Edit form coming soon — use the side panel for now');
            break;
          case 'delete':
            if (recordId && window.confirm('Archive this contact?')) {
              deleteContact(recordId).then(() => {
                toast.success('Contact archived');
                router.push('/crm/contacts');
              }).catch(() => toast.error('Failed to archive'));
            }
            break;
        }
      },
    }));
  }, [recordId, deleteContact, router]);

  // ── Derived display data ────────────────────────────────────────────────
  const title = record
    ? `${record.firstName ?? ''} ${record.lastName ?? ''}`.trim() || 'Unnamed Contact'
    : 'Loading...';
  const subtitle = (record?.companyName as string) ?? (record?.jobTitle as string) ?? undefined;
  const statusValue = (record?.status as string) ?? 'Active';
  const statusConfig = contactDetailConfig.statuses.find((s) => s.value === statusValue)
    ?? { label: statusValue, variant: 'neutral' as const };

  // ── Avatar ──────────────────────────────────────────────────────────────
  const initials = record
    ? `${(record.firstName as string)?.[0] ?? ''}${(record.lastName as string)?.[0] ?? ''}`.toUpperCase() || 'C'
    : 'C';
  const avatar = (
    <div className="h-11 w-11 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">
      {initials}
    </div>
  );

  // ── Field sections ──────────────────────────────────────────────────────
  const fieldSections = useMemo(() => {
    if (!record) return [];
    return contactDetailConfig.buildFieldSections(record, handleFieldSave);
  }, [record, handleFieldSave]);

  // ── Related sections ────────────────────────────────────────────────────
  const relatedSections = useMemo(() => {
    return contactDetailConfig.buildRelatedSections(relationships as Record<string, unknown> | null);
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
          editPermission={contactDetailConfig.editPermission}
          customFields={(record?.customFields as Record<string, string>) ?? undefined}
          onCustomFieldSave={async (fields) => {
            if (recordId) await updateContact(recordId, { customFields: fields });
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
          module="contacts"
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
          deletePermission={contactDetailConfig.deletePermission}
        />
      ),
    },
  ], [fieldSections, relatedSections, activities, recordId, record, updateContact, refetch]);

  return (
    <RecordDetailLayout
      module="contacts"
      title={title}
      subtitle={subtitle}
      avatar={avatar}
      status={{ label: statusConfig.label, variant: statusConfig.variant }}
      breadcrumbs={[
        { label: 'CRM', href: '/crm/contacts' },
        { label: 'Contacts', href: '/crm/contacts' },
        { label: title },
      ]}
      actions={actions}
      tabs={tabs}
      isLoading={isLoading}
      isNotFound={isNotFound}
      defaultTab="overview"
    />
  );
}
