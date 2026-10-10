'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { DataLoadingSkeleton } from './data-view-states';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { activitiesService } from '@/features/tenant/crm/activities/services/activities.service';
import { useRecordActivities, type RecordActivityFilters, type TimelineActivity } from '@/shared/hooks/use-record-activities';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { getPageCacheGeneration } from '@/shared/cache/page-cache';
import type { RecordModule } from '@/shared/hooks/use-record-detail';
import { activityEmail, EmailActivity, EmailThread, groupEmailActivities } from './email-activity';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecordTimelineTabProps {
  /** Compact layout shared by the CRM record panels. */
  compact?: boolean;
  tasks?: React.ReactNode;
  /** Activities from the useRecordDetail hook */
  activities: TimelineActivity[];
  loading?: boolean;
  error?: string | null;
  /** Module type for creating new activities */
  module: RecordModule;
  /** Record ID for creating new activities */
  recordId: string;
  /** Callback after an activity is created (to refetch) */
  onActivityCreated?: (activity?: TimelineActivity) => void;
  notes?: TimelineActivity[];
  notesLoading?: boolean;
  notesError?: string | null;
  hasMoreNotes?: boolean;
  onLoadMoreNotes?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onFiltersChange?: (filters: RecordActivityFilters) => void;
}

const ACTIVITY_FILTERS = ['All', 'Emails', 'Tasks', 'Status'] as const;
type FilterType = typeof ACTIVITY_FILTERS[number];


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
  Emails: ['email'],
  Tasks: ['task'],
  Status: ['stage_change', 'stage-change', 'status_change', 'deal_action'],
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

function NoteComposer({ module, recordId, onCreated }: { module: RecordModule; recordId: string; onCreated?: (activity?: TimelineActivity) => void }) {
  const { addActivity } = useData();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || submitting.current) return;
    submitting.current = true; setSaving(true);
    try {
      let activity: TimelineActivity | undefined;
      if (USE_MOCK_DATA) {
        if (!user) throw new Error('Sign in to save a note');
        await addActivity({ type: 'note', title: value.slice(0, 255), description: value.length > 255 ? value : undefined, relatedToType: module === 'accounts' ? 'company' : module === 'deals' ? 'deal' : 'contact', relatedToId: recordId, createdBy: user.id, createdAt: new Date().toISOString() });
      } else {
        const response = await activitiesService.create({ type: 'note', title: value.slice(0, 255), ...(value.length > 255 ? { description: value } : {}), ...(module === 'leads' ? { leadId: recordId } : module === 'contacts' ? { contactId: recordId } : module === 'accounts' ? { accountId: recordId } : { dealId: recordId }) });
        activity = response.data;
      }
      onCreated?.(activity); setDraft(''); toast.success('Note saved');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to save note'); }
    finally { submitting.current = false; setSaving(false); }
  };
  return <form onSubmit={save} className="space-y-2 rounded-xl border border-border bg-card p-3">
    <Textarea aria-label="Note" placeholder="Write a note..." value={draft} onChange={event => setDraft(event.target.value)} disabled={saving} className="min-h-20 resize-y" />
    <div className="flex justify-end"><Button type="submit" size="sm" disabled={!draft.trim() || saving}>{saving ? 'Saving…' : 'Save note'}</Button></div>
  </form>;
}

// ─── Timeline Entry ──────────────────────────────────────────────────────────

interface TimelineEntryProps {
  activity: TimelineActivity;
  compact?: boolean;
}

