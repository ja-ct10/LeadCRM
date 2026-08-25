'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, ArrowLeft, MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useHasPermission } from '@/shared/hooks/use-permissions';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface ActionConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  permission?: string;
  /** If true, shown as a primary button. Otherwise goes into overflow menu. */
  primary?: boolean;
}

export interface TabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  content: React.ReactNode;
}

export interface RecordDetailLayoutProps {
  /** Module identifier for permission checks */
  module: string;
  /** Record display name (e.g., "John Doe") */
  title: string;
  /** Subtitle (e.g., "STI College Global City") */
  subtitle?: string;
  /** Avatar element (e.g., initials circle) */
  avatar?: React.ReactNode;
  /** Status badge configuration */
  status?: { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' };
  /** Breadcrumb navigation trail */
  breadcrumbs: BreadcrumbItem[];
  /** Action buttons (primary + overflow) */
  actions: ActionConfig[];
  /** Tab definitions with content */
  tabs: TabConfig[];
  /** Extra content in header (e.g., pipeline progress bar for deals) */
  headerExtra?: React.ReactNode;
  /** Action bar rendered between header and tabs (e.g., quick action buttons) */
  actionBar?: React.ReactNode;
  /** Loading state — shows skeleton */
  isLoading?: boolean;
  /** Not found state — shows 404 message */
  isNotFound?: boolean;
  /** Default active tab */
  defaultTab?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ label, variant }: { label: string; variant: string }): React.ReactElement {
  const variantClasses: Record<string, string> = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    danger: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        variantClasses[variant] ?? variantClasses.neutral
      )}
      aria-label={`Status: ${label}`}
    >
      <span className={cn(
        'h-2 w-2 rounded-full',
        variant === 'success' && 'bg-emerald-500',
        variant === 'warning' && 'bg-amber-500',
        variant === 'danger' && 'bg-red-500',
        variant === 'info' && 'bg-blue-500',
        variant === 'neutral' && 'bg-slate-400',
      )} />
      {label}
    </span>
  );
}

function RecordDetailSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="h-3 w-40 bg-muted rounded-full mb-4" />
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-56 bg-muted rounded-full" />
            <div className="h-4 w-32 bg-muted/60 rounded-full" />
          </div>
          <div className="h-8 w-20 bg-muted rounded-lg" />
        </div>
      </div>
      {/* Tab list skeleton */}
      <div className="border-b border-border px-6 py-3 flex gap-4">
        <div className="h-5 w-20 bg-muted rounded-full" />
        <div className="h-5 w-20 bg-muted rounded-full" />
        <div className="h-5 w-20 bg-muted rounded-full" />
        <div className="h-5 w-20 bg-muted rounded-full" />
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <div className="h-4 w-full bg-muted rounded-full" />
        <div className="h-4 w-3/4 bg-muted rounded-full" />
        <div className="h-32 w-full bg-muted rounded-xl mt-4" />
      </div>
    </div>
  );
}

function NotFoundState({ module }: { module: string }): React.ReactElement {
  const listHref = `/crm/${module}`;
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <span className="text-2xl text-muted-foreground">?</span>
      </div>
      <h2 className="text-lg font-semibold text-foreground">Record not found</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        The record you're looking for doesn't exist or you don't have permission to view it.
      </p>
      <Link
        href={listHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {module}
      </Link>
    </div>
  );
}

// ─── Guarded Action Button ───────────────────────────────────────────────────

function GuardedActionButton({ action }: { action: ActionConfig }): React.ReactElement | null {
  const hasPermission = useHasPermission((action.permission || 'contacts.view') as import('@leadcrm/shared').PermissionKey);
  if (action.permission && !hasPermission) return null;

  return (
    <Button
      variant={action.variant ?? 'outline'}
      size="sm"
      onClick={action.onClick}
      className="gap-1.5"
    >
      <action.icon className="h-4 w-4" />
      <span className="hidden sm:inline">{action.label}</span>
    </Button>
  );
}

// ─── Main Layout ─────────────────────────────────────────────────────────────

export function RecordDetailLayout({
  module,
  title,
  subtitle,
  avatar,
  status,
  breadcrumbs,
  actions,
  tabs,
  headerExtra,
  actionBar,
  isLoading = false,
  isNotFound = false,
  defaultTab,
}: RecordDetailLayoutProps): React.ReactElement {
  if (isLoading) {
    return <RecordDetailSkeleton />;
  }

  if (isNotFound) {
    return <NotFoundState module={module} />;
  }

  const primaryActions = actions.filter((a) => a.primary);
  const overflowActions = actions.filter((a) => !a.primary);
  const initialTab = defaultTab ?? tabs[0]?.id ?? 'overview';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col h-full bg-background"
    >
      {/* ═══════════════════════ STICKY HEADER ═══════════════════════ */}
      <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-card/95 backdrop-blur-md">
        {/* Breadcrumbs row */}
        <div className="px-6 pt-4 pb-2">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium truncate max-w-[200px]">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Title + Status + Actions row */}
        <div className="px-6 pb-4 flex items-center gap-4">
          {/* Avatar */}
          {avatar && <div className="shrink-0">{avatar}</div>}

          {/* Title block */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">
                {title}
              </h1>
              {status && <StatusBadge label={status.label} variant={status.variant} />}
            </div>
            {subtitle && (
              <p className="truncate text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex items-center gap-2">
            {primaryActions.map((action) => (
              <GuardedActionButton key={action.id} action={action} />
            ))}

            {overflowActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {overflowActions.map((action) => (
                    <OverflowMenuItem key={action.id} action={action} />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Optional header extra (e.g., pipeline progress bar) */}
        {headerExtra && (
          <div className="px-6 pb-3">
            {headerExtra}
          </div>
        )}
      </header>

      {/* ═══════════════════════ ACTION BAR (optional) ═══════════════════════ */}
      {actionBar}

      {/* ═══════════════════════ TABS + CONTENT ═══════════════════════ */}
      <Tabs defaultValue={initialTab} className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 border-b border-border bg-card px-6">
          <TabsList variant="underline" className="gap-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                icon={<tab.icon className="h-4 w-4" />}
                badge={tab.count}
                className="px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0 p-0">
              {tab.content}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </motion.div>
  );
}

// ─── Overflow Menu Item (RBAC-guarded) ───────────────────────────────────────

function OverflowMenuItem({ action }: { action: ActionConfig }): React.ReactElement | null {
  const hasPermission = useHasPermission((action.permission || 'contacts.view') as import('@leadcrm/shared').PermissionKey);
  if (action.permission && !hasPermission) return null;

  return (
    <DropdownMenuItem
      onClick={action.onClick}
      className={cn(action.variant === 'destructive' && 'text-destructive focus:text-destructive')}
    >
      <action.icon className="h-4 w-4 mr-2" />
      {action.label}
    </DropdownMenuItem>
  );
}
