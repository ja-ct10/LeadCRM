'use client';
import React, { useId } from 'react';
import { ChevronDown, ChevronUp, Forward, Reply } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import type { GmailEmail } from '../services/gmail.service';
import { emailAddress, mailboxDate, senderName } from '../services/email-presentation';
import { EmailMessageContent } from './email-message-content';

export const mailboxIconButton = 'inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50';

export default function EmailDetailView({ email, expanded, onToggle, onReply, onForward, topicActions, associationControls, disabled = false, onUnavailable }: {
  email: GmailEmail; expanded: boolean; onToggle: () => void; onReply: () => void; onForward: () => void; disabled?: boolean;
  topicActions?: React.ReactNode; associationControls?: React.ReactNode;
  onUnavailable?: (error: unknown) => void;
}) {
  const bodyId = useId();
  const name = senderName(email.from), address = emailAddress(email.from);
  return <article className="min-w-0 border-b border-border px-3 py-3 sm:px-6" aria-label={`Message from ${name}`}>
    <div data-message-header className="flex min-w-0 items-start gap-1 sm:gap-2">
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={bodyId} aria-label={`${expanded ? 'Collapse' : 'Expand'} message from ${name}`} className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-light)] text-sm font-semibold text-[var(--primary)] sm:h-10 sm:w-10">{name.charAt(0).toUpperCase()}</span>
        <span className="block min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span title={name} className={`min-w-0 flex-1 text-sm font-semibold text-foreground ${expanded ? '[overflow-wrap:anywhere]' : 'truncate'}`}>{name}</span>
            {!expanded && <time dateTime={email.date} title={mailboxDate(email.date, true)} className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{mailboxDate(email.date)}</time>}
          </span>
          {expanded ? <span className="block space-y-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            <span className="block">{address}</span>
            <span className="block">to {email.to.join(', ') || 'me'}</span>
            {!!email.cc?.length && <span className="block">Cc: {email.cc.join(', ')}</span>}
            <time dateTime={email.date} className="block">{mailboxDate(email.date, true)}</time>
          </span> : <span className="mt-1 block truncate text-xs text-muted-foreground">{email.snippet || '(No content)'}</span>}
        </span>
        <span className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {topicActions}
    </div>
    {expanded && <div id={bodyId} className="mt-3 min-w-0 sm:pl-[52px]">
      <h2 className="mb-3 text-sm font-semibold [overflow-wrap:anywhere]">{email.subject || '(no subject)'}</h2>
      <EmailMessageContent email={email} onUnavailable={onUnavailable} afterBody={<div className="mt-3 space-y-2 text-xs">
        <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2 [overflow-wrap:anywhere]">
          {email.leadId && <Link className="text-[var(--primary)] underline" href={`/crm/leads/${email.leadId}`}>View linked Lead</Link>}
          {email.contactId && <Link className="text-[var(--primary)] underline" href={`/crm/contacts/${email.contactId}`}>View linked Contact</Link>}
          {email.dealId && <Link className="text-[var(--primary)] underline" href={`/crm/deals/${email.dealId}`}>View related Deal</Link>}
          {!email.leadId && !email.contactId && <span className="text-muted-foreground">No unique CRM email match.</span>}
        </div>
        {associationControls}
      </div>} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-10" disabled={disabled} onClick={onReply}><Reply size={16} />Reply</Button>
        <Button type="button" variant="outline" className="min-h-10" disabled={disabled} onClick={onForward}><Forward size={16} />Forward</Button>
      </div>
    </div>}
  </article>;
}
