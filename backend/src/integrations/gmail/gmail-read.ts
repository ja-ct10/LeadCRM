import { setTimeout as delay } from 'node:timers/promises';
import { AppError } from '../../shared/errors/app-error';

/** Retry read-only Gmail requests; never expose Google's raw error payload or retry sends. */
export async function readGmailJson<T>(accessToken: string, path: string): Promise<T> {
  const signal = AbortSignal.timeout(15000);
  try {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, signal,
      });
      if (response.ok) return await response.json() as T;
      const payload = await response.json().catch(() => ({})) as {
        error?: { errors?: { reason?: string }[]; details?: { reason?: string }[] };
      };
      const reasons = [...(payload.error?.errors ?? []), ...(payload.error?.details ?? [])].map(error => error.reason);
      const throttled = response.status === 429 || response.status === 403 && reasons.some(reason =>
        ['rateLimitExceeded', 'userRateLimitExceeded', 'RATE_LIMIT_EXCEEDED'].includes(reason ?? ''));
      const temporary = throttled || [500, 502, 503, 504].includes(response.status);
      if (temporary && attempt < 2) {
        const retryAfter = Number(response.headers.get('retry-after')) * 1000;
        // Long provider cooldowns are returned to the caller instead of outliving the API proxy.
        if (!Number.isFinite(retryAfter) || retryAfter <= 5000) {
          await delay(Math.max(Number.isFinite(retryAfter) ? retryAfter : 0, 1000 * 2 ** attempt + Math.random() * 250), undefined, { signal });
          continue;
        }
      }
      if (throttled) throw new AppError('Gmail is temporarily limiting mailbox requests. Wait a moment, then try again.', 429, 'GMAIL_RATE_LIMITED');
      if (response.status === 400) throw new AppError('Gmail could not apply this search or page. Clear the search filters and reload the inbox.', 400, 'GMAIL_INVALID_REQUEST');
      if (response.status === 401) throw new AppError('Gmail access expired or was revoked. Reconnect your email in Messages.', 401, 'GMAIL_RECONNECT_REQUIRED');
      if (response.status === 403) {
        if (reasons.some(reason => ['accessNotConfigured', 'SERVICE_DISABLED'].includes(reason ?? ''))) {
          throw new AppError('Gmail API is unavailable for this OAuth project. Ask your administrator to check its API configuration.', 503, 'GMAIL_API_UNAVAILABLE');
        }
        if (reasons.includes('domainPolicy')) throw new AppError('Your Google Workspace policy blocks this Gmail request. Contact your Workspace administrator.', 403, 'GMAIL_ADMIN_RESTRICTED');
        throw new AppError('Google denied this Gmail request. Check the granted Gmail permissions and reconnect if needed.', 403, 'GMAIL_PERMISSION_DENIED');
      }
      if (response.status === 404) throw new AppError('This Gmail message or history page is no longer available.', 404, 'GMAIL_NOT_FOUND');
      throw new AppError('Gmail is temporarily unavailable. Try again shortly.', 502, 'GMAIL_UNAVAILABLE');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Gmail did not respond in time. Try again shortly.', 503, 'GMAIL_READ_FAILED');
  }
}
