'use client';

import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  Mail,
  MessageSquare,
  Phone,
  Plus,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  History,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Trash2,
  Zap,
  GitMerge,
  Eye,
  Pencil,
  Download,
  Upload,
  Calendar,
  Layers,
  Sparkles,
  Copy,
  Building,
  User,
  Clock,
  Send,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

import { Sheet, SheetContent } from '@/shared/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Separator } from '@/shared/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type {
  RecordModule,
  StatusOption,
  PipelineStage,
  ActivityItem,
  FileItem,
  SectionConfig,
  CustomFieldItem,
} from './moduleConfig';

/* ---------------------------------- types --------------------------------- */

export interface RecordPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: RecordModule;
  record: {
    id: string;
    title: string;
    subtitle?: string;
    avatar?: React.ReactNode;
    metadataCount?: number;
    email?: string;
    phone?: string;
    company?: string;
    owner?: string;
    tags?: string[];
  };
  statuses: StatusOption[];
  status: string;
  onStatusChange: (status: string) => void;
  pipeline?: {
    name: string;
    stages: PipelineStage[];
    current: string;
    onChange: (stage: string) => void;
  };
  activity: ActivityItem[];
  sections: SectionConfig[];
  files?: FileItem[];
  actions?: {
    email?: () => void;
    message?: () => void;
    call?: () => void;
    add?: () => void;
  };
  manageMenu?: {
    label: string;
    icon: LucideIcon;
    destructive?: boolean;
    onSelect: () => void;
  }[];
  onUploadFile?: (file: File) => void;
  onDeleteFile?: (id: string) => void;
  onAddCustomField?: (field: Omit<CustomFieldItem, 'id'>) => void;
  onAddActivity?: (activity: { kind: 'note' | 'call' | 'task' | 'email'; title: string; notes?: string }) => void;
  loading?: boolean;
}

/* -------------------------------- primitives ------------------------------ */

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80 ring-1 ring-border/50',
        className
      )}
    >
      {children}
    </span>
  );
}

