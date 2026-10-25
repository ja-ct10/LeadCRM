import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';

const state = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('../auth.service', () => ({ loginUser: state.login }));
vi.mock('../auth-user', () => ({ readAuthUser: async () => user }));
vi.mock('../../../config/database.config', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.SESSION_HTTP_DATABASE_URL! } } }) }));

const user = { id: 'session-user', tenantId: 'session-tenant', email: 'session@camxian.com', firstName: 'Session', lastName: 'Fixture', role: 'Client Admin', status: 'ACTIVE', tenantStatus: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date().toISOString() };
let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient, server: Server, base: string;

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('JWT_SECRET', 'disposable-session-http-signing-key');
  pg = await PGlite.create();
  // Focused session-store fixture. Account lookup is mocked; real session SQL,
  // JWTs, middleware, controllers, validation and cookie behavior run below.
  await pg.exec(`CREATE TABLE "Session" (
    id TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT UNIQUE NOT NULL, "userAgent" TEXT, "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
  vi.stubEnv('SESSION_HTTP_DATABASE_URL', `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`);
  db = (await import('../../../config/database.config')).default;
  const { signToken } = await import('../jwt.service');
  const { createSession } = await import('../session.service');
  state.login.mockImplementation(async () => {
    const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email });
    await createSession({ userId: user.id, tenantId: user.tenantId, token, expiresInMs: 604800000 });
    return { user, token };
  });
  const controller = await import('../auth.controller');
  const { authMiddleware } = await import('../../../api/middleware/auth.middleware');
  const { validate } = await import('../../../api/middleware/validate.middleware');
  const { errorMiddleware } = await import('../../../api/middleware/error.middleware');
  const { LogoutSchema, SessionActivitySchema } = await import('@leadcrm/shared');
  const app = express(); app.use(express.json(), cookieParser());
  app.post('/auth/login', controller.login);
  app.get('/auth/me', authMiddleware, controller.me);
  app.post('/auth/activity', authMiddleware, validate(SessionActivitySchema), controller.activity);
  app.post('/auth/logout', validate(LogoutSchema), controller.logout);
  app.get('/protected', authMiddleware, (_req, res) => { res.json({ success: true }); });
  app.use(errorMiddleware);
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 120000);
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await db?.$disconnect(); await socket?.stop(); await pg?.close(); vi.unstubAllEnvs();
});

async function call(path: string, cookie: string, body?: unknown) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-LeadCRM-Passive': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function login(rememberMe = false) {
  const response = await call('/auth/login', '', { email: user.email, password: 'fixture-only', rememberMe });
  expect(response.status).toBe(200);
  const header = response.headers.getSetCookie().find(value => value.startsWith('leadcrm_token='))!;
  return { cookie: header.split(';')[0], header, sessionId: response.body.data.session.sessionId as string };
}

describe('real HTTP session lifecycle', () => {
  it.each([false, true])('issues the correct Remember Me=%s cookie and revokes explicit logout', async rememberMe => {
    const session = await login(rememberMe);
    expect(session.header).toMatch(/HttpOnly/i); expect(session.header).toMatch(/SameSite=Lax/i);
    expect(/Max-Age=604800/i.test(session.header)).toBe(rememberMe);
    const response = await call('/auth/logout', session.cookie, { sessionId: session.sessionId });
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(';')).toMatch(/leadcrm_token=;.*Expires=Thu, 01 Jan 1970/i);
    expect((await call('/protected', session.cookie)).status).toBe(401);
    expect((await db.session.findUniqueOrThrow({ where: { id: session.sessionId } })).revokedAt).not.toBeNull();
    expect((await call('/auth/logout', session.cookie, {})).status).toBe(200);
  });
  it('preserves 29-minute passive sessions and rejects protected APIs and late activity at 30 minutes', async () => {
    const session = await login(true), at29 = new Date(Date.now() - 29 * 60000);
    await db.session.update({ where: { id: session.sessionId }, data: { lastActiveAt: at29 } });
    expect((await call('/auth/me', session.cookie)).status).toBe(200);
    expect((await db.session.findUniqueOrThrow({ where: { id: session.sessionId } })).lastActiveAt).toEqual(at29);
    const expiredAt = new Date(Date.now() - 30 * 60000);
    await db.session.update({ where: { id: session.sessionId }, data: { lastActiveAt: expiredAt } });
    for (const path of ['/auth/me', '/protected']) {
      const response = await call(path, session.cookie);
      expect(response.status).toBe(401); expect(response.body.error.code).toBe('SESSION_IDLE_EXPIRED');
    }
    expect((await call('/auth/activity', session.cookie, { sessionId: session.sessionId, lastActiveAt: new Date().toISOString() })).status).toBe(401);
    expect((await db.session.findUniqueOrThrow({ where: { id: session.sessionId } })).lastActiveAt).toEqual(expiredAt);
  });
  it('renews foreground activity and protects replacement sessions from stale-tab mutations', async () => {
    const old = await login(), current = await login();
    await db.session.update({ where: { id: current.sessionId }, data: { lastActiveAt: new Date(Date.now() - 29 * 60000) } });
    const mismatch = await call('/auth/logout', current.cookie, { sessionId: old.sessionId });
    expect(mismatch.status).toBe(409); expect(mismatch.headers.getSetCookie()).toEqual([]);
    expect((await call('/auth/activity', current.cookie, { sessionId: old.sessionId, lastActiveAt: new Date().toISOString() })).status).toBe(409);
    const activity = await call('/auth/activity', current.cookie, { sessionId: current.sessionId, lastActiveAt: new Date().toISOString() });
    expect(activity.status).toBe(200); expect(activity.body.data.session.sessionId).toBe(current.sessionId);
    expect(Date.now() - Date.parse(activity.body.data.session.lastActiveAt)).toBeLessThan(10000);
    expect((await call('/auth/me', current.cookie)).status).toBe(200);
    expect((await call('/auth/activity', current.cookie, { lastActiveAt: 'invalid' })).status).toBe(400);
  });
});
