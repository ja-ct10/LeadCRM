// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

const paths = ['auth/events', 'crm/record-events', 'crm/pipelines/events', 'reporting/dashboard/events', 'integrations/gmail/events'];
beforeEach(() => { vi.stubEnv('API_URL', 'http://localhost:4000/api/v1'); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(path: string, signal?: AbortSignal) {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn();
  const upstream = new ReadableStream<Uint8Array>({ start(controller) { source = controller; }, cancel });
  const fetcher = vi.fn().mockResolvedValue(new Response(upstream, { headers: { 'Content-Type': 'text/event-stream' } }));
  vi.stubGlobal('fetch', fetcher);
  const req = new NextRequest(`http://localhost:3000/api/proxy/${path}`, { signal });
  const removed = vi.spyOn(req.signal, 'removeEventListener');
  return { source, upstream, cancel, fetcher, removed, request: () => GET(req, { params: Promise.resolve({ path: path.split('/') }) }) };
}
it.each(paths)('forwards %s immediately and cleans up on normal expiry', async path => {
  const f = fixture(path);
  const response = await f.request(), reader = response.body!.getReader();
  f.source.enqueue(new TextEncoder().encode('retry: 3000\n\n'));
  expect(new TextDecoder().decode((await reader.read()).value)).toBe('retry: 3000\n\n');
  expect(response.headers.get('cache-control')).toBe('no-store, no-transform');
  expect(response.headers.get('x-accel-buffering')).toBe('no');
  f.source.close(); expect((await reader.read()).done).toBe(true);
  expect(f.upstream.locked).toBe(false);
  expect(f.removed).toHaveBeenCalledWith('abort', expect.any(Function));
});
it.each(paths)('ends interrupted %s cleanly and permits a fresh connection', async path => {
  const f = fixture(path), response = await f.request(), reader = response.body!.getReader();
  f.source.enqueue(new TextEncoder().encode(': heartbeat\n\n')); await reader.read();
  f.source.error(new Error('synthetic upstream reset'));
  expect((await reader.read()).done).toBe(true);
  expect(f.upstream.locked).toBe(false);
  expect(console.error).toHaveBeenCalledOnce();
  const next = fixture(path), reconnected = await next.request();
  next.source.enqueue(new TextEncoder().encode('event: change\ndata: {}\n\n'));
  expect((await reconnected.body!.getReader().read()).value!.byteLength).toBeGreaterThan(0);
  next.source.close();
});
it.each(paths)('cancels upstream %s when its browser disconnects', async path => {
  const browser = new AbortController(), f = fixture(path, browser.signal);
  const response = await f.request(), reader = response.body!.getReader();
  const pending = reader.read(); browser.abort();
  expect((await pending).done).toBe(true);
  await Promise.resolve();
  expect(f.cancel).toHaveBeenCalledOnce();
  expect(f.fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  expect(console.error).not.toHaveBeenCalled();
});
it('cancels upstream when the downstream body is cancelled', async () => {
  const f = fixture('auth/events'), response = await f.request();
  await response.body!.cancel();
  expect(f.cancel).toHaveBeenCalledOnce();
  expect(f.upstream.locked).toBe(false);
  expect(f.fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});
it('keeps healthy SSE alive past the ordinary response timeout', async () => {
  vi.useFakeTimers();
  const f = fixture('auth/events'), response = await f.request();
  await vi.advanceTimersByTimeAsync(25001);
  expect(f.fetcher.mock.calls[0][1].signal.aborted).toBe(false);
  await response.body!.cancel();
});
it('times out a stalled ordinary response body after headers arrive', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => new Response(new ReadableStream({
    start(source) { init.signal.addEventListener('abort', () => source.error(new DOMException('Aborted', 'AbortError'))); },
  }))));
  const pending = GET(new NextRequest('http://localhost:3000/api/proxy/integrations/gmail/emails'), { params: Promise.resolve({ path: ['integrations', 'gmail', 'emails'] }) });
  await vi.advanceTimersByTimeAsync(25001);
  expect((await pending).status).toBe(503);
});
it('forwards ordinary request cancellation without logging an upstream failure', async () => {
  const browser = new AbortController();
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })));
  const pending = GET(new NextRequest('http://localhost:3000/api/proxy/crm/leads', { signal: browser.signal }), { params: Promise.resolve({ path: ['crm', 'leads'] }) });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce()); browser.abort();
  expect((await pending).status).toBe(499);
  expect(console.error).not.toHaveBeenCalled();
});
