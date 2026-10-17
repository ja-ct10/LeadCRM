import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { PASSWORD_CHANGE_REQUIRED_EVENT } from '@/shared/auth/auth-events';
import { clearPageCache, getPageCacheSize, setPageCache } from '@/shared/cache/page-cache';

afterEach(() => vi.unstubAllGlobals());
it('signals password-change-required without retrying the protected request', async () => {
  const changed = vi.fn();
  window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, changed);
  try {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Change your password first.' } }), { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiClient.get('/crm/leads')).rejects.toMatchObject({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED' });
    expect(changed).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  } finally { window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, changed); }
});
it('does not signal password recovery for ordinary permission denials', async () => {
  const changed = vi.fn();
  window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, changed);
  try {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":{"code":"FORBIDDEN","message":"Access denied"}}', { status: 403 })));
    await expect(apiClient.get('/crm/leads')).rejects.toMatchObject({ status: 403 });
    expect(changed).not.toHaveBeenCalled();
  } finally { window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, changed); }
});

it('preserves authoritative lockout expiry and server time without retrying credentials', async () => {
  const error = { code: 'AUTH_LOGIN_LOCKED', message: 'Cooldown', retryAt: '2030-01-01T00:05:00.000Z', serverNow: '2030-01-01T00:00:00.000Z' };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error }), { status: 429 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(apiClient.post('/auth/login', {})).rejects.toMatchObject(error);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it('records activity without discarding cached CRM data', async () => {
  clearPageCache();
  setPageCache('leads', 'tenant', {}, { data: [{ id: 'lead' }] });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"success":true}')));
  await apiClient.post('/auth/activity', { lastActiveAt: new Date().toISOString() });
  expect(getPageCacheSize()).toBe(1);
  clearPageCache();
});

it.each(['/crm/leads', '/crm/contacts', '/crm/accounts', '/crm/deals', '/administration/users', '/administration/users/user/permissions', '/automation/workflows'])('uses the credentialed same-origin path for %s', async path => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"data":[]}'));
  vi.stubGlobal('fetch', fetchMock);
  await apiClient.get(path);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith(`/api/proxy${path}`, expect.objectContaining({ credentials: 'include' }));
});

it('never sends an unsigned server-side request', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', undefined);
  await expect(apiClient.get('/crm/leads')).rejects.toThrow('cannot be used during server rendering');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('preserves genuine 401 errors without retrying or concealing them', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":"Authentication required"}', { status: 401 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(apiClient.get('/crm/leads')).rejects.toMatchObject({ status: 401, message: 'Authentication required' });
  expect(fetchMock).toHaveBeenCalledOnce();
});

it('exposes Retry-After as an absolute cooldown after a 429 response', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":"Too many requests"}', {
    status: 429, headers: { 'Retry-After': '60', 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetchMock);
  const before = Date.now();
  let caught: unknown;
  try { await apiClient.get('/integrations/gmail/emails'); } catch (error) { caught = error; }
  expect(caught).toMatchObject({ status: 429 });
  const retryAt = Date.parse((caught as { retryAt: string }).retryAt);
  expect(retryAt).toBeGreaterThanOrEqual(before + 59_000);
  expect(retryAt).toBeLessThanOrEqual(Date.now() + 61_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
