'use client';

import React, { useState, useMemo } from 'react';
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
  Plus,
  ChevronsUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { RecordPanel, SmallAction, Chip } from './RecordPanel';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Slider } from '@/shared/components/ui/slider';
import { useData } from '@/store/DataContext';
import type { Lead, Contact, Deal, Task } from '@/store/types';
import { cn } from '@/lib/utils';
import {
  DEFAULT_LEAD_STATUSES,
  DEFAULT_CONTACT_STATUSES,
  DEFAULT_ACCOUNT_STATUSES,
  DEFAULT_PIPELINE,
  type ActivityItem,
  type FileItem,
  type CustomFieldItem,
} from './moduleConfig';

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
      toast.success('Updated successfully');
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
/*                                1. LEAD PANEL                               */
/* -------------------------------------------------------------------------- */

export interface LeadPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onEdit?: (lead: Lead) => void;
}

export function LeadPanel({ open, onOpenChange, lead, onEdit }: LeadPanelProps) {
  const {
    updateContact: updateLead,
    deleteContact: deleteLead,
    tasks,
    deals,
    organizations,
    users,
    addTask,
    addDeal,
  } = useData();

  // Local UI states for inline forms
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskMode, setTaskMode] = useState<'task' | 'call'>('task');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState(false);
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  const [showOppForm, setShowOppForm] = useState(false);
  const [oppAmount, setOppAmount] = useState('');
  const [oppConfidence, setOppConfidence] = useState([50]);
  const [oppCloseDate, setOppCloseDate] = useState('');
  const [oppNote, setOppNote] = useState('');

  const [files, setFiles] = useState<FileItem[]>([
    {
      id: 'f-1',
      name: 'Lead_Qualification_Brief.pdf',
      size: '245 KB',
      uploadedBy: 'System',
      uploadedAt: 'Today',
    },
  ]);

  const [customFields, setCustomFields] = useState<CustomFieldItem[]>([
    { id: 'cf-1', name: 'Product Interest Keywords', type: 'text', value: 'Security, Cabling, CCTV' },
  ]);

  if (!lead) return null;

  const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unnamed Lead';
  const leadOrg = organizations.find((o) => o.id === lead.accountId || o.name === lead.companyName);

  // Associated tasks & deals
  const leadTasks = tasks.filter(
    (t: Task) => (t as any).leadId === lead.id || (t as any).contactId === lead.id || t.title.toLowerCase().includes(leadName.toLowerCase())
  );
  const leadDeals = deals.filter(
    (d: Deal) => d.leadId === lead.id || (lead.companyName && d.companyName === lead.companyName)
  );

  // Dynamic activity generator
  const activityItems: ActivityItem[] = [
    {
      id: 'act-1',
      kind: 'created',
      title: `Lead record created for ${leadName}`,
      when: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : 'Recently',
      actor: { name: 'System Admin', initials: 'SA' },
    },
    ...(lead.status
      ? [
          {
            id: 'act-2',
            kind: 'status' as const,
            from: 'Inquiry',
            to: lead.status,
            when: 'Recent',
            actor: { name: 'Lead Agent', initials: 'LA' },
          },
        ]
      : []),
    ...leadTasks.map((t, idx) => ({
      id: `act-task-${t.id || idx}`,
      kind: 'task' as const,
      title: `${t.status === 'completed' ? 'Task completed' : 'Task pending'}: ${t.title}`,
      when: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'Scheduled',
      actor: { name: 'Assigned User', initials: 'AU' },
    })),
  ];

  // Handlers
  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateLead(lead.id, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast.error('Task title is required');
      return;
    }
    try {
      await addTask({
        title: taskTitle,
        description: taskTitle,
        leadId: lead.id,
        priority: taskPriority ? 'High' : 'Medium',
        assignedUserId: taskAssignee || lead.assignedUserId || users[0]?.id || '',
        dueDate: taskDueDate || new Date(Date.now() + 86400000 * 2).toISOString(),
        status: 'pending',
      } as any);
      toast.success(taskMode === 'call' ? 'Call task scheduled' : 'Task created');
      setTaskTitle('');
      setShowTaskForm(false);
    } catch {
      toast.error('Failed to create task');
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oppAmount) {
      toast.error('Please specify a deal amount');
      return;
    }
    try {
      await addDeal({
        title: `${leadName} - Deal`,
        value: Number(oppAmount.replace(/[^0-9.]/g, '')) || 10000,
        currency: 'PHP',
        leadId: lead.id,
        organizationId: leadOrg?.id,
        stageId: 'stage-1',
        pipelineId: 'pipe-1',
        description: oppNote,
        priority: 'Medium',
        expectedCloseDate: oppCloseDate || new Date(Date.now() + 86400000 * 30).toISOString(),
      } as any);
      toast.success('Deal saved');
      setShowOppForm(false);
      setOppAmount('');
      setOppNote('');
    } catch (e) {
      toast.error('Failed to create deal');
    }
  };

  const handleUploadFile = (file: File) => {
    const newFile: FileItem = {
      id: `f-${Date.now()}`,
      name: file.name,
      size: `${Math.round(file.size / 1024)} KB`,
      uploadedBy: 'You',
      uploadedAt: 'Just now',
    };
    setFiles((prev) => [newFile, ...prev]);
    toast.success(`Uploaded ${file.name}`);
  };

  const handleDeleteFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    toast.success('File removed');
  };

  // Sections configuration
  const sections = [
    {
      id: 'about',
      title: 'About',
      icon: Info,
      content: (
        <div className="divide-y divide-border text-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2">
            <EditableField 
              icon={Mail} 
              value={lead.email || ''} 
              placeholder="Add email address..."
              onSave={(val) => { lead.email = val; onEdit?.(lead); }} 
            />
            {lead.email && (
              <SmallAction label="Copy Email" onClick={() => { navigator.clipboard.writeText(lead.email!); toast.success('Email copied'); }}>
                <FileText className="h-3.5 w-3.5" />
              </SmallAction>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2">
            <EditableField 
              icon={Phone} 
              value={lead.phone || ''} 
              placeholder="Add phone number..."
              onSave={(val) => { lead.phone = val; onEdit?.(lead); }} 
            />
            {lead.phone && (
              <SmallAction label="Copy Phone" onClick={() => { navigator.clipboard.writeText(lead.phone!); toast.success('Phone copied'); }}>
                <FileText className="h-3.5 w-3.5" />
              </SmallAction>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2">
            <EditableField 
              icon={MapPin} 
              value={lead.address || ''} 
              placeholder="Add physical address..."
              onSave={(val) => { lead.address = val; onEdit?.(lead); }} 
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2">
            <EditableField 
              icon={Building} 
              value={lead.companyName || ''} 
              placeholder="Add company name..."
              onSave={(val) => { lead.companyName = val; onEdit?.(lead); }} 
            />
            {lead.companyName && <Chip>Company</Chip>}
          </div>

          {lead.productInterests && lead.productInterests.length > 0 && (
            <div className="px-4 py-2.5">
              <span className="text-xs text-muted-foreground block mb-1.5">Product Interests</span>
              <div className="flex flex-wrap gap-1.5">
                {lead.productInterests.map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
              </div>
            </div>
          )}

          {lead.leadSource && (
            <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
              <span>Source: <strong className="text-foreground">{lead.leadSource}</strong></span>
              <span>Score: <strong className="text-primary">{lead.score ?? 50}</strong></span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'tasks',
      title: 'Tasks',
      icon: CheckCircle2,
      count: leadTasks.length,
      collapsible: true,
      actions: (
        <SmallAction label="Add Task" onClick={() => setShowTaskForm((v) => !v)}>
          <Plus className="h-4 w-4" />
        </SmallAction>
      ),
      content: (
        <div className="divide-y divide-border">
          {leadTasks.map((t) => (
            <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No date'}
                </p>
              </div>
              <Chip className={t.priority === 'High' ? 'text-destructive bg-destructive/10' : ''}>
                {t.priority || 'Medium'}
              </Chip>
            </div>
          ))}

          {showTaskForm ? (
            <form onSubmit={handleCreateTask} className="p-4 bg-secondary/40 space-y-3">
              <div className="flex items-center gap-3 border-b border-border pb-2">
                <button
                  type="button"
                  onClick={() => setTaskMode('task')}
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider pb-1 transition-colors',
                    taskMode === 'task' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
                  )}
                >
                  Task
                </button>
                <button
                  type="button"
                  onClick={() => setTaskMode('call')}
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider pb-1 transition-colors',
                    taskMode === 'call' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
                  )}
                >
                  Call
                </button>
              </div>

              <Input
                autoFocus
                placeholder={taskMode === 'call' ? `Call ${leadName}` : 'Follow up with lead'}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="h-9"
              />

              {taskMode === 'task' && (
                <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Checkbox checked={taskPriority} onCheckedChange={setTaskPriority} />
                  High Priority
                  <ChevronsUp className="h-3.5 w-3.5 text-destructive" />
                </label>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="h-8 text-xs"
                />
                <select
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
                >
                  <option value="">Assignee (Default)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email}
                    </option>
                  ))}
                </select>
              </div>

              {taskMode === 'call' && (
                <p className="text-[11px] text-muted-foreground">
                  The task will automatically resolve when call activity is logged.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowTaskForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Save Task
                </Button>
              </div>
            </form>
          ) : leadTasks.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">No tasks scheduled for this lead.</p>
              <button
                type="button"
                onClick={() => setShowTaskForm(true)}
                className="mt-1 text-xs font-semibold text-primary hover:underline"
              >
                + Add Task
              </button>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'deals',
      title: 'Deals',
      icon: Trophy,
      count: leadDeals.length,
      collapsible: true,
      actions: (
        <SmallAction label="Add Deal" onClick={() => setShowOppForm((v) => !v)}>
          <Plus className="h-4 w-4" />
        </SmallAction>
      ),
      content: (
        <div className="divide-y divide-border">
          {leadDeals.map((d) => (
            <Link key={d.id} href={`/crm/deals?id=${d.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer group block">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  ₱{d.value?.toLocaleString() ?? 0} · {d.priority || 'Medium'}
                </p>
              </div>
              <Chip className="bg-warning/20 text-warning-foreground">In Progress</Chip>
            </Link>
          ))}

          {showOppForm ? (
            <form onSubmit={handleCreateDeal} className="p-4 bg-secondary/40 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Amount (e.g. 50000)"
                  value={oppAmount}
                  onChange={(e) => setOppAmount(e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  type="date"
                  placeholder="Close Date"
                  value={oppCloseDate}
                  onChange={(e) => setOppCloseDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                  <span>Confidence</span>
                  <span>{oppConfidence[0]}%</span>
                </div>
                <Slider
                  value={oppConfidence}
                  onValueChange={setOppConfidence}
                  max={100}
                  step={5}
                />
              </div>

              <Textarea
                placeholder="Deal notes or scope…"
                value={oppNote}
                onChange={(e) => setOppNote(e.target.value)}
                className="min-h-16 text-xs resize-none"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowOppForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Save Deal
                </Button>
              </div>
            </form>
          ) : leadDeals.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">No active deals attached to this lead.</p>
              <button
                type="button"
                onClick={() => setShowOppForm(true)}
                className="mt-1 text-xs font-semibold text-primary hover:underline"
              >
                + Create Deal
              </button>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'contacts',
      title: 'Company / Organization',
      icon: Building,
      count: leadOrg ? 1 : 0,
      collapsible: true,
      content: leadOrg ? (
        <Link href={`/crm/accounts?id=${leadOrg.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer group block">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{leadOrg.name}</p>
            <p className="text-xs text-muted-foreground">{leadOrg.industry || 'General Industry'}</p>
          </div>
          <Chip>{leadOrg.city || 'Account'}</Chip>
        </Link>
      ) : (
        <div className="p-4 text-center text-xs text-muted-foreground">
          No parent company assigned.
        </div>
      ),
    },
    {
      id: 'custom-fields',
      title: 'Custom Fields',
      icon: Table2,
      count: customFields.length,
      collapsible: true,
      actions: (
        <SmallAction label="Add Field" onClick={() => {
          const name = window.prompt('Field Name:');
          if (name) {
            const val = window.prompt('Field Value:') || '';
            setCustomFields((prev) => [...prev, { id: `cf-${Date.now()}`, name, type: 'text', value: val }]);
          }
        }}>
          <Plus className="h-4 w-4" />
        </SmallAction>
      ),
      content: (
        <div className="divide-y divide-border">
          {customFields.map((cf) => (
            <div key={cf.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 text-xs">
              <span className="text-muted-foreground truncate">{cf.name}</span>
              <span className="font-medium text-foreground truncate">{cf.value}</span>
              <SmallAction label="Delete" onClick={() => setCustomFields((p) => p.filter((x) => x.id !== cf.id))}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </SmallAction>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <RecordPanel
      open={open}
      onOpenChange={onOpenChange}
      module="lead"
      record={{
        id: lead.id,
        title: leadName,
        subtitle: lead.companyName || lead.email || 'Lead Profile',
        email: lead.email,
        phone: lead.phone,
        company: lead.companyName,
        owner: (lead as any).assignedTo || 'Sales Team',
        tags: [lead.source || 'Inbound'].filter(Boolean),
      }}
      statuses={DEFAULT_LEAD_STATUSES}
      status={lead.status || 'Inquiry'}
      onStatusChange={handleStatusChange}
      activity={activityItems}
      sections={sections}
      files={files}
      onUploadFile={handleUploadFile}
      onDeleteFile={handleDeleteFile}
      actions={{
        email: () => {
          if (lead.email) window.location.href = `mailto:${lead.email}`;
          else toast.info('No email address on file');
        },
        call: () => {
          if (lead.phone) window.location.href = `tel:${lead.phone}`;
          else toast.info('No phone number on file');
        },
        message: () => toast.info('Message client opened'),
        add: () => setShowTaskForm(true),
      }}
      manageMenu={[
        {
          label: 'Edit Lead',
          icon: Pencil,
          onSelect: () => onEdit?.(lead),
        },
        {
          label: 'Delete Lead',
          icon: Trash2,
          destructive: true,
          onSelect: async () => {
            if (window.confirm(`Delete lead ${leadName}?`)) {
              await deleteLead(lead.id);
              onOpenChange(false);
              toast.success('Lead deleted');
            }
          },
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                               2. CONTACT PANEL                             */
/* -------------------------------------------------------------------------- */

export interface ContactPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onEdit?: (contact: Contact) => void;
}

export function ContactPanel({ open, onOpenChange, contact, onEdit }: ContactPanelProps) {
  const { updateContact, deleteContact, tasks, deals, organizations } = useData();

  if (!contact) return null;

  const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact';
  const relatedAccount = organizations.find((o) => o.id === contact.accountId || o.name === contact.companyName);
  const contactDeals = deals.filter((d) => d.contactId === contact.id || d.leadId === contact.id);

  const sections = [
    {
      id: 'about',
      title: 'About',
      icon: Info,
      content: (
        <div className="divide-y divide-border text-sm">
          <div className="flex items-center justify-between px-4 py-2">
            <EditableField 
              icon={Mail} 
              value={contact.email || ''} 
              placeholder="Add email address..."
              onSave={(val) => { contact.email = val; onEdit?.(contact); }} 
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2">
            <EditableField 
              icon={Phone} 
              value={contact.phone || ''} 
              placeholder="Add phone number..."
              onSave={(val) => { contact.phone = val; onEdit?.(contact); }} 
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2">
            <EditableField 
              icon={MapPin} 
              value={contact.address || ''} 
              placeholder="Add physical address..."
              onSave={(val) => { contact.address = val; onEdit?.(contact); }} 
            />
          </div>
        </div>
      ),
    },
    {
      id: 'account',
      title: 'Related Account',
      icon: Building,
      content: relatedAccount ? (
        <Link href={`/crm/accounts?id=${relatedAccount.id}`} className="p-4 flex items-center justify-between text-sm hover:bg-secondary/50 transition-colors cursor-pointer group block">
          <div>
            <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{relatedAccount.name}</p>
            <p className="text-xs text-muted-foreground">{relatedAccount.industry || 'Organization'}</p>
          </div>
          <Chip>{relatedAccount.city || 'Account'}</Chip>
        </Link>
      ) : (
        <div className="p-4 text-xs text-muted-foreground text-center">No associated account.</div>
      ),
    },
    {
      id: 'deals',
      title: 'Deals',
      icon: Trophy,
      count: contactDeals.length,
      collapsible: true,
      content: (
        <div className="divide-y divide-border text-sm">
          {contactDeals.map((d) => (
            <Link key={d.id} href={`/crm/deals?id=${d.id}`} className="p-3 flex justify-between items-center hover:bg-secondary/50 transition-colors cursor-pointer group block">
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">{d.title}</p>
                <p className="text-xs text-muted-foreground">₱{d.value?.toLocaleString() ?? 0}</p>
              </div>
              <Chip>Active</Chip>
            </Link>
          ))}
          {contactDeals.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground text-center">No deals connected.</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <RecordPanel
      open={open}
      onOpenChange={onOpenChange}
      module="contact"
      record={{
        id: contact.id,
        title: contactName,
        subtitle: contact.companyName || contact.email || 'Contact Profile',
        email: contact.email,
        phone: contact.phone,
        company: contact.companyName,
        owner: (contact as any).assignedTo,
      }}
      statuses={DEFAULT_CONTACT_STATUSES}
      status={contact.status || 'Qualified'}
      onStatusChange={async (s) => {
        await updateContact(contact.id, { status: s });
        toast.success(`Status updated to ${s}`);
      }}
      activity={[
        {
          id: '1',
          kind: 'created',
          title: `Contact created for ${contactName}`,
          when: contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : 'Recent',
        },
      ]}
      sections={sections}
      actions={{
        email: () => contact.email && (window.location.href = `mailto:${contact.email}`),
        call: () => contact.phone && (window.location.href = `tel:${contact.phone}`),
      }}
      manageMenu={[
        {
          label: 'Edit Contact',
          icon: Pencil,
          onSelect: () => onEdit?.(contact),
        },
        {
          label: 'Delete Contact',
          icon: Trash2,
          destructive: true,
          onSelect: async () => {
            if (window.confirm(`Delete contact ${contactName}?`)) {
              await deleteContact(contact.id);
              onOpenChange(false);
              toast.success('Contact deleted');
            }
          },
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                               3. ACCOUNT PANEL                             */
/* -------------------------------------------------------------------------- */

export interface AccountPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any | null;
  onEdit?: (account: any) => void;
}

export function AccountPanel({ open, onOpenChange, account, onEdit }: AccountPanelProps) {
  const { contacts, deals, updateOrganization, deleteOrganization } = useData();

  if (!account) return null;

  const accountName = account.name || 'Account';
  const relatedContacts = contacts.filter((c) => c.accountId === account.id || c.companyName === accountName);
  const relatedDeals = deals.filter((d) => d.organizationId === account.id || d.companyName === accountName);

  const sections = [
    {
      id: 'about',
      title: 'About',
      icon: Info,
      content: (
        <div className="divide-y divide-border text-sm">
          <div className="flex justify-between px-4 py-2">
            <EditableField 
              value={account.industry || ''} 
              placeholder="Industry"
              onSave={(val) => { account.industry = val; onEdit?.(account); }} 
            />
          </div>
          <div className="flex justify-between px-4 py-2">
            <EditableField 
              value={account.size || ''} 
              placeholder="Company Size"
              onSave={(val) => { account.size = val; onEdit?.(account); }} 
            />
          </div>
          <div className="flex justify-between px-4 py-2">
            <EditableField 
              value={account.website || ''} 
              placeholder="Website"
              onSave={(val) => { account.website = val; onEdit?.(account); }} 
              className="text-primary"
            />
          </div>
          <div className="flex justify-between px-4 py-2">
            <EditableField 
              value={[account.city, account.province, account.country].filter(Boolean).join(', ') || ''} 
              placeholder="Location"
              onSave={(val) => { 
                const parts = val.split(',').map(s => s.trim());
                if (parts[0]) account.city = parts[0];
                if (parts[1]) account.province = parts[1];
                if (parts[2]) account.country = parts[2];
                onEdit?.(account); 
              }} 
            />
          </div>
        </div>
      ),
    },
    {
      id: 'contacts',
      title: 'Contacts',
      icon: ContactIcon,
      count: relatedContacts.length,
      collapsible: true,
      content: (
        <div className="divide-y divide-border text-sm">
          {relatedContacts.map((c) => (
            <Link key={c.id} href={`/crm/contacts?id=${c.id}`} className="p-3 flex justify-between items-center hover:bg-secondary/50 transition-colors cursor-pointer group block">
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">{c.firstName} {c.lastName}</p>
                <p className="text-xs text-muted-foreground">{c.email || c.phone || 'Contact'}</p>
              </div>
              <Chip>{c.status || 'Active'}</Chip>
            </Link>
          ))}
          {relatedContacts.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground text-center">No contacts under this account.</p>
          )}
        </div>
      ),
    },
    {
      id: 'deals',
      title: 'Deals',
      icon: Trophy,
      count: relatedDeals.length,
      collapsible: true,
      content: (
        <div className="divide-y divide-border text-sm">
          {relatedDeals.map((d) => (
            <Link key={d.id} href={`/crm/deals?id=${d.id}`} className="p-3 flex justify-between items-center hover:bg-secondary/50 transition-colors cursor-pointer group block">
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">{d.title}</p>
                <p className="text-xs text-muted-foreground">₱{d.value?.toLocaleString() ?? 0}</p>
              </div>
              <Chip>In Progress</Chip>
            </Link>
          ))}
          {relatedDeals.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground text-center">No active deals for this account.</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <RecordPanel
      open={open}
      onOpenChange={onOpenChange}
      module="account"
      record={{
        id: account.id,
        title: accountName,
        subtitle: account.industry || account.website || 'Account Profile',
        company: accountName,
        tags: [account.size, account.industry].filter(Boolean) as string[],
      }}
      statuses={DEFAULT_ACCOUNT_STATUSES}
      status={account.customerType || 'Prospect'}
      onStatusChange={async (s) => {
        await updateOrganization(account.id, { customerType: s } as any);
        toast.success(`Classification updated to ${s}`);
      }}
      activity={[
        {
          id: '1',
          kind: 'created',
          title: `Account established for ${accountName}`,
          when: account.createdAt ? new Date(account.createdAt).toLocaleDateString() : 'Recent',
        },
      ]}
      sections={sections}
      manageMenu={[
        {
          label: 'Edit Account',
          icon: Pencil,
          onSelect: () => onEdit?.(account),
        },
        {
          label: 'Delete Account',
          icon: Trash2,
          destructive: true,
          onSelect: async () => {
            if (window.confirm(`Delete account ${accountName}?`)) {
              await deleteOrganization(account.id);
              onOpenChange(false);
              toast.success('Account deleted');
            }
          },
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                4. DEAL PANEL                               */
/* -------------------------------------------------------------------------- */

export interface DealPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  onEdit?: (deal: Deal) => void;
}

export function DealPanel({ open, onOpenChange, deal, onEdit }: DealPanelProps) {
  const { pipelines, moveDealStage, deleteDeal, tasks } = useData();

  if (!deal) return null;

  const dealPipeline = pipelines.find((p) => p.id === deal.pipelineId) || pipelines[0];
  const dealStages = dealPipeline?.stages.map((s) => ({
    id: s.id,
    label: s.name,
    tone: s.isWon ? ('success' as const) : s.isLost ? ('muted' as const) : ('warning' as const),
  })) || DEFAULT_PIPELINE.stages;

  const currentStage = dealStages.find((s) => s.id === deal.stageId)?.label || 'In Progress';
  const dealTasks = tasks.filter((t) => t.dealId === deal.id);

  const sections = [
    {
      id: 'about',
      title: 'About Deal',
      icon: Info,
      content: (
        <div className="divide-y divide-border text-sm">
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground self-center">Deal Value</span>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1">₱</span>
              <EditableField 
                value={deal.value?.toString() || '0'} 
                placeholder="0"
                onSave={(val) => { deal.value = parseFloat(val) || 0; onEdit?.(deal); }} 
                className="font-bold w-[120px]"
              />
            </div>
          </div>
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground self-center">Priority</span>
            <EditableField 
              value={deal.priority || 'Medium'} 
              placeholder="Medium"
              onSave={(val) => { deal.priority = val as Deal['priority']; onEdit?.(deal); }} 
              className="w-[120px]"
            />
          </div>
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground self-center">Expected Close</span>
            <EditableField 
              value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : ''} 
              placeholder="YYYY-MM-DD"
              onSave={(val) => { deal.expectedCloseDate = val; onEdit?.(deal); }} 
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
    {
      id: 'tasks',
      title: 'Deal Tasks',
      icon: CheckCircle2,
      count: dealTasks.length,
      content: (
        <div className="divide-y divide-border text-sm">
          {dealTasks.map((t) => (
            <div key={t.id} className="p-3 flex justify-between items-center">
              <div>
                <p className="font-medium text-foreground">{t.title}</p>
                <p className="text-xs text-muted-foreground">Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '--'}</p>
              </div>
              <Chip>{t.status}</Chip>
            </div>
          ))}
          {dealTasks.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground text-center">No tasks linked to this deal.</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <RecordPanel
      open={open}
      onOpenChange={onOpenChange}
      module="deal"
      record={{
        id: deal.id,
        title: deal.title,
        subtitle: `₱${deal.value?.toLocaleString() ?? 0} · ${dealPipeline?.name || 'Pipeline'}`,
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
      activity={[
        {
          id: '1',
          kind: 'created',
          title: `Deal created: ${deal.title}`,
          when: deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : 'Recent',
        },
      ]}
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
          onSelect: async () => {
            if (window.confirm(`Delete deal ${deal.title}?`)) {
              await deleteDeal(deal.id);
              onOpenChange(false);
              toast.success('Deal deleted');
            }
          },
        },
      ]}
    />
  );
}
