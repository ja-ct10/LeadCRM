// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, HEAD } from '../../../app/s/[token]/route';

const token = 'a'.repeat(24);
const context = { params: Promise.resolve({ token }) };
const backend = vi.fn();
beforeEach(() => { vi.stubEnv('API_URL', 'https://api.example.test/api/v1'); vi.stubGlobal('fetch', backend); backend.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('public SMS short-link route', () => {
  it('relays a no-store redirect without forwarding auth, cookies, or user query parameters', async () => {
    backend.mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'https://destination.test/path?a=1&b=2#section' } }));
    const response = await GET(new NextRequest(`https://crm.example.test/s/${token}?next=https://bad.test`, { headers: { Cookie: 'leadcrm_token=private', Authorization: 'Bearer private', 'User-Agent': 'Browser', Purpose: 'prefetch', 'x-forwarded-for': '203.0.113.10' } }), context);
    expect(response.status).toBe(302); expect(response.headers.get('location')).toBe('https://destination.test/path?a=1&b=2#section');
    expect(response.headers.get('cache-control')).toContain('no-store'); expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const [url, options] = backend.mock.calls[0];
    expect(url).toBe(`https://api.example.test/api/v1/public/sms-links/${token}`);
    expect(options).toMatchObject({ method: 'GET', redirect: 'manual', cache: 'no-store', headers: { purpose: 'prefetch', 'user-agent': 'Browser', 'X-Forwarded-For': '203.0.113.10' } });
    expect(JSON.stringify(options)).not.toMatch(/private|leadcrm_token|authorization|cookie/i);
  });
  it('preserves HEAD so previews cannot become a recorded GET', async () => {
    backend.mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'https://destination.test/' } }));
    expect((await HEAD(new NextRequest(`https://crm.example.test/s/${token}`, { method: 'HEAD' }), context)).status).toBe(302);
    expect(backend.mock.calls[0][1].method).toBe('HEAD');
  });
  it('rejects malformed tokens before calling the backend', async () => {
    expect((await GET(new NextRequest('https://crm.example.test/s/bad'), { params: Promise.resolve({ token: 'bad' }) })).status).toBe(404);
    expect(backend).not.toHaveBeenCalled();
  });
  it.each(['javascript:alert(1)', 'https://user:password@destination.test/', '//destination.test/'])('rejects an unsafe upstream redirect %s', destination => {
    backend.mockResolvedValue(new Response(null, { status: 302, headers: { Location: destination } }));
    return GET(new NextRequest(`https://crm.example.test/s/${token}`), context).then(response => expect(response.status).toBe(503));
  });
  it('returns an explicit retryable failure when the backend is unavailable', async () => {
    backend.mockRejectedValue(new Error('offline'));
    const response = await GET(new NextRequest(`https://crm.example.test/s/${token}`), context);
    expect(response.status).toBe(503); expect(await response.text()).toContain('Please try again');
  });
});
