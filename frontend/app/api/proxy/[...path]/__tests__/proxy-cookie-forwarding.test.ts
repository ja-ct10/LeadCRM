// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, PATCH, GET } from '../route';
import { rewriteSetCookie } from '@/lib/auth/cookies';

afterEach(() => vi.unstubAllGlobals());
it('forwards the short-lived MFA cookie in both directions without exposing it in JSON', async () => {
  const token = 'ab'.repeat(32);
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}', { headers: { 'Content-Type': 'application/json', 'Set-Cookie': `leadcrm_mfa_challenge=${token}; HttpOnly; Max-Age=300; SameSite=Lax` } }));
  vi.stubGlobal('fetch', fetchMock);
  const req = new NextRequest('https://app.example.com/api/proxy/auth/mfa/verify', { method: 'POST', headers: { Cookie: `leadcrm_mfa_challenge=${token}` }, body: '{"code":"123456"}' });
  const result = await POST(req, { params: Promise.resolve({ path: ['auth', 'mfa', 'verify'] }) });
  expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe(`leadcrm_mfa_challenge=${token}`);
  expect(result.headers.get('set-cookie')).toContain('Max-Age=300');
  expect(result.headers.get('set-cookie')).toContain('HttpOnly');
  expect(await result.text()).not.toContain(token);
});
it('rejects cross-origin security mutations before forwarding', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  const req = new NextRequest('https://app.example.com/api/proxy/auth/change-password', { method: 'POST', headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' }, body: '{}' });
  expect((await POST(req, { params: Promise.resolve({ path: ['auth', 'change-password'] }) })).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('preserves a deletion cookie instead of giving it another seven days', () => {
  const cookie = rewriteSetCookie('leadcrm_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly');
  expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  expect(cookie).not.toContain('Max-Age=604800');
});
it('strips Domain while preserving an explicit expiry/Max-Age', () => {
  const cookie = rewriteSetCookie('leadcrm_token=token; Domain=api.example.com; Max-Age=0; Secure');
  expect(cookie).not.toContain('Domain=');
  expect(cookie).toContain('Max-Age=0');
  expect(cookie).toContain('Path=/');
});
it('the actual logout proxy forwards credentials and the expired Set-Cookie', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}', {
    headers: { 'Content-Type': 'application/json',
      'Set-Cookie': 'leadcrm_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly' },
  }));
  vi.stubGlobal('fetch', fetchMock);
  const req = new NextRequest('https://app.example.com/api/proxy/auth/logout', {
    method: 'POST', headers: { Cookie: 'leadcrm_token=current-token' }, body: '{}',
  });
  const response = await POST(req, { params: Promise.resolve({ path: ['auth', 'logout'] }) });
  expect(response.headers.get('set-cookie')).toContain('1970');
  expect(response.headers.get('set-cookie')).not.toContain('604800');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    cache: 'no-store', redirect: 'manual', headers: { Cookie: 'leadcrm_token=current-token' },
  });
});

it('forwards the environment PATCH to the existing v1 route and preserves errors', async () => {
  const mock = vi.fn().mockResolvedValue(new Response('{"success":false,"error":"Authentication required"}', { status: 401, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', mock);
  const req = new NextRequest('https://app.example.com/api/proxy/auth/environment', {
    method: 'PATCH', headers: { Cookie: 'leadcrm_token=current-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ environment: 'PRODUCTION' }),
  });
  const res = await PATCH(req, { params: Promise.resolve({ path: ['auth', 'environment'] }) });
  expect(mock.mock.calls[0][0]).toMatch(/\/api\/v1\/auth\/environment$/);
  expect(mock.mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: '{"environment":"PRODUCTION"}', headers: { Cookie: 'leadcrm_token=current-token' } });
  expect(res.status).toBe(401);
});
it('preserves uploaded and downloaded image bytes through the proxy', async () => {
  const bytes = new Uint8Array([0, 255, 128, 42]);
  const mock = vi.fn().mockImplementation(() => Promise.resolve(new Response(bytes, { headers: { 'Content-Type': 'image/webp' } })));
  vi.stubGlobal('fetch', mock);
  const req = new NextRequest('https://app.example.com/api/proxy/auth/profile/avatar', { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: bytes });
  const res = await POST(req, { params: Promise.resolve({ path: ['auth', 'profile', 'avatar'] }) });
  expect(new Uint8Array(mock.mock.calls[0][1].body)).toEqual(bytes);
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  expect(res.headers.get('cache-control')).toBe('no-store');
});