export function IconButton({
  label,
  children,
  onClick,
  active,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground shadow-sm transition-all duration-200 hover:bg-accent/80 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
            active && 'border-primary/40 bg-primary/10 text-primary'
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ActionPillButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = 'default',
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'outline';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 shadow-sm',
        variant === 'default' && 'border border-border/60 bg-card text-foreground hover:bg-accent hover:text-foreground',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'outline' && 'border border-dashed border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

export function SectionCard({
  icon: Icon,
  title,
  count,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all duration-200">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/40 bg-secondary/20 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {collapsible ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={`Toggle ${title}`}
              className="flex items-center gap-2 text-muted-foreground transition-transform hover:text-foreground focus-visible:outline-none"
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', !open && '-rotate-90')} />
              <h3 className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {title}
              </h3>
            </button>
          ) : (
            <>
              <Icon className="h-4 w-4 shrink-0 text-primary/80" />
              <h3 className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {title}
              </h3>
            </>
          )}
          {count !== undefined && (
            <span className="rounded-md bg-background px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border/50">
              {count}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-muted-foreground">{actions}</div>
      </header>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function SmallAction({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-accent/80 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AvatarTile({
  title,
  avatar,
  className,
}: {
  title: string;
  avatar?: React.ReactNode;
  className?: string;
}) {
  if (avatar) return <div className={cn('shrink-0', className)}>{avatar}</div>;

  const initials = title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <span
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-brand text-sm font-semibold text-primary-foreground shadow-sm',
        className
      )}
    >
      {initials || 'CR'}
    </span>
  );
}

/* --------------------------------- main panel ----------------------------- */

export function RecordPanel({
  open,
  onOpenChange,
  module,
  record,
  statuses,
  status,
  onStatusChange,
  pipeline,
  activity = [],
  sections = [],
  files = [],
  actions,
  manageMenu,
  onUploadFile,
  onDeleteFile,
  onAddCustomField,
  onAddActivity,
  loading = false,
}: RecordPanelProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [customFieldOpen, setCustomFieldOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('activity');
  const [activityFilter, setActivityFilter] = useState<string>('All');
  const [activitySearch, setActivitySearch] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Composer State for Sales Reps
  const [composerMode, setComposerMode] = useState<'note' | 'call' | 'task' | 'email'>('note');
  const [composerText, setComposerText] = useState('');
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [localActivities, setLocalActivities] = useState<ActivityItem[]>([]);

  // Combined activities (props + locally logged)
  const combinedActivities = useMemo(() => {
    return [...localActivities, ...activity];
  }, [localActivities, activity]);

  // Filter activities based on pill and search
  const filteredActivities = useMemo(() => {
    return combinedActivities.filter((item) => {
      // Category filter
      if (activityFilter === 'Notes' && item.kind !== 'note') return false;
      if (activityFilter === 'Calls & Emails' && item.kind !== 'email' && item.kind !== 'call') return false;
      if (activityFilter === 'Tasks' && item.kind !== 'task') return false;
      if (activityFilter === 'Status' && item.kind !== 'status') return false;

      // Keyword search
      if (activitySearch.trim()) {
        const query = activitySearch.toLowerCase();
        const textToMatch = `${item.title || ''} ${item.from || ''} ${item.to || ''} ${item.actor?.name || ''}`.toLowerCase();
        return textToMatch.includes(query);
      }
      return true;
    });
  }, [combinedActivities, activityFilter, activitySearch]);

  const moduleLabel = module.charAt(0).toUpperCase() + module.slice(1);

  // Quick Copy Helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Quick Activity Submit
  const handlePostActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim()) return;

    setComposerSubmitting(true);
    const newTitle = composerText.trim();
    
    if (onAddActivity) {
      onAddActivity({
        kind: composerMode,
        title: newTitle,
      });
    } else {
      // Fallback local append
      const newAct: ActivityItem = {
        id: `local-act-${Date.now()}`,
        kind: composerMode,
        title: newTitle,
        when: 'Just now',
        actor: { name: 'You (Current User)', initials: 'ME' },
      };
      setLocalActivities((prev) => [newAct, ...prev]);
      toast.success(`${composerMode.charAt(0).toUpperCase() + composerMode.slice(1)} logged successfully`);
    }

    setComposerText('');
    setComposerSubmitting(false);
  };

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && onUploadFile) {
      onUploadFile(selectedFile);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && onUploadFile) {
      onUploadFile(droppedFile);
    }
  };

  // Extract contact points from record or subtitle
  const contactEmail = record.email || (record.subtitle?.includes('@') ? record.subtitle.split('·')[0].trim() : undefined);
  const contactPhone = record.phone;

  // Active stages sequence
  const stageList = pipeline?.stages || [];
  const currentStageLabel = pipeline?.current || status;
  const currentStageIndex = stageList.findIndex((s) => s.label === currentStageLabel || (s as any).id === currentStageLabel);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-l border-border bg-background p-0 sm:max-w-[620px] lg:max-w-[680px]"
        >
          <TooltipProvider delayDuration={150}>
            <Tabs defaultValue="activity" value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
              
              {/* ========================================================================= */}
              {/*                                HEADER SECTION                            */}
              {/* ========================================================================= */}
              <div className="sticky top-0 z-10 shrink-0 border-b border-border/60 bg-card/95 px-6 pt-6 backdrop-blur-md">
                
                {/* 1. Main Title & Status Row */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <AvatarTile title={record.title} avatar={record.avatar} />
                    <div className="min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          {moduleLabel}
                        </span>
                        {record.tags && record.tags.map((tag) => (
                          <Chip key={tag} className="text-[10px] py-0">{tag}</Chip>
                        ))}
                      </div>
                      <h2 className="truncate font-subtitle text-2xl font-bold tracking-tight text-foreground mt-1">
                        {record.title}
                      </h2>
                      {record.subtitle && (
                        <p className="truncate text-xs text-muted-foreground mt-0.5 font-medium">
                          {record.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Dropdown Selector */}
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/50 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-secondary hover:border-border active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              status.toLowerCase().includes('won') || status.toLowerCase().includes('closed') || status.toLowerCase().includes('active')
                                ? 'bg-success'
                                : status.toLowerCase().includes('hot') || status.toLowerCase().includes('warm')
                                ? 'bg-warning'
                                : 'bg-primary'
                            )}
                          />
                          <span className="truncate max-w-[130px]">{status || 'Set Status'}</span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Change {moduleLabel} Status
                        </div>
                        <DropdownMenuSeparator />
                        {statuses.map((st) => {
                          const active = st.label === status;
                          return (
                            <DropdownMenuItem
                              key={st.label}
                              onSelect={() => onStatusChange(st.label)}
                              className="flex items-center justify-between text-xs py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'h-2 w-2 rounded-full',
                                    st.tone === 'success' ? 'bg-success' : st.tone === 'warning' ? 'bg-warning' : 'bg-primary'
                                  )}
                                />
                                <span>{st.label}</span>
                              </div>
                              {active && <Check className="h-3.5 w-3.5 text-primary" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {record.metadataCount !== undefined && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Mail className="h-3 w-3" /> {record.metadataCount} emails logged
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Quick Contact & Rep Context Strip */}
                {(contactEmail || contactPhone || record.company || record.owner) && (
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-xs border border-border/40">
                    {contactEmail && (
                      <div className="flex items-center gap-1 text-muted-foreground group">
                        <Mail className="h-3.5 w-3.5 text-primary/80" />
                        <a
                          href={`mailto:${contactEmail}`}
                          className="font-medium text-foreground hover:underline truncate max-w-[180px]"
                        >
                          {contactEmail}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopy(contactEmail, 'Email')}
                          className="opacity-60 hover:opacity-100 p-0.5 hover:bg-accent rounded"
                          title="Copy Email"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    {contactPhone && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="text-border">|</span>
                        <Phone className="h-3.5 w-3.5 text-success" />
                        <a href={`tel:${contactPhone}`} className="font-medium text-foreground hover:underline">
                          {contactPhone}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopy(contactPhone, 'Phone')}
                          className="opacity-60 hover:opacity-100 p-0.5 hover:bg-accent rounded"
                          title="Copy Phone"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    {record.company && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="text-border">|</span>
                        <Building className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground truncate max-w-[140px]">{record.company}</span>
                      </div>
                    )}

                    {record.owner && (
                      <div className="flex items-center gap-1 text-muted-foreground ml-auto">
                        <User className="h-3.5 w-3.5" />
                        <span className="text-xs text-muted-foreground">Rep:</span>
                        <span className="font-medium text-foreground">{record.owner}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Interactive Stage Stepper / Progress Bar */}
                {stageList.length > 0 && (
                  <div className="mt-3.5 overflow-x-auto pb-1 scrollbar-none">
                    <div className="flex items-center min-w-max gap-1">
                      {stageList.map((st, idx) => {
                        const isCurrent = idx === currentStageIndex || st.label === currentStageLabel;
                        const isPassed = currentStageIndex > -1 && idx < currentStageIndex;
                        const isLast = idx === stageList.length - 1;

                        return (
                          <React.Fragment key={st.label}>
                            <button
                              type="button"
                              onClick={() => {
                                if (pipeline) {
                                  pipeline.onChange((st as any).id || st.label);
                                } else {
                                  onStatusChange(st.label);
                                }
                              }}
                              className={cn(
                                'group flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 active:scale-95 focus-visible:outline-none',
                                isCurrent
                                  ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary'
                                  : isPassed
                                  ? 'bg-secondary/70 text-foreground hover:bg-secondary ring-1 ring-border/50'
                                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/80'
                              )}
                            >
                              {isPassed ? (
                                <Check className="h-3 w-3 text-primary shrink-0" />
                              ) : (
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 rounded-full',
                                    isCurrent ? 'bg-primary-foreground' : 'bg-muted-foreground/50'
                                  )}
                                />
                              )}
                              <span>{st.label}</span>
                            </button>
                            {!isLast && (
                              <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Action Row (Employee Primary Buttons) */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ActionPillButton
                      icon={Mail}
                      label="Email"
                      onClick={actions?.email}
                      disabled={!actions?.email}
                    />
                    <ActionPillButton
                      icon={Phone}
                      label="Call"
                      onClick={actions?.call}
                      disabled={!actions?.call}
                    />
                    <ActionPillButton
                      icon={MessageSquare}
                      label="Message"
                      onClick={actions?.message}
                      disabled={!actions?.message}
                    />
                    <ActionPillButton
                      icon={Plus}
                      label="Log Activity"
                      variant="primary"
                      onClick={() => {
                        setActiveTab('activity');
                        actions?.add?.();
                      }}
                    />
                  </div>

                  {/* Secondary / Manage Dropdown */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Manage ${moduleLabel}`}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Record Actions</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="w-56">
                      {manageMenu && manageMenu.length > 0 ? (
                        manageMenu.map((item) => (
                          <React.Fragment key={item.label}>
                            {item.destructive && <DropdownMenuSeparator />}
                            <DropdownMenuItem destructive={item.destructive} onSelect={item.onSelect}>
                              <item.icon className="h-4 w-4 mr-2" /> {item.label}
                            </DropdownMenuItem>
                          </React.Fragment>
                        ))
                      ) : (
                        <>
                          <DropdownMenuItem onSelect={() => {}}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit {moduleLabel}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => {}}>
                            <Zap className="h-4 w-4 mr-2" /> Trigger Workflow
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => {}}>
                            <GitMerge className="h-4 w-4 mr-2" /> Merge Record
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => {}}>
                            <Eye className="h-4 w-4 mr-2" /> View Audit Trail
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => {}}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete {moduleLabel}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* 5. Navigation Tabs */}
                <TabsList className="mt-4 mb-3 flex h-10 w-full items-center rounded-lg bg-secondary/50 p-1 text-muted-foreground">
                  <TabsTrigger
                    value="activity"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:text-foreground focus-visible:outline-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Activity</span>
                    <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-medium">
                      {combinedActivities.length}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="details"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:text-foreground focus-visible:outline-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Details</span>
                    <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-medium">
                      {sections.length}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="files"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:text-foreground focus-visible:outline-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Files</span>
                    {files.length > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-medium">
                        {files.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ========================================================================= */}
              {/*                                BODY CONTENT AREA                         */}
              {/* ========================================================================= */}
              <div className="flex-1 overflow-hidden bg-background">
                
                {/* ----------------------------- TAB 1: ACTIVITY ------------------------- */}
                <TabsContent value="activity" className="h-full overflow-y-auto custom-scrollbar m-0 outline-none">
                  <div className="p-6 space-y-5">
                    
                    {/* Quick Composer Widget */}
                    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                      <div className="flex items-center justify-between border-b border-border/40 bg-secondary/30 px-4 py-2">
                        <div className="flex items-center gap-1">
                          {(['note', 'call', 'task', 'email'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setComposerMode(mode)}
                              className={cn(
                                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200',
                                composerMode === mode
                                  ? 'bg-background text-foreground shadow-xs font-semibold'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                              )}
                            >
                              {mode === 'note' && <FileText className="h-3.5 w-3.5 text-primary" />}
                              {mode === 'call' && <Phone className="h-3.5 w-3.5 text-success" />}
                              {mode === 'task' && <CheckCircle2 className="h-3.5 w-3.5 text-warning-foreground" />}
                              {mode === 'email' && <Mail className="h-3.5 w-3.5 text-primary" />}
                              <span className="capitalize">{mode}</span>
                            </button>
                          ))}
                        </div>
                        <span className="text-[11px] text-muted-foreground">Quick Log</span>
                      </div>

                      <form onSubmit={handlePostActivity} className="p-3">
                        <Textarea
                          value={composerText}
                          onChange={(e) => setComposerText(e.target.value)}
                          placeholder={
                            composerMode === 'note'
                              ? 'Write meeting notes, observations, or follow-up summary...'
                              : composerMode === 'call'
                              ? 'Log call outcome, duration, and key discussion points...'
                              : composerMode === 'task'
                              ? 'Describe next action required...'
                              : 'Log sent or received email summary...'
                          }
                          className="min-h-[70px] resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
                        />
                        <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Will be timestamped now
                          </span>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!composerText.trim() || composerSubmitting}
                            className="h-7 px-3 text-xs gap-1.5 font-medium"
                          >
                            <Send className="h-3 w-3" />
                            <span>Save {composerMode.charAt(0).toUpperCase() + composerMode.slice(1)}</span>
                          </Button>
                        </div>
                      </form>
                    </div>

                    {/* Timeline Controls: Search & Category Filter Pills */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Activity Timeline ({filteredActivities.length})
                        </h4>
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                          {['All', 'Notes', 'Calls & Emails', 'Tasks', 'Status'].map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setActivityFilter(f)}
                              className={cn(
                                'rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition-all duration-200 active:scale-95',
                                activityFilter === f
                                  ? 'bg-secondary font-medium text-foreground ring-1 ring-border/60 shadow-xs'
                                  : 'text-muted-foreground hover:bg-accent/80'
                              )}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Search Bar */}
                      <div className="relative min-w-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search keywords, actions, or reps..."
                          value={activitySearch}
                          onChange={(e) => setActivitySearch(e.target.value)}
                          className="h-8.5 rounded-lg pl-9 text-xs border-border/60 shadow-xs focus-visible:border-primary"
                        />
                      </div>
                    </div>

                    {/* Timeline List */}
                    {loading ? (
                      <div className="space-y-3 pt-2" aria-busy="true">
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="h-14 w-full animate-pulse rounded-lg bg-muted" />
                        ))}
                      </div>
                    ) : filteredActivities.length > 0 ? (
                      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-[2px] before:bg-border/60">
                        {filteredActivities.map((a, i) => (
                          <div
                            key={a.id || i}
                            className="group relative rounded-xl border border-border/60 bg-card p-3.5 shadow-xs transition-all duration-200 hover:border-border hover:shadow-sm"
                          >
                            {/* Icon Marker */}
                            <span
                              className={cn(
                                'absolute -left-[27px] top-3.5 grid h-6 w-6 place-items-center rounded-full shadow-xs ring-4 ring-background',
                                a.kind === 'task' && 'bg-warning/20 text-warning-foreground',
                                a.kind === 'status' && 'bg-muted text-muted-foreground',
                                a.kind === 'email' && 'bg-primary/15 text-primary',
                                a.kind === 'call' && 'bg-success/20 text-success',
                                a.kind === 'created' && 'bg-primary/20 text-primary',
                                a.kind === 'note' && 'bg-secondary text-secondary-foreground'
                              )}
                            >
                              {a.kind === 'task' && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {a.kind === 'status' && <History className="h-3.5 w-3.5" />}
                              {a.kind === 'email' && <Mail className="h-3 w-3" />}
                              {a.kind === 'call' && <Phone className="h-3 w-3" />}
                              {a.kind === 'created' && <Sparkles className="h-3 w-3" />}
                              {a.kind === 'note' && <FileText className="h-3 w-3" />}
                            </span>

                            {/* Activity Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground leading-snug">
                                  {a.kind === 'status' ? (
                                    <span className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-muted-foreground font-normal">Status changed from</span>
                                      {a.from && <Chip>{a.from}</Chip>}
                                      <span className="text-muted-foreground">→</span>
                                      {a.to && <Chip className="bg-primary/10 text-primary">{a.to}</Chip>}
                                    </span>
                                  ) : a.kind === 'task' ? (
                                    <span>
                                      <span className="text-muted-foreground font-normal">Task: </span>
                                      {a.title}
                                    </span>
                                  ) : (
                                    <span>{a.title}</span>
                                  )}
                                </p>
                                {a.actor?.name && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    by {a.actor.name}
                                  </p>
                                )}
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                {a.actor?.initials && (
                                  <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-gradient-brand text-[9px] font-bold text-primary-foreground">
                                    {a.actor.initials}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {a.when}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border/70 bg-card/40">
                        <History className="h-8 w-8 text-muted-foreground/40" />
                        <h4 className="mt-3 font-medium text-foreground text-sm">No activity recorded</h4>
                        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                          Use the composer above to log your first note, call outcome, or reminder.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ----------------------------- TAB 2: DETAILS -------------------------- */}
                <TabsContent value="details" className="h-full overflow-y-auto custom-scrollbar m-0 bg-secondary/10 p-6 outline-none">
                  {loading ? (
                    <div className="space-y-4" aria-busy="true">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="h-32 w-full animate-pulse rounded-xl bg-muted" />
                      ))}
                    </div>
                  ) : sections.length > 0 ? (
                    <div className="space-y-4 pb-8">
                      {sections.map((sec) => (
                        <SectionCard
                          key={sec.id}
                          icon={sec.icon}
                          title={sec.title}
                          count={sec.count}
                          collapsible={sec.collapsible}
                          actions={sec.actions}
                        >
                          {sec.content}
                        </SectionCard>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border/60 bg-card">
                      <Layers className="h-8 w-8 text-muted-foreground/40" />
                      <p className="mt-3 text-sm font-medium text-muted-foreground">No sections configured for this record.</p>
                    </div>
                  )}
                </TabsContent>

                {/* ----------------------------- TAB 3: FILES ---------------------------- */}
                <TabsContent value="files" className="h-full overflow-y-auto custom-scrollbar m-0 p-6 outline-none">
                  <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />

                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200',
                      isDragOver
                        ? 'border-primary bg-primary/5 scale-[1.01]'
                        : 'border-border/70 bg-card hover:border-border hover:bg-secondary/20'
                    )}
                  >
                    <Upload className={cn('h-8 w-8 transition-colors duration-200', isDragOver ? 'text-primary' : 'text-muted-foreground/60')} />
                    <p className="mt-3 text-sm font-medium text-foreground">
                      Drag & drop files here, or{' '}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary hover:underline font-semibold"
                      >
                        browse files
                      </button>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Supports PDFs, images, contracts, invoices, and spreadsheets
                    </p>
                  </div>

                  {files.length > 0 ? (
                    <div className="mt-6 space-y-3 pb-8">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Attached Files ({files.length})
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add File
                        </Button>
                      </div>

                      <ul className="divide-y divide-border/40 rounded-xl border border-border/60 bg-card shadow-xs overflow-hidden">
                        {files.map((file) => (
                          <li
                            key={file.id}
                            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3.5 transition-colors hover:bg-secondary/30"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary shadow-xs">
                                <FileText className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {file.size} · Uploaded {file.uploadedAt} {file.uploadedBy ? `by ${file.uploadedBy}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                              {file.url && (
                                <SmallAction label="Download">
                                  <a href={file.url} download={file.name} target="_blank" rel="noreferrer">
                                    <Download className="h-4 w-4" />
                                  </a>
                                </SmallAction>
                              )}
                              {onDeleteFile && (
                                <SmallAction label="Delete" onClick={() => onDeleteFile(file.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </SmallAction>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-12 flex flex-col items-center justify-center text-center opacity-80">
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/5 ring-1 ring-primary/10">
                        <FileText className="h-6 w-6 text-primary/70" />
                      </span>
                      <h4 className="mt-3 font-medium text-foreground text-sm">No files attached</h4>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Uploaded documents, contracts, and proposals will appear here for your team.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-5 h-8 text-xs shadow-xs"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload File
                      </Button>
                    </div>
                  )}
                </TabsContent>

              </div>
            </Tabs>
          </TooltipProvider>
        </SheetContent>
      </Sheet>

      {/* ------------------------------ DIALOG 1: STATUS CHANGER -------------------- */}
      {statusOpen && (
        <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Update Status</DialogTitle>
            </DialogHeader>
            <ul className="py-2 space-y-1">
              {statuses.map((st) => {
                const active = st.label === status;
                return (
                  <li key={st.label}>
                    <button
                      type="button"
                      onClick={() => {
                        onStatusChange(st.label);
                        setStatusOpen(false);
                      }}
                      className={cn(
                        'grid w-full grid-cols-[1.25rem_0.5rem_minmax(0,1fr)] items-center gap-3 px-4 py-2.5 rounded-lg text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:bg-accent',
                        active && 'bg-primary/10'
                      )}
                    >
                      <Check className={cn('h-4 w-4 text-primary', !active && 'opacity-0')} />
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          st.tone === 'success' ? 'bg-success' : st.tone === 'warning' ? 'bg-warning' : 'bg-primary'
                        )}
                      />
                      <div>
                        <p className={cn('font-medium', active ? 'text-primary' : 'text-foreground')}>
                          {st.label}
                        </p>
                        {st.description && (
                          <p className="text-xs text-muted-foreground">{st.description}</p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </DialogContent>
        </Dialog>
      )}

      {/* ------------------------------ DIALOG 2: PIPELINE STAGE CHANGER ------------- */}
      {pipelineOpen && pipeline && (
        <Dialog open={pipelineOpen} onOpenChange={setPipelineOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Choose Pipeline Stage</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-between px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <span>{pipeline.name}</span>
            </div>
            <ul className="py-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {pipeline.stages.map((st) => {
                const active = st.label === pipeline.current || st.id === pipeline.current;
                return (
                  <li key={st.label}>
                    <button
                      type="button"
                      onClick={() => {
                        pipeline.onChange(st.id || st.label);
                        setPipelineOpen(false);
                      }}
                      className={cn(
                        'grid w-full grid-cols-[1.25rem_0.5rem_minmax(0,1fr)] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:bg-accent',
                        active && 'bg-primary/10'
                      )}
                    >
                      <Check className={cn('h-4 w-4 text-primary', !active && 'opacity-0')} />
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          st.dot || (st.tone === 'success' ? 'bg-success' : st.tone === 'warning' ? 'bg-warning' : 'bg-muted-foreground/40')
                        )}
                      />
                      <span className={cn('truncate font-medium', active ? 'text-primary' : 'text-foreground')}>
                        {st.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </DialogContent>
        </Dialog>
      )}

      {/* ------------------------------ DIALOG 3: CUSTOM FIELD ---------------------- */}
      <CustomFieldDialog
        open={customFieldOpen}
        onOpenChange={setCustomFieldOpen}
        moduleLabel={moduleLabel}
        onSave={(field) => {
          onAddCustomField?.(field);
          setCustomFieldOpen(false);
        }}
      />
    </>
  );
}

/* ----------------------------- custom field dialog ------------------------ */

function CustomFieldDialog({
  open,
  onOpenChange,
  moduleLabel,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  moduleLabel: string;
  onSave: (field: Omit<CustomFieldItem, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldItem['type']>('text');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name, type, value, description });
    setName('');
    setValue('');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add {moduleLabel} Custom Field</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Extend this record with a custom attribute.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Field Name *
            </label>
            <Input
              required
              placeholder="e.g. Budget Authority, Referral Code"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Field Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Dropdown Select</option>
                <option value="boolean">Boolean</option>
                <option value="url">URL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Initial Value
              </label>
              <Input
                placeholder="Enter value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Description (Optional)
            </label>
            <Textarea
              placeholder="Brief description of this field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16 resize-none text-xs"
            />
          </div>

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="ghost" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              Add Field
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
