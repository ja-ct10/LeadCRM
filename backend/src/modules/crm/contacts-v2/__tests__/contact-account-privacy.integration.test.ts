import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import prisma from '../../../../config/database.config';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import app from '../../../../app';

vi.mock('../../../../shared/services/email.service', () => ({ sendMail: vi.fn().mockResolvedValue({ submitted: true }) }));
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && (url.pathname === '/leadcrm_forms_test_2' || /^\/leadcrm_sales_test_\d+$/.test(url.pathname));
describe.skipIf(!disposable)('Contact Account metadata privacy on authenticated HTTP', { timeout: 30000 }, () => {
  let tenantId: string, token: string, roleId: string, base: string, server: Server;
  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Contact Account privacy', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Contact intake only' } });
    roleId = role.id;
    await prisma.rolePermission.create({ data: { tenantId, roleId, module: 'contacts', canView: true, canCreate: true, canEdit: true } });
    const actor = await prisma.user.create({ data: { tenantId, firstName: 'Intake', lastName: 'Employee', email: `${randomUUID()}@camxian.com`, role: role.name,
      mustChangePassword: false, onboardingCompletedAt: new Date(), emailVerified: new Date(), userRoles: { create: { roleId } } } });
    token = (await issueAuthSession(actor)).token;
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  }, 30000);
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });

  it('requires current Accounts View for new selections and hides nested names/search after revocation while retaining historical IDs', async () => {
    const secret = `Account-secret-${randomUUID()}`;
    const account = await prisma.account.create({ data: { tenantId, name: secret } });
    const replacement = await prisma.account.create({ data: { tenantId, name: `Other-secret-${randomUUID()}` } });
    expect((await request(`/crm/accounts/${account.id}`)).status).toBe(403);
    const rejectedInput = { requestId: randomUUID(), firstName: 'Rejected', lastName: 'Selection', email: `${randomUUID()}@example.test`, accountId: account.id };
    const rejected = await request('/crm/contacts', 'POST', rejectedInput);
    expect.soft(rejected.status, JSON.stringify(rejected.body)).toBe(403);
    expect.soft(await prisma.contact.count({ where: { tenantId, email: rejectedInput.email } })).toBe(0);
    expect.soft(await prisma.contactCreationReceipt.count({ where: { tenantId, requestId: rejectedInput.requestId } })).toBe(0);

    const accountsGrant = await prisma.rolePermission.create({ data: { tenantId, roleId, module: 'accounts', canView: true } });
    const input = { requestId: randomUUID(), firstName: `Retained-${randomUUID()}`, lastName: 'Contact', email: `${randomUUID()}@example.test`, company: 'Public Contact company', accountId: account.id };
    const created = await request('/crm/contacts', 'POST', input);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data.account).toEqual({ id: account.id, name: secret });
    const allowedSearch = await request(`/crm/contacts?search=${encodeURIComponent(secret)}`);
    expect(allowedSearch.status).toBe(200); expect(allowedSearch.body.data.some((row: { id: string }) => row.id === id)).toBe(true);
    await prisma.rolePermission.delete({ where: { id: accountsGrant.id } });
    expect((await request(`/crm/accounts/${account.id}`)).status).toBe(403);

    const detail = await request(`/crm/contacts/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id, accountId: account.id, company: input.company, firstName: input.firstName });
    expect.soft(detail.body.data.account).toBeNull();
    const listed = await request(`/crm/contacts?search=${encodeURIComponent(input.firstName)}`);
    expect(listed.status).toBe(200); expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].accountId).toBe(account.id);
    expect.soft(listed.body.data[0].account).toBeNull();
    const deniedSearch = await request(`/crm/contacts?search=${encodeURIComponent(secret)}`);
    expect(deniedSearch.status).toBe(200);
    expect.soft(deniedSearch.body.data).toEqual([]); expect.soft(deniedSearch.body.meta.total).toBe(0);
    const replay = await request('/crm/contacts', 'POST', input);
    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.data.id).toBe(id); expect(replay.body.data.accountId).toBe(account.id);
    expect.soft(replay.body.data.account).toBeNull();
    const edit = await request(`/crm/contacts/${id}`, 'PUT', { notes: 'Unrelated edit remains permitted', accountId: account.id });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    expect(edit.body.data).toMatchObject({ id, accountId: account.id, notes: 'Unrelated edit remains permitted', company: input.company });
    expect.soft(edit.body.data.account).toBeNull();
    const changed = await request(`/crm/contacts/${id}`, 'PUT', { accountId: replacement.id, notes: 'Must roll back with rejected association' });
    expect.soft(changed.status, JSON.stringify(changed.body)).toBe(403);
    expect.soft(await prisma.contact.findUniqueOrThrow({ where: { id } })).toMatchObject({ accountId: account.id, notes: 'Unrelated edit remains permitted' });
    const unlinked = await request(`/crm/contacts/${id}`, 'PUT', { accountId: null });
    expect(unlinked.status, JSON.stringify(unlinked.body)).toBe(200);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id } })).accountId).toBeNull();
    expect(unlinked.body.data.account).toBeNull();

    await prisma.rolePermission.create({ data: { tenantId, roleId, module: 'accounts', canView: true } });
    const authorizedChange = await request(`/crm/contacts/${id}`, 'PUT', { accountId: replacement.id });
    expect(authorizedChange.status, JSON.stringify(authorizedChange.body)).toBe(200);
    expect(authorizedChange.body.data.account).toEqual({ id: replacement.id, name: replacement.name });
    expect((await request(`/crm/contacts/${id}`, 'PUT', { accountId: null })).status).toBe(200);
  });
});
