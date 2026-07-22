'use client';

import React, { useMemo } from 'react';
import {
  Phone, Video, Mail, MessageSquare, StickyNote,
  CheckSquare, Zap, ArrowRight, Paperclip,
  Target, UserPlus,
} from 'lucide-react';
import { useData } from '@/store/DataContext';
import type { ActivityType } from '@/store/types';
import { usePagination } from '@/shared/hooks/usePagination';
import { Pagination } from '@/shared/components/ui/pagination';

// ─── Icon map per activity type ──────────────────────────────────────────────

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  call:             Phone,
  meeting:          Video,
  email:            Mail,
  sms:              MessageSquare,
  whatsapp:         MessageSquare,
  note:             StickyNote,
  task:             CheckSquare,
  workflow:         Zap,
  'stage-change':   ArrowRight,
  'file-upload':    Paperclip,
  'deal-created':   Target,
  'contact-created': UserPlus,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  call:             'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
  meeting:          'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
  email:            'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  sms:              'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10',
  whatsapp:         'text-green-500 bg-green-50 dark:bg-green-500/10',
  note:             'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
  task:             'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
  workflow:         'text-orange-500 bg-orange-50 dark:bg-orange-500/10',
  'stage-change':   'text-slate-500 bg-slate-100 dark:bg-white/[0.05]',
  'file-upload':    'text-slate-500 bg-slate-100 dark:bg-white/[0.05]',
  'deal-created':   'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
  'contact-created': 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface ActivityTimelineProps {
  entityType: 'contact' | 'company' | 'deal' | 'task' | 'invoice';
  entityId: string;
  maxItems?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)  return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ActivityTimeline({
  entityType,
  entityId,
  maxItems = 50,
}: ActivityTimelineProps) {
  const { activities } = useData();

  const filtered = useMemo(() =>
    activities
      .filter(a => a.relatedToType === entityType && a.relatedToId === entityId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, maxItems),
    [activities, entityType, entityId, maxItems],
  );

  if (filtered.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
        No activity recorded yet.
      </div>
    );
  }

  const pagination = usePagination({
    totalItems: filtered.length,
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  });
  const paginatedActivities = pagination.paginateItems(filtered);

  return (
    <div className="space-y-3">
      {paginatedActivities.map((activity, index) => {
        const Icon = ACTIVITY_ICONS[activity.type] ?? Zap;
        const colorClass = ACTIVITY_COLORS[activity.type] ?? 'text-slate-500 bg-slate-100';
        const isWorkflow = activity.type === 'workflow';

        return (
          <div key={activity.id} className="flex gap-3">
            {/* Icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-3 border-b border-slate-100 dark:border-white/[0.04] last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {activity.title}
                    {isWorkflow && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                        AUTO
                      </span>
                    )}
                  </p>
                  {activity.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {activity.description}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {activity.createdBy === 'system' ? 'System' : `User ${activity.createdBy}`}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                  {formatRelativeTime(activity.createdAt)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {filtered.length > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={pagination.goToPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
    </div>
  );
}
