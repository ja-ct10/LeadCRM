import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { EMAIL_AVAILABILITY_MESSAGES, INTERNAL_EMPLOYEE_CUSTOMER_EMAIL_ERROR as message } from '@leadcrm/shared';
import { replayCrmMigrations } from '../../../tests/replay-crm-migrations';
import { installTenantScoping } from '../../../core/tenant/tenant-prisma';
import { installProductProjections } from '../../../core/tenant/product-projections';
import { crmActor, installCrmRecordAccess } from '../access/crm-record-access.service';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { assertExternalCustomerEmail } from '../record-validation';

const holder = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock('../../../config/database.config', () => ({ default: new Proxy({}, { get: (_target, property) => {
  const value = (holder.client as any)[property]; return typeof value === 'function' ? value.bind(holder.client) : value;
} }) }));
vi.mock('../../../shared/services/email.service', () => ({ sendMail: vi.fn() }));

let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient, server: Server, base: string, token: string;
const tenantId = randomUUID(), otherTenant = randomUUID(), adminId = randomUUID(), pipelineId = randomUUID(), stageId = randomUUID(), productId = randomUUID();
const employeeEmail = 'employee@example.test';
const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, () => crmActor.run({ tenantId, userId: adminId }, work));
const person = (email = `${randomUUID()}@example.test`) => ({ firstName: 'External', lastName: 'Customer', email, requestId: randomUUID() });
const dealInput = (leadId: string) => ({ title: 'Customer opportunity', pipelineId, stageId, productInterestIds: [productId], leadIds: [leadId] });
async function call(path: string, method = 'POST', body?: unknown, authenticated: boolean | string = true) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${typeof authenticated === 'string' ? authenticated : token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function effects() {
  return {
    leads: await db.lead.count(), contacts: await db.contact.count(), accounts: await db.account.count(), deals: await db.deal.count(),
    leadLinks: await db.leadDeal.count(), contactLinks: await db.contactDeal.count(), activities: await db.activity.count(),
    audit: await db.auditLog.count(), events: await db.notificationEvent.count(), submissions: await db.formSubmission.count(),
    leadReceipts: await db.contactCreationReceipt.count(), accountReceipts: await db.accountCreationReceipt.count(), dealReceipts: await db.dealCreationReceipt.count(),
    preferences: await db.tenantPreference.findMany({ orderBy: { id: 'asc' } }),
  };
}
async function rejected(path: string, method: string, body: unknown, field = 'email') {
  const before = await effects();
  const result = await call(path, method, body);
  const creatingCustomer = method === 'POST' && ['/crm/leads', '/crm/contacts'].includes(path);
  expect(result, JSON.stringify(result)).toMatchObject({ status: 400, body: creatingCustomer
    ? { success: false, error: { code: 'STAFF_EMAIL_NOT_ALLOWED', message: EMAIL_AVAILABILITY_MESSAGES.STAFF_EMAIL_NOT_ALLOWED } }
    : { success: false, error: message, fieldErrors: { [field]: [message] } } });
  expect(await effects()).toEqual(before);
}
async function legacy(kind: 'lead' | 'contact', email = employeeEmail) {
  const data = { tenantId, firstName: 'Legacy', lastName: 'Employee', email, assignedUserId: adminId };
  return kind === 'lead' ? db.lead.create({ data }) : db.contact.create({ data });
}

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'employee-customer-disposable-test-secret');
  pg = await PGlite.create(); await replayCrmMigrations(pg);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
  db = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1` } } });
  holder.client = db;
  installProductProjections(db); installTenantScoping(db); installCrmRecordAccess(db);
  await db.tenant.createMany({ data: [tenantId, otherTenant].map(id => ({ id, name: 'Employee customer test', slug: id, status: 'ACTIVE', onboardingStep: 3, onboardingCompletedAt: new Date() })) });
  const admin = await db.user.create({ data: { id: adminId, tenantId, firstName: 'Test', lastName: 'Admin', role: 'Client Admin', email: 'admin@camxian.com', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  await db.user.createMany({ data: [
    { tenantId, email: ` ${employeeEmail.toUpperCase()} `, firstName: 'Internal', lastName: 'Staff', role: 'Custom role', status: 'INACTIVE' },
    { tenantId: otherTenant, email: 'foreign@example.test', firstName: 'Other', lastName: 'Employee', role: 'Client Admin', status: 'ACTIVE' },
  ] });
  await db.pipeline.create({ data: { id: pipelineId, tenantId, name: 'Sales Pipeline' } });
  await db.stage.create({ data: { id: stageId, tenantId, pipelineId, name: 'Lead', order: 0 } });
  await db.productInterest.create({ data: { id: productId, tenantId, name: 'Camera', dealValue: 100 } });
  token = (await (await import('../../../core/auth/auth-session')).issueAuthSession(admin)).token;
  server = (await import('../../../app')).default.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
}, 180000);
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await db?.$disconnect(); await socket?.stop(); await pg?.close(); vi.unstubAllEnvs();
});

describe('employee customer guard over authenticated HTTP and disposable SQL', () => {
  it('enforces tenant-wide identity checks without Team, Archived Data or participant View access', async () => {
    const role = await db.roleDefinition.create({ data: { tenantId, name: 'Limited CRM', permissions: { create: [
      { module: 'leads', canView: true, canViewMy: true, canCreate: true },
      { module: 'deals', canView: true, canViewAll: true, canEdit: true },
    ] } } });
    const staff = await db.user.create({ data: { tenantId, firstName: 'Limited', lastName: 'Staff', role: role.name, email: 'limited@camxian.com', mustChangePassword: false,
      onboardingCompletedAt: new Date(), userRoles: { create: { roleId: role.id } } } });
    const staffToken = (await (await import('../../../core/auth/auth-session')).issueAuthSession(staff)).token;
    const create = await call('/crm/leads', 'POST', person(employeeEmail), staffToken);
    expect(create.status, JSON.stringify(create.body)).toBe(400);
    expect(create.body).toMatchObject({ error: { code: 'STAFF_EMAIL_NOT_ALLOWED', message: EMAIL_AVAILABILITY_MESSAGES.STAFF_EMAIL_NOT_ALLOWED } });
    const hidden = await legacy('lead');
    const deal = await db.deal.create({ data: { tenantId, title: 'Visible Deal / hidden customer', pipelineId, stageId, assignedUserId: staff.id,
      leadDeals: { create: { leadId: hidden.id } } } });
    const edit = await call(`/crm/deals/${deal.id}`, 'PUT', { title: 'Invalid customer save' }, staffToken);
    expect(edit.status, JSON.stringify(edit.body)).toBe(400);
    expect(edit.body).toMatchObject({ error: message, fieldErrors: { leadIds: [message] } });
    expect((await db.deal.findUniqueOrThrow({ where: { id: deal.id } })).title).toBe(deal.title);
  });

  it.each(['Client Admin', 'Sales Agent', 'Custom role'])('checks %s in every status without granting a role exemption', async role => {
    for (const status of ['ACTIVE', 'PENDING', 'INACTIVE'] as const) {
      const email = `${randomUUID()}@example.test`;
      await db.user.create({ data: { tenantId, email: ` ${email.toUpperCase()} `, firstName: 'Staff', lastName: 'Test', role, status } });
      await expect(assertExternalCustomerEmail(db, tenantId, ` ${email} `)).rejects.toThrow(message);
    }
    await expect(assertExternalCustomerEmail(db, tenantId, undefined)).resolves.toBeUndefined();
    await expect(assertExternalCustomerEmail(db, tenantId, null)).resolves.toBeUndefined();
    await expect(assertExternalCustomerEmail(db, tenantId, 'foreign@example.test')).resolves.toBeUndefined();
    await expect(assertExternalCustomerEmail(db, tenantId, 'employee@example.test.other')).resolves.toBeUndefined();
  });

  it.each(['leads', 'contacts'])('rejects %s creation before linked Account, Product Deal, audit or rotation writes', async module => {
    await rejected(`/crm/${module}`, 'POST', { ...person(' EMPLOYEE@EXAMPLE.TEST '), newAccount: { name: 'Must not be created', requestId: randomUUID() },
      ...(module === 'leads' ? { productInterest: [productId] } : { productInterestIds: [productId] }) });
    const input = person('foreign@example.test');
    const result = await call(`/crm/${module}`, 'POST', input);
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    expect(result.body.data.email).toBe(input.email);
  });

  it.each(['leads', 'contacts'])('requires correction on %s edits, including omitted email and Account changes', async module => {
    const row = await legacy(module === 'leads' ? 'lead' : 'contact');
    await rejected(`/crm/${module}/${row.id}`, 'PUT', { firstName: 'Changed' });
    await rejected(`/crm/${module}/${row.id}`, 'PUT', { newAccount: { name: 'No linked Account', requestId: randomUUID() } });
    const externalEmail = `${randomUUID()}@example.test`;
    expect((await call(`/crm/${module}/${row.id}`, 'PUT', { email: externalEmail })).status).toBe(200);
    await rejected(`/crm/${module}/${row.id}`, 'PUT', { email: ' EMPLOYEE@EXAMPLE.TEST ' });
  });

  it.each(['lead', 'contact'] as const)('blocks %s customer IDs in manual, batch, duplicate and update Deal operations', async kind => {
    const row = await legacy(kind), field = kind === 'lead' ? 'leadIds' : 'contactIds';
    const dto = { ...dealInput(row.id), leadIds: undefined, [field]: [row.id] };
    await rejected('/crm/deals', 'POST', dto, field);
    await rejected('/crm/deals/batch', 'POST', { ...dto, idempotencyKey: randomUUID() }, field);
    const deal = await db.deal.create({ data: { tenantId, title: 'Legacy opportunity', pipelineId, stageId, productInterestId: productId,
      ...(kind === 'lead' ? { leadDeals: { create: { leadId: row.id } } } : { contactDeals: { create: { contactId: row.id } } }) } });
    await rejected(`/crm/deals/${deal.id}/duplicate`, 'POST', {}, field);
    await rejected(`/crm/deals/${deal.id}`, 'PUT', { title: 'Changed' }, field);
    const repaired = await call(`/crm/deals/${deal.id}`, 'PUT', { [field]: [], title: 'Repaired opportunity' });
    expect(repaired.status, JSON.stringify(repaired.body)).toBe(200);
    expect(await (kind === 'lead' ? db.leadDeal.count({ where: { dealId: deal.id } }) : db.contactDeal.count({ where: { dealId: deal.id } }))).toBe(0);
    await rejected(`/crm/deals/${deal.id}`, 'PUT', { [field]: [row.id] }, field);
    await rejected(`/crm/deals/${deal.id}`, 'PUT', { primaryAssociation: { type: kind, id: row.id } }, field);
  });

  it('can replace a conflicting primary association with a valid customer and keep employee assignment', async () => {
    const invalid = await legacy('lead'), valid = await legacy('contact', `${randomUUID()}@example.test`);
    const deal = await db.deal.create({ data: { tenantId, title: 'Repair association', pipelineId, stageId, assignedUserId: adminId,
      leadDeals: { create: { leadId: invalid.id } } } });
    const result = await call(`/crm/deals/${deal.id}`, 'PUT', { primaryAssociation: { type: 'contact', id: valid.id, previous: { type: 'lead', id: invalid.id } } });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(await db.leadDeal.count({ where: { dealId: deal.id } })).toBe(0);
    expect(await db.contactDeal.count({ where: { dealId: deal.id, contactId: valid.id } })).toBe(1);
    expect((await db.deal.findUniqueOrThrow({ where: { id: deal.id } })).assignedUserId).toBe(adminId);
  });

  it('rejects conversion and merged employee identities before relationship reassignment', async () => {
    const invalid = await legacy('lead'), valid = await legacy('lead', `${randomUUID()}@example.test`);
    await rejected(`/crm/leads/${invalid.id}/convert`, 'POST', { createContact: true, createDeal: false });
    await rejected('/crm/merge', 'POST', { entityType: 'lead', primaryId: valid.id, secondaryId: invalid.id, fieldResolutions: { email: 'secondary' } });
    expect((await db.lead.findUniqueOrThrow({ where: { id: invalid.id } })).isArchived).toBe(false);
    const badContact = await legacy('contact'), goodContact = await legacy('contact', `${randomUUID()}@example.test`);
    await rejected('/crm/merge', 'POST', { entityType: 'contact', primaryId: goodContact.id, secondaryId: badContact.id, fieldResolutions: { email: 'secondary' } });
  });

  it('rejects automatic Product Deals and Account merge reassignment for internal customer identities', async () => {
    const row = await legacy('lead');
    await db.leadProductInterest.create({ data: { tenantId, leadId: row.id, productInterestId: productId, position: 0 } });
    await db.lead.update({ where: { id: row.id }, data: { productsNormalized: true } });
    const { salesTransaction, createProductDeals } = await import('../leads/lead-automation.service');
    const before = await effects();
    await expect(scope(() => salesTransaction(tx => createProductDeals(tx, tenantId, row.id, adminId)))).rejects.toThrow(message);
    expect(await effects()).toEqual(before);
    const primary = await db.account.create({ data: { tenantId, name: 'Primary' } });
    const secondary = await db.account.create({ data: { tenantId, name: 'Secondary' } });
    await db.lead.update({ where: { id: row.id }, data: { accountId: secondary.id } });
    await rejected('/crm/merge', 'POST', { entityType: 'account', primaryId: primary.id, secondaryId: secondary.id, fieldResolutions: {} }, 'leadIds');
    expect((await db.lead.findUniqueOrThrow({ where: { id: row.id } })).accountId).toBe(secondary.id);
  });

  it('allows a valid customer conversion and resulting customer associations', async () => {
    const row = await legacy('lead', `${randomUUID()}@example.test`);
    const converted = await call(`/crm/leads/${row.id}/convert`, 'POST', { createContact: true, createDeal: false });
    expect(converted.status, JSON.stringify(converted.body)).toBe(200);
    expect((await db.lead.findUniqueOrThrow({ where: { id: row.id } })).contactId).toBeTruthy();
  });

  it.each(['leads', 'contacts'])('reports employee emails in %s import preview and persisted row errors', async module => {
    const input = { fileName: 'employees.csv', csvText: 'firstName,lastName,email,phone,companyName,address\nInternal,Staff,EMPLOYEE@example.test,9123456789,Company,Makati',
      mappings: { firstName: 0, lastName: 1, email: 2, phone: 3, companyName: 4, address: 5 }, idempotencyKey: randomUUID() };
    const preview = await call(`/crm/${module}/imports/preview`, 'POST', input);
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.data[0]).toMatchObject({ isValid: false, status: 'invalid' });
    expect(preview.body.data[0].errors.join(' ')).toContain(message);
    const count = await db.lead.count() + await db.contact.count();
    const imported = await call(`/crm/${module}/imports`, 'POST', input);
    expect(imported.status, JSON.stringify(imported.body)).toBe(201);
    expect(imported.body.data).toMatchObject({ status: 'failed', successfulRecords: 0, failedRecords: 1 });
    expect(await db.lead.count() + await db.contact.count()).toBe(count);
    const lateEmail = `${randomUUID()}@example.test`;
    const deferred = { ...input, csvText: input.csvText.replace('EMPLOYEE@example.test', lateEmail), idempotencyKey: randomUUID() };
    expect((await call(`/crm/${module}/imports/preview`, 'POST', deferred)).body.data[0].isValid).toBe(true);
    await db.user.create({ data: { tenantId, email: lateEmail, firstName: 'Pending', lastName: 'Employee', role: 'Custom', status: 'PENDING' } });
    const rechecked = await call(`/crm/${module}/imports`, 'POST', deferred);
    expect(rechecked.body.data).toMatchObject({ status: 'failed', successfulRecords: 0, failedRecords: 1 });
    expect(await db.lead.count() + await db.contact.count()).toBe(count);
  });

  it('rejects public Form emails and phone-matched internal customers with field-ID errors', async () => {
    const forms = await import('../../marketing/forms/forms.service');
    const form = await scope(() => forms.createForm(tenantId, adminId, { name: 'Contact Us' }));
    const published = await scope(() => forms.publishForm(form.id, tenantId, adminId));
    const before = await effects();
    const values = { firstName: 'Test', lastName: 'Visitor', email: 'EMPLOYEE@example.test', productInterest: productId, address: 'Makati' };
    const result = await call(`/public/forms/${form.publicId}/submissions`, 'POST', { requestId: randomUUID(), version: published.publishedVersion, values }, false);
    expect(result.status, JSON.stringify(result.body)).toBe(400);
    expect(result.body).toMatchObject({ error: 'Please check the highlighted fields.', fieldErrors: { email: EMAIL_AVAILABILITY_MESSAGES.STAFF_EMAIL_NOT_ALLOWED } });
    expect(await effects()).toEqual(before);
    const existing = await legacy('contact');
    await db.contact.update({ where: { id: existing.id }, data: { phone: '+639123456789' } });
    const returned = await call(`/public/forms/${form.publicId}/submissions`, 'POST', { requestId: randomUUID(), version: published.publishedVersion,
      values: { ...values, email: 'external-visitor@example.test', phone: '9123456789' } }, false);
    expect(returned.status, JSON.stringify(returned.body)).toBe(400);
    expect(returned.body).toMatchObject({ error: 'Please check the highlighted fields.', fieldErrors: { email: EMAIL_AVAILABILITY_MESSAGES.STAFF_EMAIL_NOT_ALLOWED } });
    expect(await db.formSubmission.count()).toBe(0);
  });
});
