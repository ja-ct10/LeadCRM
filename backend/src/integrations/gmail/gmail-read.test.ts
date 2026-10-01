import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readGmailJson } from './gmail-read';
import { fetchEmails } from './gmail.service';

const mocks = vi.hoisted(() => ({ delay: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:timers/promises', () => ({ setTimeout: mocks.delay }));
vi.mock('../../config/database.config', () => ({ default: { emailAccount: { findUnique: vi.fn(async () => ({
  isActive: true, email: 'staff@camxian.com', accessToken: 'encrypted', tokenExpiresAt: new Date(Date.now() + 3600000),
})) } } }));
vi.mock('../../core/auth/auth-user', () => ({ readAuthUser: vi.fn(async () => ({ email: 'staff@camxian.com' })) }));
vi.mock('../../core/encryption/crypto.service', () => ({ decryptToken: () => 'private-token', encryptToken: () => 'encrypted' }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());
const failure = (status: number, reason: string, headers?: HeadersInit) => Response.json({ error: { message: 'private provider payload', errors: [{ reason }] } }, { status, headers });

describe('Gmail read error handling', () => {
  it.each([403, 429, 500, 503])('retries a transient %i before returning data', async status => {
    const fetchMock = vi.fn().mockResolvedValueOnce(failure(status, 'userRateLimitExceeded')).mockResolvedValueOnce(Response.json({ messages: [] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await readGmailJson('token', 'messages')).toEqual({ messages: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.delay).toHaveBeenCalledTimes(1);
  });
  it('stops after three reads and returns a safe rate-limit error', async () => {
    const fetchMock = vi.fn(async () => failure(403, 'rateLimitExceeded'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(readGmailJson('token', 'messages')).rejects.toMatchObject({ statusCode: 429, code: 'GMAIL_RATE_LIMITED' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it.each([
    [400, 'badRequest', 'GMAIL_INVALID_REQUEST', 400],
    [401, 'authError', 'GMAIL_RECONNECT_REQUIRED', 401],
    [403, 'insufficientPermissions', 'GMAIL_PERMISSION_DENIED', 403],
    [403, 'domainPolicy', 'GMAIL_ADMIN_RESTRICTED', 403],
    [403, 'accessNotConfigured', 'GMAIL_API_UNAVAILABLE', 503],
    [404, 'notFound', 'GMAIL_NOT_FOUND', 404],
  ])('does not retry permanent %i %s failures', async (status, reason, code, expectedStatus) => {
    const fetchMock = vi.fn(async () => failure(status as number, reason as string));
    vi.stubGlobal('fetch', fetchMock);
    const error = await readGmailJson('token', 'messages').catch(error => error);
    expect(error).toMatchObject({ statusCode: expectedStatus, code });
    expect(error.message).not.toContain('private provider payload');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('returns a long provider cooldown without retrying early', async () => {
    const fetchMock = vi.fn(async () => failure(429, 'rateLimitExceeded', { 'Retry-After': '120' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(readGmailJson('token', 'profile')).rejects.toMatchObject({ statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(mocks.delay).not.toHaveBeenCalled();
  });
  it('sanitizes network errors, including any sensitive transport details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret transport information')));
    const error = await readGmailJson('token', 'profile').catch(error => error);
    expect(error).toMatchObject({ statusCode: 503, code: 'GMAIL_READ_FAILED' });
    expect(error.message).not.toContain('secret');
  });
  it('caps simultaneous message reads at five and tolerates a message removed since listing', async () => {
    let inFlight = 0, peak = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('messages?')) return Response.json({ messages: Array.from({ length: 12 }, (_, i) => ({ id: String(i) })), nextPageToken: 'next-page' });
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 1));
      inFlight--;
      if (url.includes('/messages/3?')) return failure(404, 'notFound');
      return Response.json({ id: new URL(url).pathname.split('/').pop(), threadId: 'thread', labelIds: ['INBOX'], snippet: '', internalDate: '1790812800000', payload: { headers: [], mimeType: 'text/plain', body: {} } });
    }));
    const result = await fetchEmails('tenant', 'staff', { maxResults: 12 });
    expect(peak).toBe(5); expect(result.emails).toHaveLength(11); expect(result.nextPageToken).toBe('next-page');
  });
  it('preserves draft IDs when loading draft message details', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('drafts?')
      ? Response.json({ drafts: [{ id: 'draft-1', message: { id: 'message-1' } }] })
      : Response.json({ id: 'message-1', threadId: 'thread', labelIds: ['DRAFT'], internalDate: '1790812800000', payload: { headers: [] } })));
    expect((await fetchEmails('tenant', 'staff', { query: 'in:drafts' })).emails[0].draftId).toBe('draft-1');
  });
  it('uses the message endpoint when All conversations excludes drafts', async () => {
    const fetchMock = vi.fn(async () => Response.json({ messages: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchEmails('tenant', 'staff', { query: '-in:spam -in:trash -in:drafts' });
    expect(fetchMock.mock.calls[0][0]).toContain('/messages?');
  });
});
