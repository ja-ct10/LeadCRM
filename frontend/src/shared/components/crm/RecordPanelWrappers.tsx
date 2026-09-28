'use client';
import { CrmRecordPanel } from './crm-record-view';
import { TaskEditor } from '@/features/tenant/operations/tasks/ui/task-editor';
import { RelatedTasks } from '@/features/tenant/operations/tasks/ui/related-tasks';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Info,
  CheckCircle2,
  Trophy,
  Contact as ContactIcon,
  Table2,
  Building,
  MapPin,
  Mail,
  Phone,
  Pencil,
  FileText,
  Trash2,
  Archive,
  Plus,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';

import { RecordPanel, SmallAction, Chip, type RecordPanelProps } from './RecordPanel';
import { useRecordActivities } from '@/shared/hooks/use-record-activities';
import { PipelineProgressBar } from './pipeline-progress-bar';
import { RecordActionBar } from './record-action-bar';
import type { OverflowMenuItem } from './record-action-bar';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { CustomFieldsSection } from './custom-fields-section';
import { FilesSection } from './files-section';
import type { FileRecord } from './files-section';
import { useData } from '@/store/DataContext';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import type { Lead, Contact, Deal } from '@/store/types';
import { leadsService } from '@/features/tenant/crm/leads/services/leads.service';
import { toFrontendContact } from '@/lib/api/adapters/contact.adapter';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { getTenantCurrency, formatCurrency } from '@/shared/utils/currency';

import { DEFAULT_PIPELINE, type CustomFieldItem } from './moduleConfig';

const timelineModules = { lead: 'leads', contact: 'contacts', account: 'accounts', deal: 'deals' } as const;
function ContextualRecordPanel(props: Omit<RecordPanelProps, 'activity'>) {
  const timeline = useRecordActivities(timelineModules[props.module], props.record.id, props.open);
  return <RecordPanel {...props} activity={timeline.activities} loading={timeline.isInitialLoad} activityError={timeline.error} onActivityCreated={timeline.refetch} />;
}

/* -------------------------------------------------------------------------- */
/*                                0. SHARED COMPONENTS                        */
/* -------------------------------------------------------------------------- */

function EditableField({
  value,
  onSave,
  placeholder,
  icon: Icon,
  className,
}: {
  value: string;
  onSave: (val: string) => void;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setVal(value);
  }, [value]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (val !== value) {
      onSave(val);
    }
  };

  if (isEditing) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2 flex-1", className)}>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setVal(value);
              setIsEditing(false);
            }
          }}
          className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        />
      </div>
    );
  }

  return (
    <div
      className={cn("group flex min-w-0 flex-1 items-center gap-3 cursor-pointer rounded-md hover:bg-accent/50 px-1 -mx-1 py-0.5 transition-colors", className)}
      onClick={() => setIsEditing(true)}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <span className={cn("truncate text-foreground", !val && "text-muted-foreground")}>
        {val || placeholder || 'Click to add...'}
      </span>
      <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground ml-auto shrink-0" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         0b. EXPANDABLE INLINE CARDS                        */
/* -------------------------------------------------------------------------- */

export interface LeadPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onEdit?: (lead: Lead) => void;
}
export function LeadPanel({ open, onOpenChange, lead, onEdit }: LeadPanelProps) {
  return <CrmRecordPanel module="leads" id={lead?.id} open={open} onOpenChange={onOpenChange} onEdit={onEdit ? record => onEdit(record as unknown as Lead) : undefined} />;
}

export interface ContactPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onEdit?: (contact: Contact) => void;
}
export function ContactPanel({ open, onOpenChange, contact, onEdit }: ContactPanelProps) {
  return <CrmRecordPanel module="contacts" id={contact?.id} open={open} onOpenChange={onOpenChange} onEdit={onEdit ? record => onEdit(record as unknown as Contact) : undefined} />;
}

export interface AccountPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: { id: string } | null;
  onEdit?: (account: any) => void;
}
export function AccountPanel({ open, onOpenChange, account, onEdit }: AccountPanelProps) {
  return <CrmRecordPanel module="accounts" id={account?.id} open={open} onOpenChange={onOpenChange} onEdit={onEdit} />;
}

export interface DealPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  onEdit?: (deal: Deal) => void;
  onOpenContactPanel?: (contactId: string) => void;
  onOpenAccountPanel?: (accountId: string) => void;
}

