import { CrmEmailSchema, MailboxRecordContextSchema, type MailboxRecordContext } from '@leadcrm/shared';

export function recordEmailComposeHref(email: string, subject?: string, sourceDealId?: string, recordContext?: MailboxRecordContext): string | null {
  if (!CrmEmailSchema.safeParse(email).success) return null;
  return `/inbox?${new URLSearchParams({ compose: 'record-email', to: email, ...(sourceDealId ? { sourceDealId } : {}), ...(recordContext ?? {}), ...(subject ? { subject: subject.replace(/[\r\n]/g, ' ').slice(0, 998) } : {}) })}`;
}

/** Consume only an explicit CRM record action, preserving unrelated Inbox query state. */
export function consumeRecordEmailCompose(url: URL): { to: string | null; subject: string; sourceDealId?: string; recordContext?: MailboxRecordContext; url: URL } | null {
  if (!['record-email', 'lead-email'].includes(url.searchParams.get('compose') ?? '')) return null;
  const email = url.searchParams.get('to') ?? '';
  const subject = (url.searchParams.get('subject') ?? '').replace(/[\r\n]/g, ' ').slice(0, 998);
  const sourceDealId = url.searchParams.get('sourceDealId') || undefined;
  const context = MailboxRecordContextSchema.safeParse({ recordModule: url.searchParams.get('recordModule'), recordId: url.searchParams.get('recordId') });
  url.searchParams.delete('recordModule'); url.searchParams.delete('recordId');
  url.searchParams.delete('sourceDealId');
  url.searchParams.delete('compose');
  url.searchParams.delete('to');
  url.searchParams.delete('subject');
  return { to: CrmEmailSchema.safeParse(email).success ? email : null, subject, sourceDealId, recordContext: context.success ? context.data : undefined, url };
}
