import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import type { Server } from 'node:http';
import { replayCrmMigrations } from '../../../tests/replay-crm-migrations';

vi.mock('../../../config/database.config', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.CRM_HISTORY_TEST_DATABASE_URL! } } }) }));
let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient, server: Server, base: string;
let adminToken: string, contactToken: string, deniedToken: string;
async function http(path: string, token = adminToken, body?: unknown) {
  return fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
beforeAll(async () => {
  process.env.JWT_SECRET = 'isolated-record-history-secret';
  pg = await PGlite.create(); await replayCrmMigrations(pg);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
  process.env.CRM_HISTORY_TEST_DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  db = (await import('../../../config/database.config')).default;
  const now = new Date();
  await db.tenant.createMany({ data: ['a','b'].map(id => ({ id, name: id, slug: id, onboardingStep: 3, onboardingCompletedAt: now })) });
  await db.user.createMany({ data: ['admin','contact-reader','denied'].map(id => ({ id, tenantId: 'a', firstName: id, lastName: 'Test', email: `${id}@camxian.com`, role: id === 'admin' ? 'Client Admin' : id, mustChangePassword: false, onboardingCompletedAt: now })) });
  await db.roleDefinition.create({ data: { id: 'contact-role', tenantId: 'a', name: 'contact-reader' } });
  await db.rolePermission.create({ data: { tenantId: 'a', roleId: 'contact-role', module: 'contacts', canView: true, canEdit: true } });
  await db.userRole.create({ data: { tenantId: 'a', roleId: 'contact-role', userId: 'contact-reader' } });
  await db.contact.create({ data: { id: 'converted-contact', tenantId: 'a', firstName: 'Converted', lastName: 'Contact', email: 'converted@example.test' } });
  await db.contact.create({ data: { id: 'foreign-contact', tenantId: 'b', firstName: 'Foreign', lastName: 'Contact', email: 'foreign@example.test' } });
  await db.lead.create({ data: { id: 'source-lead', tenantId: 'a', firstName: 'Source', lastName: 'Lead', contactId: 'converted-contact', convertedAt: now } });
  await db.activity.createMany({ data: Array.from({ length: 125 }, (_, i) => ({ id: `history-${String(i).padStart(3,'0')}`, tenantId: 'a', leadId: 'source-lead', ...(i === 124 ? { contactId: 'converted-contact' } : {}), type: i % 5 === 0 ? 'call' : 'note', title: `Historical ${i}`, createdById: 'admin', createdAt: new Date('2026-01-01T00:00:00Z') })) });
  const { createAuthSessionToken } = await import('../../../core/auth/auth-session');
  for (const id of ['admin','contact-reader','denied']) {
    const token = await createAuthSessionToken(await db.user.findUniqueOrThrow({ where: { id } }));
    if (id === 'admin') adminToken = token; else if (id === 'denied') deniedToken = token; else contactToken = token;
  }
  server = (await import('../../../app')).default.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
}, 180000);
afterAll(async () => {
  server?.closeAllConnections(); if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await db?.$disconnect(); await socket?.stop(); await pg?.close();
});

it('pages original Contact history beyond 100 with stable tied timestamp ordering and authors, without duplicates', async () => {
  const ids: string[] = []; let cursor: string | null = null;
  do {
    const response = await http(`/crm/activities?contactId=converted-contact&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, contactToken);
    expect(response.status).toBe(200);
    const body = await response.json() as { data: { id: string; createdBy: { id: string } }[]; total: number; nextCursor: string | null };
    expect(body.total).toBe(125); expect(body.data.every(row => row.createdBy.id === 'admin')).toBe(true);
    ids.push(...body.data.map(row => row.id)); cursor = body.nextCursor;
  } while (cursor);
  expect(ids).toHaveLength(125); expect(new Set(ids).size).toBe(125);
  expect(ids[0]).toBe('history-124'); expect(ids.at(-1)).toBe('history-000');
});
it('applies Notes type and Timeline search independently on the server', async () => {
  const notes = await (await http('/crm/activities?contactId=converted-contact&type=note&limit=20', contactToken)).json();
  expect(notes.total).toBe(100); expect(notes.data.every((row: { type: string }) => row.type === 'note')).toBe(true);
  const filtered = await (await http('/crm/activities?contactId=converted-contact&type=call&search=Historical%20120', contactToken)).json();
  expect(filtered.data.map((row: { id: string }) => row.id)).toEqual(['history-120']);
  expect((await http('/crm/activities?contactId=converted-contact&cursor=invalid', contactToken)).status).toBe(400);
  const malformed = Buffer.from(JSON.stringify({ createdAt: '2026-01-01T00:00:00Z', id: 123 })).toString('base64url');
  expect((await http(`/crm/activities?contactId=converted-contact&cursor=${malformed}`, contactToken)).status).toBe(400);
});
it('saves a trimmed note with the session author and rejects foreign/unauthorized record links', async () => {
  const saved = await http('/crm/activities', contactToken, { type: 'note', title: '  Current note  ', contactId: 'converted-contact' });
  expect(saved.status).toBe(201);
  expect((await saved.json()).data).toMatchObject({ title: 'Current note', createdById: 'contact-reader', contactId: 'converted-contact' });
  expect((await http('/crm/activities', contactToken, { type: 'note', title: 'Foreign', contactId: 'foreign-contact' })).status).toBe(404);
  expect((await http('/crm/activities?leadId=source-lead', contactToken)).status).toBe(403);
  expect((await http('/crm/activities?contactId=converted-contact', deniedToken)).status).toBe(403);
});
it('pages related Deals across direct and converted Lead links once per Deal', async () => {
  await db.pipeline.create({ data: { id: 'pipeline', tenantId: 'a', name: 'Sales' } });
  await db.stage.create({ data: { id: 'stage', tenantId: 'a', pipelineId: 'pipeline', name: 'New', order: 0 } });
  for (let i = 0; i < 55; i++) {
    const id = `deal-${String(i).padStart(2,'0')}`;
    await db.deal.create({ data: { id, tenantId: 'a', title: id, pipelineId: 'pipeline', stageId: 'stage', tags: [], leadDeals: { create: { leadId: 'source-lead', position: 0 } }, ...(i === 0 ? { contactDeals: { create: { contactId: 'converted-contact', position: 0 } } } : {}) } });
  }
  const first = await (await http('/crm/contacts/converted-contact/relationships?limit=50')).json();
  const older = await (await http('/crm/contacts/converted-contact/relationships?limit=50&page=2')).json();
  expect(first.data.hasMoreDeals).toBe(true); expect(older.data.hasMoreDeals).toBe(false);
  expect(new Set([...first.data.deals, ...older.data.deals].map(row => row.id)).size).toBe(55);
  const limited = await (await http('/crm/contacts/converted-contact/relationships?limit=50', contactToken)).json();
  expect(limited.data.deals).toEqual([]);
});
it('increments only committed content and returns no hidden payloads in the permission scoped stream', async () => {
  const before = (await db.dashboardRevision.findUniqueOrThrow({ where: { tenantId: 'a' } })).content;
  await expect(db.$transaction(async tx => { await tx.activity.create({ data: { tenantId: 'a', contactId: 'converted-contact', type: 'note', title: 'Rolled back', createdById: 'admin' } }); throw new Error('rollback'); })).rejects.toThrow('rollback');
  expect((await db.dashboardRevision.findUniqueOrThrow({ where: { tenantId: 'a' } })).content).toBe(before);
  await db.tenantPreference.create({ data: { tenantId: 'a', module: 'leads', key: 'field-layout', value: {} } });
  expect((await db.dashboardRevision.findUniqueOrThrow({ where: { tenantId: 'a' } })).content).toBe(before + 1n);
  expect((await http('/crm/record-events', deniedToken)).status).toBe(403);
  const controller = new AbortController();
  try {
    const response = await fetch(base + '/crm/record-events', { headers: { Authorization: `Bearer ${contactToken}` }, signal: controller.signal });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader(); const decoder = new TextDecoder(); let text = '';
    while (!text.includes('crm-change')) text += decoder.decode((await reader.read()).value);
    expect(text).toContain(`"content":"${before + 1n}"`);
    expect(text).not.toContain('Historical'); expect(text).not.toContain('converted-contact');
  } finally { controller.abort(); }
});