export function DealPanel({ open, onOpenChange, deal, onEdit, onOpenContactPanel, onOpenAccountPanel }: DealPanelProps) {
  const { pipelines, moveDealStage, deleteDeal, contacts: contextContacts, organizations, updateDeal } = useData();
  const canEditDeal = useHasPermission('deals.edit');
  const canDeleteDeal = useHasPermission('deals.delete');
  const canCreateDeal = useHasPermission('deals.create');

  // ── On-demand contacts fetch ─────────────────────────────────────────────
  const [panelContacts, setPanelContacts] = useState<Contact[]>([]);
  const contacts = panelContacts.length > 0 ? panelContacts : contextContacts;

  const fetchDealContacts = useCallback(async (): Promise<void> => {
    if (!deal) return;
    try {
      const res = await leadsService.getAll({ limit: 100 });
      setPanelContacts((res?.data ?? []).map(toFrontendContact) as Contact[]);
    } catch {
      // silent
    }
  }, [deal]);

  useEffect(() => {
    if (open) void fetchDealContacts();
  }, [open, fetchDealContacts]);

  // Local UI states for DealPanel
  const [customFields, setCustomFields] = useState<CustomFieldItem[]>(
    (deal as any)?.customFields ?? []
  );
  const [files, setFiles] = useState<FileRecord[]>(
    (deal as any)?.files ?? []
  );
  const { dialogProps: confirmDialogProps, confirm: showConfirm } = useConfirmDialog();

  // Tenant-aware currency for all deal monetary values in this panel
  const { tenant } = useAuth();
  const tenantCurrency = useMemo(() => getTenantCurrency(tenant), [tenant]);

  if (!deal) return null;

  const dealPipeline = pipelines.find((p) => p.id === deal.pipelineId) || pipelines[0];
  const dealStages = dealPipeline?.stages.map((s) => ({
    id: s.id,
    label: s.name,
    tone: s.isWon ? ('success' as const) : s.isLost ? ('muted' as const) : ('warning' as const),
  })) || DEFAULT_PIPELINE.stages;

  const currentStage = dealStages.find((s) => s.id === deal.stageId)?.label || 'In Progress';


  // Associated contacts: from deal.contactIds or deal.leadIds, or fallback to contactId
  const linkedContactIds = deal.contactIds ?? (deal.leadIds ?? (deal.leadId ? [deal.leadId] : []));
  const linkedContacts = contacts.filter((c) => linkedContactIds.includes(c.id));
  const primaryContact = linkedContacts[0] ?? null;

  // Company/Organization from deal's organizationId or companyId
  const dealOrganization = organizations.find(
    (o) => o.id === deal.organizationId || o.id === (deal as any).companyId || o.name === deal.companyName
  );

  // Current stage info for won/lost detection
  const currentStageObj = dealPipeline?.stages.find((s) => s.id === deal.stageId);
  const isWon = currentStageObj?.isWon ?? false;
  const isLost = currentStageObj?.isLost ?? false;

  // Pipeline progress bar stages
  const progressStages = (dealPipeline?.stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    isWon: s.isWon,
    isLost: s.isLost,
    order: s.order,
  }));

  const handleStageClick = async (stageId: string): Promise<void> => {
    if (!canEditDeal) return;
    try {
      await moveDealStage(deal.id, stageId);
      const stageName = dealPipeline?.stages.find((s) => s.id === stageId)?.name ?? 'new stage';
      toast.success(`Stage moved to ${stageName}`);
    } catch {
      toast.error('Failed to change stage');
    }
  };

  const handleDuplicate = async (): Promise<void> => {
    try {
      const { duplicateDeal: duplicateApi } = await import('@/shared/services/deals-actions.api');
      await duplicateApi(deal.id);
    } catch {
      toast.error('Failed to duplicate deal');
    }
  };

  const handleArchiveRestore = async (): Promise<void> => {
    if (deal.isArchived) {
      try {
        const { restoreDeal: restoreApi } = await import('@/shared/services/deals-actions.api');
        await restoreApi(deal.id);
      } catch {
        toast.error('Failed to restore deal');
      }
    } else {
      await deleteDeal(deal.id);
      toast.success('Deal archived');
    }
  };

  // Overflow menu items for RecordActionBar
  const overflowItems: OverflowMenuItem[] = [
    { label: 'Edit', icon: <Pencil className="size-4" />, onClick: () => onEdit?.(deal) },
    { label: 'Duplicate', icon: <FileText className="size-4" />, onClick: handleDuplicate, permission: 'deals.create' },
    { label: deal.isArchived ? 'Restore' : 'Archive', icon: <Trash2 className="size-4" />, onClick: handleArchiveRestore, permission: 'deals.delete' },
    {
      label: 'Delete',
      icon: <Trash2 className="size-4" />,
      onClick: () => showConfirm({
        title: 'Delete Deal',
        description: `Delete ${deal.title}?`,
        warning: 'This cannot be undone.',
        confirmLabel: 'Delete Deal',
        variant: 'destructive',
        onConfirm: async () => {
          await deleteDeal(deal.id);
          onOpenChange(false);
          toast.success('Deal deleted');
        },
      }),
      destructive: true,
      permission: 'deals.delete',
    },
  ];

  const sections = [
    // 21.1: Pipeline Progress Bar section
    {
      id: 'pipeline-progress',
      title: 'Pipeline',
      icon: Info,
      content: (
        <div className="px-4 py-3">
          <PipelineProgressBar
            stages={progressStages}
            currentStageId={deal.stageId}
            isWon={isWon}
            isLost={isLost}
            onStageClick={handleStageClick}
            canChangeStage={canEditDeal}
          />
        </div>
      ),
    },
    // 21.2: Record Action Bar section
    {
      id: 'action-bar',
      title: 'Actions',
      icon: Info,
      content: (
        <div className="px-4 py-2">
          <RecordActionBar
            email={primaryContact?.email ?? null}
            phone={primaryContact?.phone ?? null}
            onLogActivity={() => toast.info('Activity logging coming soon')}
            overflowItems={overflowItems}
          />
        </div>
      ),
    },
    // About Deal
    {
      id: 'about',
      title: 'About Deal',
      icon: Info,
      content: (
        <div className="divide-y divide-border text-sm">
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground self-center">Deal Value</span>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1">{tenantCurrency.symbol}</span>
              <EditableField
                value={deal.value?.toString() || '0'}
                placeholder="0"
                onSave={(val) => { updateDeal(deal.id, { value: parseFloat(val) || 0 }).catch(() => toast.error('Failed to update value')); }}
                className="font-bold w-[120px]"
              />
            </div>
          </div>
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground self-center">Priority</span>
            <EditableField
              value={deal.priority || 'Medium'}
              placeholder="Medium"
              onSave={(val) => { updateDeal(deal.id, { priority: val as Deal['priority'] }).catch(() => toast.error('Failed to update priority')); }}
              className="w-[120px]"
            />
          </div>
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground self-center">Expected Close</span>
            <EditableField
              value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : ''}
              placeholder="YYYY-MM-DD"
              onSave={(val) => { updateDeal(deal.id, { expectedCloseDate: val }).catch(() => toast.error('Failed to update close date')); }}
              className="w-[120px]"
            />
          </div>
          {deal.description && (
            <div className="px-4 py-2.5">
              <span className="text-xs text-muted-foreground block mb-1">Description</span>
              <p className="text-xs text-foreground bg-secondary/50 p-2.5 rounded-lg border border-border">
                {deal.description}
              </p>
            </div>
          )}
        </div>
      ),
    },
    // 21.3: Associated Contacts section
    {
      id: 'contacts',
      title: 'Associated Contacts',
      icon: ContactIcon,
      count: linkedContacts.length,
      collapsible: true,
      content: (
        <div className="divide-y divide-border text-sm">
          {linkedContacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpenContactPanel?.(c.id)}
              className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Unnamed Contact'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.email || c.phone || 'No contact info'}
                </p>
              </div>
              {c.phone && (
                <span className="text-xs text-muted-foreground">{c.phone}</span>
              )}
            </button>
          ))}
          {linkedContacts.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">No contacts linked.</p>
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-primary hover:underline"
                onClick={() => toast.info('Link Contact functionality coming soon')}
              >
                + Link Contact
              </button>
            </div>
          )}
        </div>
      ),
    },
    // 21.4: Company/Organization section
    {
      id: 'organization',
      title: 'Company / Organization',
      icon: Building,
      count: dealOrganization ? 1 : 0,
      collapsible: true,
      content: dealOrganization ? (
        <button
          type="button"
          onClick={() => onOpenAccountPanel?.(dealOrganization.id)}
          className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer text-left"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {dealOrganization.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {dealOrganization.industry || 'General Industry'}
            </p>
          </div>
          <Chip>{dealOrganization.city || 'Account'}</Chip>
        </button>
      ) : (
        <div className="p-4 text-center text-xs text-muted-foreground">
          No organization linked to this deal.
        </div>
      ),
    },
    // 21.5: Tasks section with InlineTaskForm
    { id: 'tasks', title: 'Tasks', icon: CheckCircle2, collapsible: true, content: <RelatedTasks links={{ dealId: deal.id }} /> },
    // 21.6: Custom Fields section
    {
      id: 'custom-fields',
      title: 'Custom Fields',
      icon: Table2,
      count: customFields.length,
      collapsible: true,
      content: (
        <div className="px-4 py-3">
          <CustomFieldsSection
            fields={customFields}
            canEdit={canEditDeal}
            onAdd={(field) => {
              const newField: CustomFieldItem = {
                id: `cf-${Date.now()}`,
                ...field,
              };
              setCustomFields((prev) => [...prev, newField]);
              if (updateDeal) {
                updateDeal(deal.id, { customFields: [...customFields, newField] } as any).catch(() => {
                  toast.error('Failed to save custom field');
                });
              }
              toast.success('Custom field added');
            }}
            onUpdate={(fieldId, value) => {
              setCustomFields((prev) =>
                prev.map((f) => (f.id === fieldId ? { ...f, value } : f))
              );
              const updated = customFields.map((f) => (f.id === fieldId ? { ...f, value } : f));
              if (updateDeal) {
                updateDeal(deal.id, { customFields: updated } as any).catch(() => {
                  toast.error('Failed to update custom field');
                });
              }
              toast.success('Field updated');
            }}
            onDelete={(fieldId) => {
              setCustomFields((prev) => prev.filter((f) => f.id !== fieldId));
              const updated = customFields.filter((f) => f.id !== fieldId);
              if (updateDeal) {
                updateDeal(deal.id, { customFields: updated } as any).catch(() => {
                  toast.error('Failed to delete custom field');
                });
              }
              toast.success('Custom field removed');
            }}
          />
        </div>
      ),
    },
    // 21.7: Files section
    {
      id: 'files',
      title: 'Files',
      icon: Paperclip,
      count: files.length,
      collapsible: true,
      content: (
        <div className="px-4 py-3">
          <FilesSection
            files={files}
            canUpload={canEditDeal}
            canDelete={canEditDeal}
            onUpload={async (file) => {
              // Placeholder — file upload backend not yet implemented
              const newFile: FileRecord = {
                id: `file-${Date.now()}`,
                name: file.name,
                size: file.size,
                url: URL.createObjectURL(file),
                uploadedBy: 'You',
                uploadedAt: new Date().toISOString(),
              };
              setFiles((prev) => [newFile, ...prev]);
              toast.info('File stored locally — server upload coming soon');
            }}
            onDelete={(fileId) => {
              setFiles((prev) => prev.filter((f) => f.id !== fileId));
              toast.info('File removed locally — server sync coming soon');
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <>
    <ConfirmActionDialog {...confirmDialogProps} />
    <ContextualRecordPanel
      open={open}
      onOpenChange={onOpenChange}
      module="deal"
      fullPageHref={`/crm/deals/${deal.id}`}
      record={{
        id: deal.id,
        title: deal.title,
        subtitle: `${formatCurrency(deal.value ?? 0, tenantCurrency)} · ${dealPipeline?.name || 'Pipeline'}`,
        company: deal.companyName,
        tags: [deal.priority ? `${deal.priority} Priority` : 'Medium Priority'],
      }}
      statuses={dealStages}
      status={currentStage}
      onStatusChange={async (stageLabel) => {
        const targetStage = dealStages.find((s) => s.label === stageLabel || s.id === stageLabel);
        if (targetStage?.id) {
          await moveDealStage(deal.id, targetStage.id);
          toast.success(`Stage moved to ${stageLabel}`);
        }
      }}
      pipeline={{
        name: dealPipeline?.name || 'Sales Pipeline',
        stages: dealStages,
        current: currentStage,
        onChange: async (st) => {
          const target = dealStages.find((s) => s.id === st || s.label === st);
          if (target?.id) {
            await moveDealStage(deal.id, target.id);
            toast.success(`Stage moved to ${target.label}`);
          }
        },
      }}
      sections={sections}
      manageMenu={[
        {
          label: 'Edit Deal',
          icon: Pencil,
          onSelect: () => onEdit?.(deal),
        },
        {
          label: 'Delete Deal',
          icon: Trash2,
          destructive: true,
          onSelect: () => showConfirm({
            title: 'Delete Deal',
            description: `Delete ${deal.title}?`,
            warning: 'This cannot be undone.',
            confirmLabel: 'Delete Deal',
            variant: 'destructive',
            onConfirm: async () => {
              await deleteDeal(deal.id);
              onOpenChange(false);
              toast.success('Deal deleted');
            },
          }),
        },
      ]}
    />
    </>
  );
}