function TimelineEntry({ activity, compact = false }: TimelineEntryProps): React.ReactElement {
  const email = activityEmail(activity);
  const config = ACTIVITY_ICON_MAP[activity.type] ?? ACTIVITY_ICON_MAP.note;
  const Icon = config.icon;
  if (email) return <EmailActivity email={email} />;

  return (
    <div className={cn('grid items-start hover:bg-accent/30 transition-colors group', compact ? 'grid-cols-[1.75rem_minmax(0,1fr)] gap-2 p-3 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-3 sm:p-4' : 'grid-cols-[2rem_minmax(0,1fr)] gap-3 p-4')}>
      {/* Icon */}
      <div className={cn('rounded-full flex items-center justify-center shrink-0', compact ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-8 w-8', config.color)}>
        <Icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', !compact && 'h-4 w-4')} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-foreground leading-snug break-words [overflow-wrap:anywhere]', compact ? 'text-[13px] sm:text-sm' : 'text-sm')}>
          {activity.title}
        </p>
        {activity.description && (
          <p className={cn('text-muted-foreground mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]', compact ? 'text-[11px] sm:text-xs' : 'text-xs')}>
            {activity.description}
          </p>
        )}
        <div className={cn('mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground', compact ? 'text-[11px] sm:text-xs' : 'text-xs')}>
          {activity.createdBy && <span className="break-words [overflow-wrap:anywhere]">{[activity.createdBy.firstName, activity.createdBy.lastName].filter(Boolean).join(' ')}</span>}
          <time dateTime={activity.createdAt} title={new Date(activity.createdAt).toLocaleString()}>{formatRelativeTime(activity.createdAt)}</time>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RecordTimelineTab({ activities, module, recordId, onActivityCreated, loading = false, error, compact = false, tasks, notes: providedNotes, notesLoading, notesError, hasMoreNotes, onLoadMoreNotes, hasMore, onLoadMore, onFiltersChange }: RecordTimelineTabProps): React.ReactElement {
  const canEdit = useHasPermission(`${module}.edit` as import('@leadcrm/shared').PermissionKey);
  const { user, tenant } = useAuth();
  const editorIdentity = JSON.stringify([tenant?.id, user?.id, user?.role, module, recordId]);
  const identity = JSON.stringify([editorIdentity, getPageCacheGeneration()]);
  const noteReader = useRecordActivities(module, recordId, providedNotes === undefined, undefined, { type: 'note' });
  const [saved, setSaved] = useState<{ identity: string; rows: TimelineActivity[] }>({ identity, rows: [] });
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const localNotes = saved.identity === identity ? saved.rows : [];
  const authoritativeNotes = providedNotes ?? noteReader.activities;
  useEffect(() => {
    setSaved(previous => {
      const rows = previous.rows.filter(row => !authoritativeNotes.some(note => note.id === row.id));
      return rows.length === previous.rows.length ? previous : { ...previous, rows };
    });
  }, [authoritativeNotes]);
  const merge = (rows: TimelineActivity[]) => [...new Map([...rows, ...localNotes].map(row => [row.id, row])).values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const notes = merge(authoritativeNotes);
  const allActivities = merge(activities);
  const changeFilters = (nextFilter: FilterType, search: string) => {
    setFilter(nextFilter); setSearchTerm(search);
    onFiltersChange?.({ type: FILTER_MAPPING[nextFilter].join(',') || undefined, search: search.trim() || undefined });
  };
  const filteredActivities = allActivities.filter(activity => (filter === 'All' || FILTER_MAPPING[filter].includes(activity.type)) && (!searchTerm.trim() || [activity.title, activity.description, activity.createdBy?.firstName, activity.createdBy?.lastName, activityEmail(activity)?.body, activityEmail(activity)?.subject].filter(Boolean).join(' ').toLowerCase().includes(searchTerm.trim().toLowerCase())));
  const entries = [
    ...groupEmailActivities(filteredActivities.filter(activity => activity.type === 'email')).map(thread => ({ id: `thread:${thread.key}`, createdAt: thread.createdAt, content: <EmailThread thread={thread} /> })),
    ...filteredActivities.filter(activity => activity.type !== 'email').map(activity => ({ id: activity.id, createdAt: activity.createdAt, content: <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"><TimelineEntry activity={activity} compact={compact} /></div> })),
  ].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const heading = 'text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground';
  return <div className={cn('w-full min-w-0 space-y-4', compact ? 'px-3 py-4 sm:px-4 sm:py-5' : 'px-[var(--panel-gutter,1.5rem)] py-5')}>
    <section aria-label="Notes" className="space-y-3">
      <h3 className={heading}>Notes</h3>
      {canEdit && <NoteComposer key={editorIdentity} module={module} recordId={recordId} onCreated={activity => {
        if (activity) setSaved(previous => ({ identity, rows: [...(previous.identity === identity ? previous.rows : []).filter(row => row.id !== activity.id), activity] }));
        onActivityCreated?.(activity);
      }} />}
      {(notesError ?? noteReader.error) && <p role="alert" className="text-sm text-destructive">{notesError ?? noteReader.error}</p>}
      {(notesLoading ?? noteReader.isInitialLoad) && !notes.length ? <DataLoadingSkeleton rowCount={2} columnCount={1} /> : notes.length ? <div className="divide-y divide-border rounded-xl border border-border bg-card">{notes.map(note => <TimelineEntry key={note.id} activity={note} compact={compact} />)}</div> : <p className="text-sm text-muted-foreground">No notes yet.</p>}
      {(hasMoreNotes ?? noteReader.hasMore) && <Button variant="ghost" size="sm" onClick={onLoadMoreNotes ?? noteReader.loadMore} disabled={noteReader.isRefreshing}>Load older notes</Button>}
    </section>
    {tasks ?? <section aria-label="Tasks"><h3 className={heading}>Tasks</h3></section>}
    <section aria-label="Activity Timeline" className="space-y-3">
      <h3 className={heading}>Activity Timeline</h3>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-1">{ACTIVITY_FILTERS.map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => changeFilters(value, searchTerm)} className={cn('min-h-8 rounded-full border border-border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-ring', filter === value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>{value}</button>)}</div>
      <div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search activities" placeholder="Search activities..." value={searchTerm} onChange={event => changeFilters(filter, event.target.value)} className="h-9 pl-8 text-xs" /></div>
      {loading && !allActivities.length && <div role="status" aria-label="Loading activity history"><DataLoadingSkeleton rowCount={3} columnCount={1} /></div>}
      {entries.map(entry => <React.Fragment key={entry.id}>{entry.content}</React.Fragment>)}
      {!loading && !entries.length && <p className="py-6 text-center text-sm text-muted-foreground">{filter === 'All' && !searchTerm ? 'No activity recorded for this record.' : 'No activities match your filter.'}</p>}
      {hasMore && <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={loading}>Load older activity</Button>}
    </section>
  </div>;
}
