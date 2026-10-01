'use client';
import { useMemo, useState } from 'react';
import { safeMailboxHtml } from '@/features/tenant/inbox/services/email-html';
import type { TimelineActivity } from '@/shared/hooks/use-record-activities';

export interface ActivityEmail { id: string; providerMessageId: string; threadId: string; accountId: string; direction: string; from: string; to: string[]; subject: string; sentAt: string; body: string }
export function activityEmail(activity: TimelineActivity): ActivityEmail | undefined {
  const value = activity.metadata?.email as ActivityEmail | undefined;
  return activity.type === 'email' && value && typeof value.body === 'string' && Array.isArray(value.to) ? value : undefined;
}
export function EmailActivity({ email }: { email: ActivityEmail }) {
  const [expanded, setExpanded] = useState(false);
  const html = useMemo(() => safeMailboxHtml(email.body), [email.body]);
  return <article className="min-w-0 space-y-2 p-3 text-xs [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded bg-primary/10 px-2 py-1 font-semibold text-primary">{email.direction === 'inbound' ? 'Received' : 'Sent'}</span><time dateTime={email.sentAt}>{new Date(email.sentAt).toLocaleString()}</time></div>
    <dl className="space-y-1 text-muted-foreground"><div><dt className="inline font-medium">From: </dt><dd className="inline">{email.from}</dd></div><div><dt className="inline font-medium">To: </dt><dd className="inline">{email.to.join(', ')}</dd></div><div><dt className="inline font-medium">Subject: </dt><dd className="inline text-foreground">{email.subject || '(No subject)'}</dd></div></dl>
    <div className={expanded ? 'max-h-[60vh] overflow-auto' : 'max-h-24 overflow-hidden'}>
      {/<[a-z][\s\S]*>/i.test(email.body) ? <div className="min-w-0 text-sm leading-relaxed [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_pre]:whitespace-pre-wrap [&_a]:underline" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{email.body}</p>}
    </div>
    <button type="button" aria-expanded={expanded} className="min-h-9 text-primary hover:underline" onClick={() => setExpanded(!expanded)}>{expanded ? 'View less' : 'View more'}</button>
  </article>;
}

export function EmailConversations({ activities }: { activities: TimelineActivity[] }) {
  const threads = new Map<string, TimelineActivity[]>();
  for (const activity of activities) {
    const email = activityEmail(activity);
    const key = email ? `${email.accountId}:${email.threadId}` : activity.id;
    const entries = threads.get(key) ?? [];
    if (!entries.some(a => activityEmail(a)?.id === email?.id && email)) entries.push(activity);
    threads.set(key, entries);
  }
  return <div className="space-y-3">{[...threads.entries()].map(([key, entries]) => <section key={key} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
    <h4 className="border-b border-border p-3 text-xs font-semibold [overflow-wrap:anywhere]">{activityEmail(entries[0])?.subject.replace(/^(?:re:\s*)+/i, '') || entries[0].title} <span className="text-muted-foreground">({entries.length})</span></h4>
    <div className="divide-y divide-border">{[...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map(a => { const email = activityEmail(a); return email ? <EmailActivity key={a.id} email={email} /> : <p key={a.id} className="p-3 text-sm [overflow-wrap:anywhere]">{a.title}{a.description && <span className="block whitespace-pre-wrap">{a.description}</span>}</p>; })}</div>
  </section>)}</div>;
}
