'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { panelTitleClass } from '@/shared/components/side-panel-styles';

/** Presentation only. Record actions, permissions and data remain with the caller. */
export function RecordIdentityHeader({ avatar, label, title, titleId, headingAs: Heading = 'h1', panel = false, badges, subtitle, titleAction, actions, topActions = false }: {
  avatar: ReactNode; label: string; title: string; titleId?: string; headingAs?: 'h1' | 'h2';
  panel?: boolean; badges?: ReactNode; subtitle?: string; titleAction?: ReactNode; actions?: ReactNode; topActions?: boolean;
}) {
  if (topActions) return <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-1.5 gap-y-3">
    <div className="flex min-w-0 items-start gap-1.5 sm:gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]">{avatar}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-1 pt-1"><span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-[var(--primary)]">{label.toUpperCase()}</span>{badges}</div>
    </div>
    <div data-record-actions className="flex min-w-0 items-center gap-1.5 [&>div]:min-w-0">{actions}</div>
    <div className="col-span-2 min-w-0"><Heading id={titleId} className={panel ? panelTitleClass : 'text-base font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-lg'}>{title}</Heading>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</p>}{titleAction}</div>
  </div>;
  return <div className="relative flex min-w-0 flex-wrap items-start gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]">{avatar}</div>
    <div className={cn('min-w-0 flex-1 basis-[calc(100%-64px)] @min-[400px]:basis-0 @min-[400px]:pr-0', panel ? 'pr-11' : 'pr-9')}>
      <div className="mb-1 flex flex-wrap gap-1"><span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-[var(--primary)]">{label.toUpperCase()}</span>{badges}</div>
      <Heading id={titleId} className={panel ? panelTitleClass : 'text-base font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-lg'}>{title}</Heading>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</p>}
      {titleAction}
    </div>
    {actions && <div className={cn('ml-[52px] flex min-w-0 max-w-[calc(100%-52px)] items-center gap-1.5 [&>div]:min-w-0 @min-[400px]:ml-0', panel ? '@min-[400px]:pr-11' : '@min-[400px]:pr-9')}>{actions}</div>}
  </div>;
}

export function RecordQuickInfo({ items, actions }: { items: { value: string; icon: LucideIcon; href?: string; label?: string; onClick?: () => void; ariaLabel?: string; disabled?: boolean }[]; actions?: ReactNode }) {
  return <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1 sm:mt-4 sm:gap-1.5">
    {items.filter(item => item.value).map(({ value, icon: Icon, href, label, onClick, ariaLabel, disabled }) => {
      const content = <><Icon className="h-3 w-3 shrink-0 text-muted-foreground sm:h-3.5 sm:w-3.5" /><span className="min-w-0 [overflow-wrap:anywhere]">{label}{value}</span></>;
      const cls = 'inline-flex min-h-8 max-w-full items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-foreground sm:min-h-9 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs';
      if (onClick) return <button key={label || value} type="button" onClick={onClick} aria-label={ariaLabel} title={ariaLabel} disabled={disabled} className={cn(cls, 'text-left enabled:cursor-pointer enabled:hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60')}>{content}</button>;
      return href ? <a key={label || value} href={href} className={cn(cls, 'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring')}>{content}</a> : <span key={label || value} className={cls}>{content}</span>;
    })}
    {actions}
  </div>;
}

export function RecordRows({ rows }: { rows: [string, unknown][] }) {
  return <dl className="divide-y divide-border/60">{rows.filter(([, value]) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)).map(([label, value]) => <div key={label} className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2.5 text-xs">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{Array.isArray(value) ? <span className="flex flex-wrap justify-end gap-1">{value.map((item, index) => <span key={index} className="rounded-md bg-[var(--primary)]/10 px-1.5 py-0.5 text-[var(--primary)]">{String(item)}</span>)}</span> : String(value)}</dd>
  </div>)}</dl>;
}

export function RecordLinkRow({ href, label, subtitle, ariaLabel }: { href: string; label: string; subtitle?: string; ariaLabel?: string }) {
  return <Link href={href} aria-label={ariaLabel} className="flex min-w-0 items-center gap-3 px-3 py-3 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="text-sm font-medium">{label}</p>{subtitle !== undefined && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}</div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  </Link>;
}
