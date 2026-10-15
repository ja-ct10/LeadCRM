import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import prisma from '../../../config/database.config';
import app from '../../../app';
import { issueAuthSession } from '../../../core/auth/auth-session';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { CreateLeadSchema, NewAccountSchema } from '@leadcrm/shared';
import { CreateClientContactSchema } from '../contacts-v2/contacts-v2.dto';
import { crmActor } from '../access/crm-record-access.service';
import * as merges from '../merge/merge.service';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = url.hostname === '127.0.0.1' && /^\/leadcrm_crm_polish_test(?:_\d+)?$/.test(url.pathname);
describe.skipIf(!disposable)('Atomic organization creation over authenticated HTTP', () => {
  let tenantId: string, adminId: string, adminToken: string, staffToken: string, server: Server, base: string, roleId: string, productId: string;
  const scope = <T>(run: () => T) => tenantContext.run({ tenantId }, run);
  const person = () => ({ firstName: 'Person', lastName: 'Polish', email: `${randomUUID()}@example.test`, status: 'Warm', requestId: randomUUID() });
  const company = () => ({ requestId: randomUUID(), name: `Company ${randomUUID()}`, industry: 'Technology', size: '11-50', website: 'https://company.test', address: '42 Main Street\nMakati, Philippines' });
  async function call(path: string, method: string, body: unknown, token = adminToken) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Polish acceptance', slug: randomUUID(), status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    const admin = await prisma.user.create({ data: { tenantId, firstName: 'Test', lastName: 'Admin', role: 'Client Admin', email: `${randomUUID()}@camxian.com`, mustChangePassword: false, onboardingCompletedAt: new Date() } });
    adminToken = (await issueAuthSession(admin)).token;
    adminId = admin.id;
    productId = (await scope(() => prisma.productInterest.create({ data: { tenantId, name: 'Polish Product', dealValue: 2500 } }))).id;
    const role = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Person intake' } })); roleId = role.id;
    await scope(() => prisma.rolePermission.createMany({ data: ['leads', 'contacts'].map(module => ({ tenantId, roleId, module, canView: true, canCreate: true, canEdit: true })) }));
    const staff = await prisma.user.create({ data: { tenantId, firstName: 'Test', lastName: 'Staff', role: role.name, email: `${randomUUID()}@camxian.com`, mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId } } } });
    staffToken = (await issueAuthSession(staff)).token;
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  }, 30000);
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });

  it('shares strict contracts and rejects conflicting Account input', () => {
    const newAccount = company();
    expect(NewAccountSchema.safeParse(newAccount).success).toBe(true);
    expect(NewAccountSchema.safeParse({ ...newAccount, website: 'bad' }).success).toBe(false);
    expect(NewAccountSchema.safeParse({ ...newAccount, address: 'a'.repeat(2001) }).success).toBe(false);
    expect(NewAccountSchema.safeParse({ ...newAccount, address: 'Bad\u0000address' }).success).toBe(false);
    expect(CreateLeadSchema.safeParse({ ...person(), accountId: randomUUID(), newAccount }).success).toBe(false);
    expect(CreateClientContactSchema.safeParse({ ...person(), accountId: randomUUID(), newAccount }).success).toBe(false);
  });

  it.each(['leads', 'contacts'])('creates %s plus one Account, returns company details and replays safely', async module => {
    const input = { ...person(), newAccount: company(), ...(module === 'leads' ? { productInterest: [productId] } : { productInterestIds: [productId] }) };
    const first = await call(`/crm/${module}`, 'POST', input);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const retry = await call(`/crm/${module}`, 'POST', input);
    expect([200, 201]).toContain(retry.status); expect(retry.body.data.id).toBe(first.body.data.id);
    expect(first.body.data.account).toMatchObject({ name: input.newAccount.name, industry: 'Technology', size: '11-50', website: 'https://company.test' });
    expect(await scope(() => prisma.account.count({ where: { tenantId, name: input.newAccount.name } }))).toBe(1);
    expect((await scope(() => prisma.account.findFirstOrThrow({ where: { tenantId, id: first.body.data.accountId } }))).address).toBe(input.newAccount.address);
    expect(first.body.data.address || '').toBe('');
    const deals = await scope(() => prisma.deal.findMany({ where: { tenantId, accountId: first.body.data.accountId } }));
    expect(deals).toHaveLength(1); expect(Number(deals[0].value)).toBe(2500);
    const updated = { newAccount: company() };
    const edit = await call(`/crm/${module}/${first.body.data.id}`, 'PUT', updated);
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    const replayEdit = await call(`/crm/${module}/${first.body.data.id}`, 'PUT', updated);
    expect(replayEdit.status, JSON.stringify(replayEdit.body)).toBe(200);
    expect(replayEdit.body.data.accountId).toBe(edit.body.data.accountId);
    expect(await scope(() => prisma.account.count({ where: { tenantId, name: updated.newAccount.name } }))).toBe(1);
  });

  it.each(['leads', 'contacts'])('deduplicates concurrent %s submissions with one linked Account', async module => {
    const input = { ...person(), newAccount: company() };
    const responses = await Promise.all(Array.from({ length: 3 }, () => call(`/crm/${module}`, 'POST', input)));
    expect(responses.every(response => [200, 201, 409].includes(response.status)), JSON.stringify(responses)).toBe(true);
    const successes = responses.filter(response => response.status < 300);
    expect(successes.length).toBeGreaterThan(0);
    expect(new Set(successes.map(response => response.body.data.id)).size).toBe(1);
    const retry = await call(`/crm/${module}`, 'POST', input);
    expect(retry.body.data.id).toBe(successes[0].body.data.id);
    expect(await scope(() => prisma.account.count({ where: { tenantId, name: input.newAccount.name } }))).toBe(1);
    expect(await scope(() => prisma.accountCreationReceipt.count({ where: { tenantId, requestId: input.newAccount.requestId } }))).toBe(1);
  });

  it.each(['leads', 'contacts'])('links an existing Account to %s using only accountId and preserves the link on retry', async module => {
    const account = await scope(() => prisma.account.create({ data: { tenantId, name: `Selected Account ${randomUUID()}` } }));
    const input = { ...person(), accountId: account.id };
    const receiptCount = await scope(() => prisma.accountCreationReceipt.count({ where: { tenantId } }));
    const created = await call(`/crm/${module}`, 'POST', input);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const retry = await call(`/crm/${module}`, 'POST', input);
    expect(retry.body.data.id).toBe(created.body.data.id);
    const where = { id: created.body.data.id, tenantId };
    const saved = module === 'leads' ? await scope(() => prisma.lead.findUniqueOrThrow({ where })) : await scope(() => prisma.contact.findUniqueOrThrow({ where }));
    expect(saved.accountId).toBe(account.id);
    expect('companyName' in saved ? saved.companyName : saved.company).toBe(account.name);
    expect(await scope(() => prisma.accountCreationReceipt.count({ where: { tenantId } }))).toBe(receiptCount);
  });

  it('rolls back the Account and its receipt if the person save fails', async () => {
    const newAccount = company();
    const response = await call('/crm/leads', 'POST', { ...person(), newAccount, customFieldValues: { nonexistent: 'invalid' } });
    expect(response.status).toBe(400);
    expect(await scope(() => prisma.account.count({ where: { tenantId, name: newAccount.name } }))).toBe(0);
    expect(await scope(() => prisma.accountCreationReceipt.count({ where: { tenantId, requestId: newAccount.requestId } }))).toBe(0);
  });

  it('enforces Account permissions and rejects hidden Account metadata', async () => {
    for (const module of ['leads', 'contacts']) {
      const nested = { ...person(), newAccount: company() };
      expect((await call(`/crm/${module}`, 'POST', nested, staffToken)).status).toBe(403);
      expect(await scope(() => prisma.account.count({ where: { tenantId, name: nested.newAccount.name } }))).toBe(0);
      const linked = await call(`/crm/${module}`, 'POST', nested);
      expect(linked.status, JSON.stringify(linked.body)).toBe(201);
      const response = await fetch(`${base}/crm/${module}/${linked.body.data.id}`, { headers: { Authorization: `Bearer ${staffToken}` } });
      const hidden = await response.json(); expect(response.status).toBe(200); expect(hidden.data.account).toBeNull();
    }
  });

  it('rejects cross-tenant Account selections and tenant injection', async () => {
    const foreign = await prisma.tenant.create({ data: { name: 'Foreign', slug: randomUUID() } });
    const account = await prisma.account.create({ data: { tenantId: foreign.id, name: 'Foreign secret' } });
    for (const module of ['leads', 'contacts']) {
      const selected = await call(`/crm/${module}`, 'POST', { ...person(), accountId: account.id });
      expect([400, 404]).toContain(selected.status);
      const injected = await call(`/crm/${module}`, 'POST', { ...person(), newAccount: { ...company(), tenantId: foreign.id } });
      expect(injected.status).toBe(400);
    }
  });

  it('moves imported notes through Account merges without duplication or forged provenance', async () => {
    const primary = await scope(() => prisma.account.create({ data: { tenantId, name: 'Surviving company' } }));
    const secondary = await scope(() => prisma.account.create({ data: { tenantId, name: 'Merged company', notes: 'Original company note' } }));
    const params = { tenantId, entityType: 'account' as const, primaryId: primary.id, secondaryId: secondary.id };
    const preview = await scope(() => merges.preview(params));
    expect(preview.fieldComparisons.map(field => field.field)).not.toContain('notes');
    expect((await call('/crm/activities', 'POST', { type: 'note', title: 'Forged import', accountId: primary.id, metadata: { legacyAccountNote: 'v1' } })).status).toBe(403);
    await crmActor.run({ tenantId, userId: adminId }, () => scope(() => merges.execute({ ...params, userId: adminId, fieldResolutions: {} })));
    const notes = await scope(() => prisma.activity.findMany({ where: { tenantId, accountId: primary.id, type: 'note' } }));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ description: 'Original company note', createdById: null, metadata: { sourceAccountId: secondary.id } });
    const [destination] = await prisma.$queryRawUnsafe<Array<{ valid: boolean }>>('SELECT crm_history.account_note_destination($1,$2,$3) AS valid', tenantId, secondary.id, primary.id);
    expect(destination.valid).toBe(true);
  });

  it('enforces required Account custom fields and request identity without leaving partial records', async () => {
    const fieldId = randomUUID();
    await scope(() => prisma.closingFieldDefinition.create({ data: { tenantId, id: fieldId, definition: { id: fieldId, name: 'Company context', module: 'accounts', type: 'Text', group: 'Additional Information', groupId: 'accounts:additional-information', required: true, active: true, visibleInForm: true, visibleInDetails: true, options: [], order: 0 } } }));
    const input = { ...person(), newAccount: company() };
    const missing = await call('/crm/contacts', 'POST', input); expect(missing.status, JSON.stringify(missing.body)).toBe(400);
    expect(await scope(() => prisma.account.count({ where: { tenantId, name: input.newAccount.name } }))).toBe(0);
    const complete = { ...input, newAccount: { ...input.newAccount, customFieldValues: { [fieldId]: 'Required company context' } } };
    const saved = await call('/crm/contacts', 'POST', complete); expect(saved.status, JSON.stringify(saved.body)).toBe(201);
    expect((await call('/crm/contacts', 'POST', { ...person(), newAccount: { ...complete.newAccount, name: 'Changed receipt input' } })).status).toBe(409);
    const optional = await call('/crm/leads', 'POST', { ...person(), companyName: 'Legacy company text' });
    expect(optional.status, JSON.stringify(optional.body)).toBe(201); expect(optional.body.data.accountId).toBeNull();
    expect((await call(`/crm/leads/${optional.body.data.id}`, 'PUT', { address: 'Updated address' })).status).toBe(200);
    expect(await scope(() => prisma.account.count({ where: { tenantId, name: 'Legacy company text' } }))).toBe(0);
  });
});
