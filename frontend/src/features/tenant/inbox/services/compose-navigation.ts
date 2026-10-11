import { CrmEmailSchema } from '@leadcrm/shared';

export function recordEmailComposeHref(email: string, subject?: string, sourceDealId?: string): string | null {
  if (!CrmEmailSchema.safeParse(email).success) return null;
  return `/inbox?${new URLSearchParams({ compose: 'record-email', to: email, ...(sourceDealId ? { sourceDealId } : {}), ...(subject ? { subject: subject.replace(/[\r\n]/g, ' ').slice(0, 998) } : {}) })}`;
}

/** Consume only an explicit CRM record action, preserving unrelated Inbox query state. */
export function consumeRecordEmailCompose(url: URL): { to: string | null; subject: string; sourceDealId?: string; url: URL } | null {
  if (!['record-email', 'lead-email'].includes(url.searchParams.get('compose') ?? '')) return null;
  const email = url.searchParams.get('to') ?? '';
  const subject = (url.searchParams.get('subject') ?? '').replace(/[\r\n]/g, ' ').slice(0, 998);
  const sourceDealId = url.searchParams.get('sourceDealId') || undefined;
  url.searchParams.delete('sourceDealId');
  url.searchParams.delete('compose');
  url.searchParams.delete('to');
  url.searchParams.delete('subject');
  return { to: CrmEmailSchema.safeParse(email).success ? email : null, subject, sourceDealId, url };
}
