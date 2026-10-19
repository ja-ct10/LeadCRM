import { manilaLocalDateTime } from '@/lib/manila-time';
import type { GmailEmail } from './gmail.service';
import { safeMailboxHtml } from './email-html';
import type { MailboxComposeMode } from '@leadcrm/shared';

export const emailAddress = (value: string) => (value.match(/<([^<>]+)>/)?.[1] ?? value).trim();

/** Summary participants are external-only. Legacy/draft rows use exact addresses. */
export function conversationNames(email: GmailEmail, mailbox?: string): string {
  if (email.conversationId && email.participants?.length) return email.participants.join(', ');
  const owner = mailbox ? emailAddress(mailbox).toLowerCase() : undefined;
  const names = new Map<string, string>();
  const people = email.direction === 'outbound' ? [...email.to, ...(email.cc ?? [])] : [email.from, ...email.to, ...(email.cc ?? [])];
  for (const value of people) {
    const address = emailAddress(value).toLowerCase();
    if (!address || address === owner || !address.includes('@')) continue;
    const name = value.match(/^(.+?)\s*<[^<>]+>$/)?.[1]?.replace(/^"|"$/g, '').trim();
    if (!names.has(address) || name) names.set(address, name || address.split('@')[0] || address);
  }
  return [...names.values()].join(', ') || '(no external recipient)';
}
export const senderName = (value: string) => (value.match(/^(.+?)\s*<[^<>]+>$/)?.[1] ?? value.split('@')[0]).replace(/^"|"$/g, '').trim();
export function mailboxDate(value: string, full = false, now = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(+date)) return 'Date unavailable';
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Manila' };
  if (full) return date.toLocaleString('en-PH', { ...options, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const day = manilaLocalDateTime(date).slice(0, 10);
  if (day === manilaLocalDateTime(now).slice(0, 10)) return date.toLocaleTimeString('en-PH', { ...options, hour: 'numeric', minute: '2-digit' });
  if (day === manilaLocalDateTime(new Date(+now - 86400000)).slice(0, 10)) return 'Yesterday';
  return date.toLocaleDateString('en-PH', { ...options, month: 'short', day: 'numeric', ...(day.slice(0, 4) !== manilaLocalDateTime(now).slice(0, 4) ? { year: 'numeric' } : {}) });
}
export type MailboxComposeDraft = { to: string; subject: string; body: string; composeMode?: MailboxComposeMode; replyToMessageId?: string; forwardSourceMessageId?: string; draftId?: string; sourceDealId?: string; recordContext?: import('@leadcrm/shared').MailboxRecordContext; dealId?: string; attachmentSourceMessageId?: string; draftContextRequired?: boolean; draftThreadId?: string };
export function replyDraft(email: GmailEmail): MailboxComposeDraft {
  return { composeMode: 'reply', to: email.direction === 'outbound' ? emailAddress(email.to[0] ?? '') : email.replyToAddress || emailAddress(email.from), subject: /^\s*re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`, body: '', replyToMessageId: email.id };
}
export function forwardDraft(email: GmailEmail): MailboxComposeDraft {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return { composeMode: 'forward', to: '', subject: /^\s*fwd:/i.test(email.subject) ? email.subject : `Fwd: ${email.subject}`, forwardSourceMessageId: email.id,
    body: '<p><br></p><p>---------- Forwarded message ----------<br>From: ' + escape(email.from) + '<br>Date: ' + escape(mailboxDate(email.date, true)) + '<br>Subject: ' + escape(email.subject) + '<br>To: ' + escape(email.to.join(', ')) + (email.cc?.length ? '<br>Cc: ' + escape(email.cc.join(', ')) : '') + '</p>' + safeMailboxHtml(email.body) };
}
