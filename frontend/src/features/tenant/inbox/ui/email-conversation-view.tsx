'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, Briefcase, Inbox, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { fetchGmailThread, fetchGmailCorrespondent, associateThreadDeal, archiveGmailThread, trashGmailThread, archiveGmailConversations, trashGmailConversations, restoreGmailConversations, type GmailEmail } from '../services/gmail.service';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import { toast } from 'sonner';
import type { MailboxConversationDetail } from '@leadcrm/shared';
import { conversationNames, emailAddress, forwardDraft, replyDraft, type MailboxComposeDraft } from '../services/email-presentation';
import type { ApiRequestError } from '@/lib/api/client';
import EmailDetailView, { mailboxIconButton } from './email-detail-view';
import ComposeModal from './compose-modal';

const control = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50';
function TopicDealSelector({ topic, disabled, onAssociate }: { topic: MailboxConversationDetail['threads'][number]; disabled: boolean; onAssociate: (threadId: string, dealId: string) => void }) {
  const [dealId, setDealId] = useState('');
  if (!topic.canAssociateDeal || !topic.dealOptions.length) return null;
  return <form className="mt-2 flex min-w-0 flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); if (dealId) onAssociate(topic.threadId, dealId); }}>
    <select aria-label="Associate conversation with Deal" required disabled={disabled} value={dealId} onChange={event => setDealId(event.target.value)} className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-xs sm:w-80"><option value="">Select the relevant open Deal</option>{topic.dealOptions.map(deal => <option key={deal.id} value={deal.id}>{deal.title} · {deal.stage}</option>)}</select>
    <button type="submit" disabled={!dealId || disabled} className={control}>Associate Deal</button>
  </form>;
}
export default function EmailConversationView({ email, originView = 'inbox', mailboxEmail, revision = 0, retryAt = 0, readError, readPending = false, onRetryRead, onBack, onEmailsChanged }: {
  email: GmailEmail; mailboxEmail?: string; revision?: number; retryAt?: number; onBack: (error?: string) => void; onEmailsChanged: () => void;
  readError?: string; readPending?: boolean; onRetryRead?: () => void;
  originView?: 'inbox' | 'archived';
}) {
  const [messages, setMessages] = useState<GmailEmail[]>([email]);
  const [topics, setTopics] = useState<MailboxConversationDetail['threads']>([]);
  const [nextPageToken, setNextPageToken] = useState<string>(), [messageCount, setMessageCount] = useState(email.messageCount ?? 1);
  const historyPending = useRef(false);
  const historyGeneration = useRef(0);
  const historyController = useRef<AbortController | undefined>(undefined);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<{ id: string; title: string; stage: string }[]>([]);
  const [canAssociate, setCanAssociate] = useState(false);
  const [busy, setBusy] = useState(false), [draft, setDraft] = useState<MailboxComposeDraft | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refresh, setRefresh] = useState(0), [cooldown, setCooldown] = useState(0);
  const pending = useRef(false);
  const callbacks = useRef({ onBack, onEmailsChanged }); callbacks.current = { onBack, onEmailsChanged };
  const paused = Math.max(retryAt, cooldown) > Date.now();
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(0), Math.max(0, cooldown - Date.now())); return () => clearTimeout(timer); }, [cooldown]);
  const failure = useCallback((error: unknown) => {
    const request = error as ApiRequestError;
    setError(error instanceof Error ? error.message : 'This email action could not be completed. Try again.');
    setCooldown(Date.parse(request.retryAt ?? '') || 0);
    if ([401, 403, 404, 409].includes(request.status ?? 0)) { historyController.current?.abort(); historyGeneration.current++; setMessages([]); setTopics([]); setNextPageToken(undefined); setDraft(null); callbacks.current.onBack('This conversation is no longer available. Refresh your Inbox or check your mailbox access.'); }
  }, []);
  useEffect(() => {
    let active = true;
    historyController.current?.abort(); const controller = new AbortController(); historyController.current = controller;
    const generation = ++historyGeneration.current;
    const request = email.conversationId ? fetchGmailCorrespondent(email.conversationId, undefined, controller.signal) : fetchGmailThread(email.threadId, controller.signal);
    request.then(result => {
      if (!active || generation !== historyGeneration.current) return;
      const ordered: GmailEmail[] = [...result.emails].sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id));
      setMessages(ordered); setError(''); setNextPageToken(result.nextPageToken);
      if ('threads' in result) { setTopics(result.threads); setMessageCount(result.messageCount); }
      else { setDeals(result.dealOptions); setCanAssociate(result.canAssociateDeal); setMessageCount(ordered.length); }
      const latestId = ordered.reduce<GmailEmail | undefined>((latest, message) => !latest || Date.parse(message.date) >= Date.parse(latest.date) ? message : latest, undefined)?.id;
      setExpanded(previous => ({ ...previous, ...Object.fromEntries(ordered.map(message => [message.id, previous[message.id] ?? message.id === latestId])) }));
    }).catch(error => { if (active) failure(error); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; historyController.current?.abort(); if (historyGeneration.current === generation) historyGeneration.current++; };
  }, [email.conversationId, email.threadId, revision, refresh, failure]);
  const loadMore = async () => {
    if (!email.conversationId || !nextPageToken || historyPending.current || loading) return;
    historyPending.current = true; setLoading(true);
    const generation = historyGeneration.current;
    try {
      const controller = new AbortController(); historyController.current = controller;
      const result = await fetchGmailCorrespondent(email.conversationId, nextPageToken, controller.signal);
      if (generation !== historyGeneration.current) return;
      setMessages(previous => [...new Map([...previous, ...result.emails].map(message => [message.id, message])).values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id)));
      setTopics(previous => [...new Map([...previous, ...result.threads].map(topic => [topic.threadId, topic])).values()]);
      setNextPageToken(result.nextPageToken); setMessageCount(result.messageCount);
      const latestId = [...messages, ...result.emails].reduce<GmailEmail | undefined>((latest, message) => !latest || Date.parse(message.date) >= Date.parse(latest.date) ? message : latest, undefined)?.id;
      setExpanded(previous => ({ ...previous, ...Object.fromEntries(result.emails.map(message => [message.id, previous[message.id] ?? message.id === latestId])) }));
    } catch (error) {
      if (generation !== historyGeneration.current) return;
      if ((error as ApiRequestError).code === 'MAILBOX_PAGE_CHANGED') { setMessages([]); setTopics([]); setRefresh(value => value + 1); }
      else failure(error);
    } finally { historyPending.current = false; if (generation === historyGeneration.current) setLoading(false); }
  };
  const mutate = async (action: () => Promise<unknown>, goBack = false) => {
    if (pending.current || paused) return false;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await action() as { success?: boolean; error?: string } | undefined;
      callbacks.current.onEmailsChanged();
      if (result?.success === false) { setRefresh(value => value + 1); throw new Error(result.error || 'Some messages could not be updated. Retry the remaining messages.'); }
      if (goBack) callbacks.current.onBack(); else setRefresh(value => value + 1);
      return true;
    }
    catch (error) { callbacks.current.onEmailsChanged(); failure(error); return false; }
    finally { pending.current = false; setBusy(false); }
  };
  const latest = messages.reduce<GmailEmail | undefined>((latest, message) => !latest || Date.parse(message.date) >= Date.parse(latest.date) ? message : latest, undefined);
  const archive = () => originView === 'archived' && email.conversationId
    ? restoreGmailConversations([email.conversationId])
    : email.conversationId ? archiveGmailConversations([email.conversationId]) : archiveGmailThread(email.threadId);
  const remove = () => email.conversationId ? trashGmailConversations([email.conversationId]) : trashGmailThread(email.threadId);
  const participantNames = conversationNames({ ...email, participants: email.participants?.filter(name => name !== 'You') }, mailboxEmail);
  const participantAddresses = email.correspondentAddresses ?? (email.direction === 'outbound' ? [...email.to, ...(email.cc ?? [])] : [email.from]).map(emailAddress).filter(address => address.toLowerCase() !== mailboxEmail?.toLowerCase());
  const isExpanded = (message: GmailEmail) => expanded[message.id] ?? message.id === latest?.id;
  const associationMessages = new Map<string, string>();
  for (const message of messages) {
    if (isExpanded(message) && !message.dealId && !associationMessages.has(message.threadId)) associationMessages.set(message.threadId, message.id);
  }
  return <div className="flex h-full min-h-0 min-w-0 flex-col">
    <div role="toolbar" aria-label="Conversation actions" className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2 sm:px-4">
      <button type="button" title={originView === 'archived' ? 'Back to Archived Messages' : 'Back to inbox'} aria-label={originView === 'archived' ? 'Back to Archived Messages' : 'Back to inbox'} className={mailboxIconButton} onClick={() => onBack()}><ArrowLeft size={18} /></button>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">Email Thread</span>
      {busy && <Loader2 aria-label="Updating conversation" className="h-4 w-4 animate-spin text-muted-foreground" />}
      <button type="button" title={originView === 'archived' ? 'Restore to Inbox' : 'Archive conversation'} aria-label={originView === 'archived' ? 'Restore conversation' : 'Archive conversation'} disabled={loading || busy || paused || !latest || originView === 'inbox' && email.canArchive === false} className={mailboxIconButton} onClick={() => void mutate(archive, true).then(success => { if (success) toast.success(originView === 'archived' ? 'Messages restored to Inbox' : 'Messages archived'); })}>{originView === 'archived' ? <Inbox size={18} /> : <Archive size={18} />}</button>
      <button type="button" title="Delete Permanently — move messages to Gmail Trash" aria-label="Delete Permanently" disabled={loading || busy || paused || !latest} className={mailboxIconButton} onClick={() => setConfirmOpen(true)}><Trash2 size={18} /></button>
    </div>
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <header className="space-y-1 border-b border-border px-3 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-base font-semibold [overflow-wrap:anywhere]">{participantNames}</h1>
          <Badge variant="secondary" className="max-w-full gap-1">{(latest?.dealId || email.dealId) && <Briefcase size={12} className="shrink-0" />}<span className="truncate">{latest?.dealTitle || email.dealTitle || 'No Deal'}</span></Badge>
          <Badge variant="secondary" className="shrink-0" aria-label={`${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`}>{messageCount} {messageCount === 1 ? 'message' : 'messages'}</Badge>
        </div>
        {!!participantAddresses.length && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{participantAddresses.join(', ')}</p>}
        {loading && <p role="status" className="text-xs text-muted-foreground">Loading conversation…</p>}
        {paused && <p role="status" className="text-xs text-muted-foreground">Gmail updates are temporarily paused. Saved emails remain available.</p>}
        {readError && <div role="alert" className="space-y-2 text-sm text-red-600"><p>{readError}</p><button type="button" className={control} disabled={paused || readPending} onClick={onRetryRead}>Retry marking as read</button></div>}
        {error && <div role="alert" className="space-y-2 text-sm text-red-600"><p>{error}</p><button type="button" className={control} disabled={paused || busy} onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>Retry</button></div>}
      </header>
      {messages.map((message, index) => <EmailDetailView key={message.id} onUnavailable={failure} email={message} expanded={isExpanded(message)} onToggle={() => setExpanded(previous => ({ ...previous, [message.id]: !(previous[message.id] ?? message.id === latest?.id) }))} onReply={() => setDraft(replyDraft(message))} onForward={() => setDraft(forwardDraft(message))} disabled={loading || busy || paused}
        topicActions={email.conversationId && (index === 0 || message.threadId !== messages[index - 1].threadId) ? <DropdownMenu>
          <DropdownMenuTrigger className={mailboxIconButton} aria-label={`Actions for topic: ${message.subject || '(no subject)'}`} disabled={loading || busy || paused}><MoreHorizontal size={16} /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={loading || busy || paused} aria-label={`Archive topic: ${message.subject}`} onSelect={() => void mutate(archive, true)}><Archive size={16} />{originView === 'archived' ? 'Restore to Inbox' : 'Archive this conversation'}</DropdownMenuItem>
            <DropdownMenuItem destructive disabled={loading || busy || paused} aria-label={`Trash topic: ${message.subject}`} onSelect={() => setConfirmOpen(true)}><Trash2 size={16} />Delete Permanently</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> : undefined}
        associationControls={associationMessages.get(message.threadId) === message.id ? <>
          {message.needsDealAssociation && <p className="text-muted-foreground">Select the relevant open Deal for this conversation. Association does not change its stage.</p>}
          {(email.conversationId ? topics.filter(topic => topic.threadId === message.threadId) : [{ threadId: email.threadId, dealOptions: deals, canAssociateDeal: canAssociate }]).map(topic => <TopicDealSelector key={topic.threadId} topic={topic} disabled={loading || busy || paused} onAssociate={(threadId, dealId) => void mutate(() => associateThreadDeal(threadId, dealId, email.conversationId ? { conversationId: email.conversationId } : { messageId: message.id }))} />)}
          {!email.conversationId && (message.leadId || message.contactId) && !deals.length && !loading && <p className="text-muted-foreground">No open Deal available.</p>}
        </> : undefined}
      />)}
      {nextPageToken && <div className="px-3 py-3 sm:px-6"><button type="button" className={control} disabled={loading || busy || paused} onClick={() => void loadMore()}>Load more messages</button></div>}
    </div>
    <ConfirmActionDialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Delete Permanently"
      description="Remove the selected email conversation(s) from LeadCRM Inbox? The messages will be moved to Gmail Trash and can be recovered there."
      confirmLabel="Delete" cancelLabel="Cancel" variant="destructive" isLoading={busy} onConfirm={async () => {
        if (!await mutate(remove, true)) throw new Error('Some messages could not be moved to Gmail Trash. Refresh and retry.');
        toast.success('Messages moved to Gmail Trash');
      }} />
    <ComposeModal isOpen={!!draft} initialDraft={draft} retryAt={Math.max(retryAt, cooldown)} onClose={() => setDraft(null)} onSent={() => { onEmailsChanged(); setRefresh(value => value + 1); }} />
  </div>;
}
