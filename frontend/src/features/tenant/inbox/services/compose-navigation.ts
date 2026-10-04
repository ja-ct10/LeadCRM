import { CrmEmailSchema } from '@leadcrm/shared';

export function recordEmailComposeHref(email: string): string | null {
  if (!CrmEmailSchema.safeParse(email).success) return null;
  return `/inbox?${new URLSearchParams({ compose: 'record-email', to: email })}`;
}

/** Consume only an explicit CRM record action, preserving unrelated Inbox query state. */
export function consumeRecordEmailCompose(url: URL): { to: string | null; url: URL } | null {
  if (!['record-email', 'lead-email'].includes(url.searchParams.get('compose') ?? '')) return null;
  const email = url.searchParams.get('to') ?? '';
  url.searchParams.delete('compose');
  url.searchParams.delete('to');
  return { to: CrmEmailSchema.safeParse(email).success ? email : null, url };
}
