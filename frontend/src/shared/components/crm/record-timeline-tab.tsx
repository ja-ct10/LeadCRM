'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Phone,
  Mail,
  CheckCircle2,
  ArrowRight,
  Zap,
  MessageSquare,
  Upload,
  Send,
  Search,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { activitiesService } from '@/features/tenant/crm/activities/services/activities.service';
import type { Activity, ActivityType } from '@/store/types/shared.types';
import type { RecordModule } from '@/shared/hooks/use-record-detail';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecordTimelineTabProps {
  /** Activities from the useRecordDetail hook */
  activities: Activity[];
  /** Module type for creating new activities */
  module: RecordModule;
  /** Record ID for creating new activities */
  recordId: string;
  /** Callback after an activity is created (to refetch) */
  onActivityCreated?: () => void;
}

type FilterType = 'All' | 'Notes' | 'Calls & Emails' | 'Tasks' | 'Status';
type ComposerMode = 'note' | 'call' | 'email' | 'task';

// ─── Activity icon/color mapping ─────────────────────────────────────────────

const ACTIVITY_ICON_MAP: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  note: { icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  call: { icon: Phone, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  email: { icon: Mail, color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10' },
  sms: { icon: MessageSquare, color: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10' },
  task: { icon: CheckCircle2, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  meeting: { icon: MessageSquare, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
  stage_change: { icon: ArrowRight, color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10' },
  'stage-change': { icon: ArrowRight, color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10' },
  workflow: { icon: Zap, color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10' },
  deal_action: { icon: Zap, color: 'text-pink-500 bg-pink-50 dark:bg-pink-500/10' },
  file_upload: { icon: Upload, color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10' },
  'file-upload': { icon: Upload, color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10' },
};

const FILTER_MAPPING: Record<FilterType, string[]> = {
  All: [],
  Notes: ['note'],
  'Calls & Emails': ['call', 'email', 'sms'],
  Tasks: ['task'],
  Status: ['stage_change', 'stage-change', 'deal_action'],
};

const ACTIVITY_FILTER_KEY_MAP: Record<RecordModule, string> = {
  leads: 'contactId',
  contacts: 'contactId',
  accounts: 'organizationId',
  deals: 'dealId',
};

// ─── Relative time formatter ─────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Quick Composer ──────────────────────────────────────────────────────────

interface QuickComposerProps {
  module: RecordModule;
  recordId: string;
  onCreated?: () => void;
}

function QuickComposer({ module, recordId, onCreated }: QuickComposerProps): React.ReactElement {
  const [mode, setMode] = useState<ComposerMode>('note');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modes: { id: ComposerMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'note', label: 'Note', icon: FileText },
    { id: 'call', label: 'Call', icon: Phone },
    { id: 'task', label: 'Task', icon: CheckCircle2 },
    { id: 'email', label: 'Email', icon: Mail },
  ];

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      const filterKey = ACTIVITY_FILTER_KEY_MAP[module];
      await activitiesService.create({
        type: mode as ActivityType,
        title: text.trim(),
        relatedToType: module === 'accounts' ? 'company' : module === 'deals' ? 'deal' : 'contact',
        relatedToId: recordId,
        [filterKey]: recordId,
        createdBy: 'current-user',
        createdAt: new Date().toISOString(),
      } as unknown as Omit<Activity, 'id' | 'tenantId' | 'createdAt'>);
      setText('');
      toast.success(`${mode.charAt(0).toUpperCase() + mode.slice(1)} logged`);
      onCreated?.();
    } catch {
      toast.error('Failed to log activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Mode selector */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-border/50">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              mode === m.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <m.icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">Quick Log</span>
      </div>

      {/* Text input */}
      <div className="p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Write a ${mode}...`}
          className="min-h-[60px] resize-none border-0 p-0 shadow-none focus-visible:ring-0 text-sm"
          disabled={isSubmitting}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 pb-3">
        <span className="text-xs text-muted-foreground">Will be timestamped now</span>
        <Button
          type="submit"
          size="sm"
          disabled={!text.trim() || isSubmitting}
          className="gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          Save {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </Button>
      </div>
    </form>
  );
}

// ─── Timeline Entry ──────────────────────────────────────────────────────────

interface TimelineEntryProps {
  activity: Activity;
}

function TimelineEntry({ activity }: TimelineEntryProps): React.ReactElement {
  const config = ACTIVITY_ICON_MAP[activity.type] ?? ACTIVITY_ICON_MAP.note;
  const Icon = config.icon;

  return (
    <div className="flex gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group">
      {/* Icon */}
      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', config.color)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          {activity.title}
        </p>
        {activity.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {activity.description}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
        {formatRelativeTime(activity.createdAt)}
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RecordTimelineTab({
  activities,
  module,
  recordId,
  onActivityCreated,
}: RecordTimelineTabProps): React.ReactElement {
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  const filters: FilterType[] = ['All', 'Notes', 'Calls & Emails', 'Tasks', 'Status'];

  // Filter + search activities
  const filteredActivities = useMemo(() => {
    let result = activities;

    // Type filter
    if (filter !== 'All') {
      const allowedTypes = FILTER_MAPPING[filter];
      result = result.filter((a) => allowedTypes.includes(a.type));
    }

    // Search
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          (a.description?.toLowerCase().includes(query) ?? false)
      );
    }

    return result;
  }, [activities, filter, searchTerm]);

  const visibleActivities = filteredActivities.slice(0, visibleCount);
  const hasMore = filteredActivities.length > visibleCount;

  const handleLoadMore = useCallback((): void => {
    setVisibleCount((prev) => prev + 20);
  }, []);

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      {/* Quick Composer */}
      <QuickComposer module={module} recordId={recordId} onCreated={onActivityCreated} />

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                filter === f
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-auto sm:ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search activities..."
            className="pl-8 h-8 text-xs w-full sm:w-[200px]"
          />
        </div>
      </div>

      {/* Timeline list */}
      <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border/50">
        {visibleActivities.length > 0 ? (
          <>
            {visibleActivities.map((activity) => (
              <TimelineEntry key={activity.id} activity={activity} />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Load more ({filteredActivities.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-12 text-center">
            <Plus className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {activities.length === 0
                ? 'No activity yet. Log your first note above.'
                : 'No activities match your filter.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
