'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Archive, ArrowLeft, Forward, Loader2, Reply, Trash2 } from 'lucide-react';
import { fetchGmailThread, associateThreadDeal, setGmailThreadReadState, archiveGmailThread, trashGmailThread, type GmailEmail } from '../services/gmail.service';
import { forwardDraft, replyDraft, type MailboxComposeDraft } from '../services/email-presentation';
import type { ApiRequestError } from '@/lib/api/client';
import EmailDetailView, { mailboxIconButton } from './email-detail-view';
import ComposeModal from './compose-modal';

const control = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50';
export default function EmailConversationView({ email, revision = 0, retryAt = 0, onBack, onEmailsChanged }: {
  email: GmailEmail; revision?: number; retryAt?: number; onBack: (error?: string) => void; onEmailsChanged: () => void;
}) {
  const [messages, setMessages] = useState<GmailEmail[]>([email]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<{ id: string; title: string; stage: string }[]>([]);
  const [canAssociate, setCanAssociate] = useState(false), [dealId, setDealId] = useState('');
  const [busy, setBusy] = useState(false), [draft, setDraft] = useState<MailboxComposeDraft | null>(null);
  const [refresh, setRefresh] = useState(0), [cooldown, setCooldown] = useState(0);
  const pending = useRef(false), readPending = useRef(false), readAttempt = useRef('');
  const callbacks = useRef({ onBack, onEmailsChanged }); callbacks.current = { onBack, onEmailsChanged };
  const paused = Math.max(retryAt, cooldown) > Date.now();
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(0), Math.max(0, cooldown - Date.now())); return () => clearTimeout(timer); }, [cooldown]);
  const failure = useCallback((error: unknown) => {
    const request = error as ApiRequestError;
    setError(error instanceof Error ? error.message : 'This email action could not be completed. Try again.');
    setCooldown(Date.parse(request.retryAt ?? '') || 0);
    if ([401, 403, 404, 409].includes(request.status ?? 0)) { setMessages([]); setDraft(null); callbacks.current.onBack('This conversation is no longer available. Refresh your Inbox or check your mailbox access.'); }
  }, []);
  useEffect(() => {
    let active = true;
    fetchGmailThread(email.threadId).then(result => {
      if (!active) return;
      const ordered = [...result.emails].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      setMessages(ordered); setDeals(result.dealOptions); setCanAssociate(result.canAssociateDeal); setError('');
      setExpanded(previous => Object.fromEntries(ordered.map((message, index) => [message.id, previous[message.id] ?? (!message.isRead || index === ordered.length - 1)])));
    }).catch(error => { if (active) failure(error); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [email.threadId, revision, refresh, failure]);
  const unreadIds = messages.filter(message => !message.isRead).map(message => message.id).sort().join(',');
  useEffect(() => {
    const key = `${email.threadId}:${unreadIds}`;
    if (loading || paused || !unreadIds || readPending.current || readAttempt.current === key) return;
    readAttempt.current = key; readPending.current = true;
    void setGmailThreadReadState(email.threadId, true).then(() => {
      setMessages(previous => previous.map(message => unreadIds.split(',').includes(message.id) ? { ...message, isRead: true, labels: message.labels.filter(label => label !== 'UNREAD') } : message));
      callbacks.current.onEmailsChanged();
    }).catch(failure).finally(() => { readPending.current = false; });
  }, [email.threadId, unreadIds, loading, paused, failure]);
  const mutate = async (action: () => Promise<unknown>, goBack = false) => {
    if (pending.current || paused) return;
    pending.current = true; setBusy(true); setError('');
    try { await action(); callbacks.current.onEmailsChanged(); if (goBack) callbacks.current.onBack(); else setRefresh(value => value + 1); }
    catch (error) { failure(error); }
    finally { pending.current = false; setBusy(false); }
  };
  const latest = messages[messages.length - 1];
  const context = [...messages].reverse().find(message => message.leadId || message.contactId) ?? latest;
  return <div className="flex h-full min-h-0 min-w-0 flex-col">
    <div role="toolbar" aria-label="Conversation actions" className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2 sm:px-4">
      <button type="button" title="Back to inbox" aria-label="Back to inbox" className={mailboxIconButton} onClick={() => onBack()}><ArrowLeft size={18} /></button>
      <span className="flex-1" />
      {busy && <Loader2 aria-label="Updating conversation" className="h-4 w-4 animate-spin text-muted-foreground" />}
      <button type="button" title="Archive conversation" aria-label="Archive conversation" disabled={loading || busy || paused || !latest} className={mailboxIconButton} onClick={() => void mutate(() => archiveGmailThread(email.threadId), true)}><Archive size={18} /></button>
      <button type="button" title="Move conversation to trash" aria-label="Move conversation to trash" disabled={loading || busy || paused || !latest} className={mailboxIconButton} onClick={() => void mutate(() => trashGmailThread(email.threadId), true)}><Trash2 size={18} /></button>
    </div>
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <header className="space-y-3 border-b border-border px-3 py-5 sm:px-6">
        <h1 aria-label={messages[0]?.subject || '(no subject)'} className="text-lg font-semibold leading-relaxed [overflow-wrap:anywhere] sm:text-xl">{messages[0]?.subject || '(no subject)'}{messages.length > 1 && <span aria-label={`${messages.length} messages`} className="ml-2 inline-block rounded bg-muted px-1.5 align-middle text-xs font-normal text-muted-foreground">{messages.length}</span>}</h1>
        {context && <div className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {context.leadId && <Link className="text-[var(--primary)] underline" href={`/crm/leads/${context.leadId}`}>View linked Lead</Link>}
            {context.contactId && <Link className="text-[var(--primary)] underline" href={`/crm/contacts/${context.contactId}`}>View linked Contact</Link>}
            {context.dealId && <Link className="text-[var(--primary)] underline" href={`/crm/deals/${context.dealId}`}>View related Deal</Link>}
            {!context.leadId && !context.contactId && <span className="text-muted-foreground">No unique CRM email match.</span>}
          </div>
          {context.needsDealAssociation && <p className="text-muted-foreground">Select the relevant open Deal for this conversation. Association does not change its stage.</p>}
          {canAssociate && deals.length > 0 && !context.dealId && <form className="flex min-w-0 flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); if (dealId) void mutate(() => associateThreadDeal(email.threadId, dealId)); }}>
            <select aria-label="Associate conversation with Deal" required disabled={busy} value={dealId} onChange={event => setDealId(event.target.value)} className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-xs focus-visible:outline-2 sm:w-80"><option value="">Select the relevant open Deal</option>{deals.map(deal => <option key={deal.id} value={deal.id}>{deal.title} · {deal.stage}</option>)}</select>
            <button type="submit" disabled={!dealId || busy || paused} className={control}>Associate Deal</button>
          </form>}
          {(context.leadId || context.contactId) && !context.dealId && !deals.length && !loading && <p className="text-muted-foreground">No open Deal available.</p>}
        </div>}
        {loading && <p role="status" className="text-xs text-muted-foreground">Loading conversation…</p>}
        {paused && <p role="status" className="text-xs text-muted-foreground">Gmail updates are temporarily paused. Saved emails remain available.</p>}
        {error && <div role="alert" className="space-y-2 text-sm text-red-600"><p>{error}</p><button type="button" className={control} disabled={paused || busy} onClick={() => { readAttempt.current = ''; setLoading(true); setRefresh(value => value + 1); }}>Retry</button></div>}
      </header>
      {messages.map((message, index) => <EmailDetailView key={message.id} email={message} expanded={expanded[message.id] ?? index === messages.length - 1} onToggle={() => setExpanded(previous => ({ ...previous, [message.id]: !(previous[message.id] ?? index === messages.length - 1) }))} onReply={() => setDraft(replyDraft(message))} onForward={() => setDraft(forwardDraft(message))} disabled={loading || busy || paused} />)}
      {latest && <div className="flex flex-wrap gap-2 px-3 py-5 sm:px-6 sm:pl-[76px]">
        <button type="button" className={control} disabled={loading || busy || paused} onClick={() => setDraft(replyDraft(latest))}><Reply size={16} />Reply</button>
        <button type="button" className={control} disabled={loading || busy || paused} onClick={() => setDraft(forwardDraft(latest))}><Forward size={16} />Forward</button>
      </div>}
    </div>
    <ComposeModal isOpen={!!draft} initialDraft={draft} retryAt={Math.max(retryAt, cooldown)} onClose={() => setDraft(null)} onSent={() => { onEmailsChanged(); setRefresh(value => value + 1); }} />
  </div>;
}
