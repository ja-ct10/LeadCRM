import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import prisma from '../../../config/database.config';
import app from '../../../app';
import { issueAuthSession } from '../../../core/auth/auth-session';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { validateImportRow } from '../imports/import-rows.service';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['127.0.0.1', 'localhost'].includes(url.hostname) && /^\/leadcrm_forms_test_\d+$/.test(url.pathname);
const text = `ñ é 中文 日本語 한글 مرحبا 😊 & ' " < > ∑ ₱ e\u0301 <tag>literal</tag>`;
const edited = `${text} edited`;
const description = `${text}\nSecond line 😊`;

describe.skipIf(!disposable)('plain text through authenticated HTTP and PostgreSQL', () => {
  // Share the application's single connection with the serialized PGlite fixture.
  const raw = prisma;
  let server: Server, base: string, token: string, foreignToken: string, tenantId: string, dealId: string, assigneeId: string;
  const products = '/administration/product-interests';
  async function call(path: string, method = 'GET', body?: unknown, auth = token) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: `leadcrm_token=${auth}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  beforeAll(async () => {
    async function actor() {
      const tenant = await raw.tenant.create({ data: { name: 'Unicode acceptance', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } });
      const user = await raw.user.create({ data: { tenantId: tenant.id, email: `${randomUUID()}@camxian.com`, firstName: 'Unicode', lastName: 'Tester', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
      return { tenantId: tenant.id, userId: user.id, token: (await issueAuthSession(user)).token };
    }
    const actorOne = await actor(); tenantId = actorOne.tenantId; token = actorOne.token;
    foreignToken = (await actor()).token;
    const assignee = await raw.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'Task', lastName: 'Agent', role: 'Task staff', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    const role = await raw.roleDefinition.create({ data: { tenantId, name: 'Task staff', permissions: { create: { module: 'tasks', canView: true } } } });
    await raw.userRole.create({ data: { tenantId, userId: assignee.id, roleId: role.id } });
    assigneeId = assignee.id;
    const pipeline = await raw.pipeline.create({ data: { tenantId, name: 'Unicode pipeline', isDefault: true } });
    const stage = await raw.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'New', order: 0, isDefault: true } });
    dealId = (await raw.deal.create({ data: { tenantId, title: 'Unicode task parent', pipelineId: pipeline.id, stageId: stage.id, assignedUserId: actorOne.userId } })).id;
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(done => server.once('listening', done));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>(done => server.close(() => done()));
    await prisma.$disconnect();
  });

  it('uses UTF-8 for the database and Prisma connection', async () => {
    const encoding = await raw.$queryRaw<Array<{ server: string; client: string }>>`SELECT current_setting('server_encoding') AS server, current_setting('client_encoding') AS client`;
    expect(encoding).toEqual([{ server: 'UTF8', client: 'UTF8' }]);
  });

  it('creates, edits and rereads Product names and descriptions without corruption', async () => {
    expect((await call(products + '/categories', 'PATCH', { action: 'add', name: text })).status).toBe(200);
    const created = await call(products, 'POST', { name: text, description, category: text, dealValue: 123 });
    expect(created.status).toBe(200);
    const product = created.body.data.find((row: { name: string }) => row.name === text);
    expect(product).toMatchObject({ name: text, description, category: text });
    expect((await call(products + '/' + product.id, 'PATCH', { name: edited, description: description + '\nEdited' })).status).toBe(200);
    expect((await call(products + '/' + product.id)).body.data).toMatchObject({ name: edited, description: description + '\nEdited' });
    expect(await raw.productInterest.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ name: edited, description: description + '\nEdited' });
    expect((await call(products, 'POST', { name: 'Invalid money', category: text, dealValue: '123abc' })).status).toBe(400);
  });

  it('preserves Campaign SMS text and Target Audience names through create and edit', async () => {
    const audience = await call('/marketing/audiences', 'POST', { name: text, source: 'LEADS', matchMode: 'AND', conditions: [] });
    expect(audience.status).toBe(201);
    const audienceId = audience.body.data.id;
    expect((await call('/marketing/audiences/' + audienceId, 'PUT', { name: edited, source: 'LEADS', matchMode: 'AND', conditions: [] })).status).toBe(200);
    expect((await call('/marketing/audiences')).body.data).toContainEqual(expect.objectContaining({ id: audienceId, name: edited }));
    const campaign = await call('/marketing/campaigns', 'POST', { name: text, type: 'SMS', body: description, targetAudienceId: audienceId });
    expect(campaign.status).toBe(201);
    const id = campaign.body.data.id;
    expect((await call('/marketing/campaigns/' + id, 'PUT', { name: edited, type: 'SMS', body: description + '\nEdited', targetAudienceId: audienceId })).status).toBe(200);
    expect((await call('/marketing/campaigns/' + id)).body.data).toMatchObject({ name: edited, body: description + '\nEdited' });
    expect(await raw.campaign.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: edited, body: description + '\nEdited' });
    expect(await raw.targetAudience.findUniqueOrThrow({ where: { id: audienceId } })).toMatchObject({ name: edited });
  });

  it('preserves Task titles and exact multiline note whitespace through create and edit', async () => {
    const notes = `  ${description}  `;
    const created = await call('/operations/tasks', 'POST', { title: text, description: notes, assignedUserId: assigneeId, dealIds: [dealId], dueDate: '2027-01-01T00:00:00Z' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await call('/operations/tasks/' + id, 'PUT', { title: edited, description: notes + '\nEdited  ' })).status).toBe(200);
    expect((await call('/operations/tasks/' + id)).body.data).toMatchObject({ title: edited, description: notes + '\nEdited  ' });
    expect(await raw.task.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: edited, description: notes + '\nEdited  ' });
    expect((await call('/operations/tasks/' + id, 'PUT', { description: 'before\u0000after' })).status).toBe(400);
    expect((await call('/operations/tasks/' + id, 'GET', undefined, foreignToken)).status).toBe(404);
  });

  it('preserves Workflow Details text and keeps inactive drafts inactive', async () => {
    const created = await call('/automation/workflows', 'POST', { name: text, description, trigger: 'deal.created', actions: [], isActive: false });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await call('/automation/workflows/' + id, 'PUT', { name: edited, description: description + '\nEdited' })).status).toBe(200);
    expect((await call('/automation/workflows/' + id)).body.data).toMatchObject({ name: edited, description: description + '\nEdited', isActive: false });
    expect(await raw.workflow.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: edited, description: description + '\nEdited' });
  });

  it('preserves Contact plain text and import values while rejecting invalid email and anonymous writes', async () => {
    const input = { firstName: text, lastName: 'Unicode', email: `${randomUUID()}@example.test`, notes: description, requestId: randomUUID() };
    const created = await call('/crm/contacts', 'POST', input);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await call('/crm/contacts/' + id, 'PUT', { firstName: edited, notes: description + '\nEdited' })).status).toBe(200);
    expect((await call('/crm/contacts/' + id)).body.data).toMatchObject({ firstName: edited, notes: description + '\nEdited' });
    expect(await raw.contact.findUniqueOrThrow({ where: { id } })).toMatchObject({ firstName: edited, notes: description + '\nEdited' });
    const row = await tenantContext.run({ tenantId }, () => validateImportRow(raw, 'accounts', tenantId, { rowNumber: 1, data: { name: text, address: description } }));
    expect(row.isValid).toBe(true); expect(row.data).toMatchObject({ name: text, address: description });
    expect((await call('/crm/contacts', 'POST', { ...input, requestId: randomUUID(), email: 'invalid' })).status).toBe(400);
    expect((await call('/crm/contacts', 'POST', input, '')).status).toBe(401);
  });
});
