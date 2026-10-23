import { EventEmitter } from 'node:events';
import express, { type Request, type Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCrmRetirementMaintenance, crmRetirementMaintenance, maintenanceDeadline } from './crm-retirement-maintenance';
import { validateSession } from '../auth/session.service';
import { SESSION_IDLE_MS } from '@leadcrm/shared';

const sessions = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn() }));
vi.mock('../../config/database.config', () => ({ default: { session: sessions } }));
afterEach(() => { crmRetirementMaintenance.resume(); vi.clearAllMocks(); });
async function withServer(app: ReturnType<typeof express>, work: (send: (path: string, method?: string) => Promise<globalThis.Response>) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(done => server.once('listening', done));
  const address = server.address() as { port: number };
  try { await work((path, method = 'GET') => fetch(`http://127.0.0.1:${address.port}${path}`, { method })); }
  finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); }
}

describe('bounded CRM retirement maintenance', () => {
  it('keeps default behavior and permits only passive reads during maintenance', async () => {
    const control = createCrmRetirementMaintenance();
    const app = express();
    app.use(control.middleware);
    app.use((req, res) => res.json({ passive: req.headers['x-leadcrm-passive'] === '1' }));
    await withServer(app, async send => {
      expect((await send('/api/v1/crm/accounts/a','PATCH')).status).toBe(200);
      control.begin(Date.now() + 10000);
      for (const path of ['/api/v1/health','/api/v1/auth/me','/api/v1/crm/contacts','/api/v1/crm/accounts/a','/api/v1/crm/deals/d/activity']) {
        const response = await send(path);
        expect(response.status).toBe(200);
        expect((await response.json()).passive).toBe(true);
      }
      for (const path of ['/api/v1/public/sms-links/x','/api/v1/integrations/gmail/sync','/api/v1/crm/accounts/a/unknown']) expect((await send(path)).status).toBe(503);
      const response = await send('/api/v1/crm/accounts/a','PATCH');
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('30');
      control.resume();
      expect((await send('/api/v1/crm/accounts/a','PATCH')).status).toBe(200);
    });
  });
  it('does not attest drain while an earlier request is in flight', async () => {
    const control = createCrmRetirementMaintenance();
    const response = new EventEmitter() as Response;
    response.getHeader = () => undefined;
    control.middleware({ method:'PATCH', path:'/api/v1/crm/accounts/a' } as Request, response, vi.fn());
    control.begin(Date.now() + 10000);
    const draining = control.drain();
    expect(control.status()).toMatchObject({ drained:false, requests:1 });
    response.emit('finish');
    await draining;
    response.emit('close');
    expect(control.status()).toMatchObject({ drained:true, requests:0 });
  });
  it('enforces the ten-minute deadline and cannot silently extend a window', () => {
    const now = Date.now();
    expect(maintenanceDeadline(new Date(now + 600000).toISOString(), now)).toBe(now + 600000);
    for (const until of [now - 1, now, now + 600001]) expect(() => maintenanceDeadline(new Date(until).toISOString(),now)).toThrow('INVALID_DEADLINE');
    expect(() => maintenanceDeadline('invalid',now)).toThrow('INVALID_DEADLINE');
    const control = createCrmRetirementMaintenance();
    control.begin(now + 1000);
    expect(() => control.begin(now + 2000)).toThrow('ALREADY_ACTIVE');
  });
  it('rejects idle sessions without writing during maintenance', async () => {
    sessions.findUnique.mockResolvedValue({ userId:'u',tenantId:'t',revokedAt:null,lastActiveAt:new Date(Date.now() - SESSION_IDLE_MS - 1000),expiresAt:new Date(Date.now()+60000) });
    crmRetirementMaintenance.begin(Date.now() + 10000);
    await expect(validateSession('test')).rejects.toMatchObject({ code:'SESSION_IDLE_EXPIRED' });
    expect(sessions.updateMany).not.toHaveBeenCalled();
  });
  it('keeps session activity passive and does not accept expired identities', async () => {
    sessions.findUnique.mockResolvedValue({ userId:'u',tenantId:'t',revokedAt:null,lastActiveAt:new Date(Date.now()-120000),expiresAt:new Date(Date.now()+60000) });
    crmRetirementMaintenance.begin(Date.now() + 10000);
    await expect(validateSession('test',new Date(),true)).resolves.toMatchObject({ userId:'u' });
    expect(sessions.updateMany).not.toHaveBeenCalled();
    sessions.findUnique.mockResolvedValue({ expiresAt:new Date(Date.now()-1000),revokedAt:null });
    await expect(validateSession('test')).rejects.toThrow('Session has expired');
  });
});
