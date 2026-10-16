import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import prisma from '../../../config/database.config';
import { issueAuthSession } from '../../../core/auth/auth-session';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { salesPipeline, salesTransaction } from '../leads/lead-automation.service';
import { CUSTOM_FIELD_BUILT_IN_GROUPS, type ClosingField, type CustomFieldModule } from '@leadcrm/shared';
import app from '../../../app';
import { fieldUpdatePatch } from '../../automation/actions/action-fields';
import { compatibleWorkflow, conditionFields } from '../../automation/workflows/workflow-fields';
import { entityContext } from '../../automation/workflows/workflows.repository';
import { resolveAudience } from '../../marketing/campaigns/audiences.service';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
describe.skipIf(url.hostname !== '127.0.0.1' || url.pathname !== '/leadcrm_custom_fields_test')('module custom fields with real SQL and authenticated HTTP', () => {
  let server: Server, base: string, tenantId: string, actorId: string, token: string;
  async function call(path: string, method = 'GET', body?: unknown, auth = token) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  async function field(module: CustomFieldModule, name: string, extra: Record<string, unknown> = {}): Promise<ClosingField> {
    const result = await call('/administration/closing-requirements', 'POST', { module, group: CUSTOM_FIELD_BUILT_IN_GROUPS[module][0], name, type: 'Text', required: false, ...extra });
    expect(result.status, JSON.stringify(result.body)).toBe(200); return result.body.data;
  }
  const person = () => ({ firstName: 'Custom', lastName: 'Tester', email: `${randomUUID()}@example.test` });
  beforeAll(async () => {
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(done => server.once('listening', done));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  });
  beforeEach(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Custom fields', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    const admin = await prisma.user.create({ data: { tenantId, firstName: 'Admin', lastName: 'Test', email: `${randomUUID()}@camxian.com`, role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    actorId = admin.id; token = (await issueAuthSession(admin)).token;
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await prisma.$disconnect(); });

  it('saves Lead numeric values atomically, reloads edits and preserves hidden/disabled history', async () => {
    const budget = await field('leads', 'Project Budget', { type: 'Number', required: true });
    const invalid = await call('/crm/leads', 'POST', person());
    expect(invalid.status).toBe(400); expect(await prisma.lead.count({ where: { tenantId } })).toBe(0);
    const created = await call('/crm/leads', 'POST', { ...person(), customFieldValues: { [budget.id]: 25000 } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.data.id;
    expect((await call(`/crm/leads/${id}/custom-fields`)).body.data.values[budget.id]).toBe(25000);
    expect((await call(`/crm/leads/${id}`, 'PUT', { customFieldValues: { [budget.id]: 30000 } })).status).toBe(200);
    expect((await call(`/administration/closing-requirements/${budget.id}`, 'PATCH', { visibleInForm: false })).status).toBe(400);
    expect((await call(`/administration/closing-requirements/${budget.id}`, 'PATCH', { required: false, visibleInForm: false })).status).toBe(200);
    expect((await call('/crm/leads', 'POST', person())).status).toBe(201);
    expect((await call(`/crm/leads/${id}`, 'PUT', { customFieldValues: {} })).status).toBe(200);
    const hidden = (await call(`/crm/leads/${id}/custom-fields`)).body.data;
    expect(hidden.values[budget.id]).toBe(30000); expect(hidden.fields.find((f: ClosingField) => f.id === budget.id).visibleInForm).toBe(false);
    await call(`/administration/closing-requirements/${budget.id}`, 'PATCH', { visibleInForm: true });
    expect((await call(`/crm/leads/${id}/custom-fields`)).body.data.values[budget.id]).toBe(30000);
    await call(`/administration/closing-requirements/${budget.id}`, 'PATCH', { active: false });
    expect((await call(`/crm/leads/${id}/custom-fields`)).body.data.values[budget.id]).toBe(30000);
    expect(await prisma.closingFieldDefinition.count({ where: { tenantId, id: budget.id } })).toBe(1);
  });
  it('serves concurrent initialized field metadata without writing the shared configuration lock', async () => {
    await field('leads', 'Display metadata');
    const lead = (await call('/crm/leads', 'POST', person())).body.data;
    const pipeline = await tenantContext.run({ tenantId }, () => salesTransaction(tx => salesPipeline(tx, tenantId)));
    const stage = await prisma.stage.findFirstOrThrow({ where: { tenantId, pipelineId: pipeline.pipeline.id, name: 'Lead' } });
    const deal = await prisma.deal.create({ data: { tenantId, title: 'Display metadata', pipelineId: pipeline.pipeline.id, stageId: stage.id } });
    await call('/crm/leads/field-layout');
    const where = { tenantId_module_key: { tenantId, module: 'custom-fields', key: 'configuration-lock' } };
    const before = await prisma.tenantPreference.findUniqueOrThrow({ where });
    const definitions = await prisma.closingFieldDefinition.findMany({ where: { tenantId }, orderBy: { id: 'asc' } });
    const paths = ['/administration/closing-requirements', '/crm/leads/custom-fields', `/crm/leads/${lead.id}/custom-fields`, '/crm/leads/field-layout', `/crm/deals/${deal.id}/closing-requirements`];
    const results = await Promise.all(Array.from({ length: 3 }, () => paths).flat().map(path => call(path)));
    for (const result of results) expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(await prisma.tenantPreference.findUniqueOrThrow({ where })).toEqual(before);
    expect(await prisma.closingFieldDefinition.findMany({ where: { tenantId }, orderBy: { id: 'asc' } })).toEqual(definitions);
  });

  it('scopes groups and definitions by module; normalizes names and rejects unsafe changes', async () => {
    const original = await field('contacts', '  Preferred Contact Time  ', { group: '  Additional Information  ' });
    const sameGroup = await field('contacts', 'Capacity', { group: 'additional information' });
    expect(sameGroup.group).toBe('Additional Information'); expect(original.name).toBe('Preferred Contact Time');
    expect((await call('/administration/closing-requirements', 'POST', { module: 'contacts', group: 'additional information', name: ' preferred contact time ', type: 'Text', required: false })).status).toBe(400);
    await field('leads', 'Preferred Contact Time', { group: 'Additional Information' });
    const list = (await call('/crm/contacts/custom-fields')).body.data as ClosingField[];
    expect(list.every(f => f.module === 'contacts')).toBe(true);
    for (const patch of [{ module: 'leads' }, { type: 'Number' }, { name: '   ' }, { group: '  ' }, { name: 'x'.repeat(101) }]) expect((await call(`/administration/closing-requirements/${original.id}`, 'PATCH', patch)).status).toBe(400);
    const created = await call('/crm/contacts', 'POST', { ...person(), requestId: randomUUID(), customFieldValues: { [original.id]: 'Morning' } });
    expect(created.status).toBe(201);
    expect((await call(`/crm/contacts/${created.body.data.id}/custom-fields`)).body.data.values[original.id]).toBe('Morning');
    expect((await call('/crm/leads', 'POST', { ...person(), customFieldValues: { [original.id]: 'Wrong module' } })).status).toBe(400);
  });

  it('persists custom Account groups and validates every supported scalar type', async () => {
    const number = await field('accounts', 'Server Count', { type: 'Number', group: 'Basic Information' });
    const date = await field('accounts', 'Inspection', { type: 'Date', group: 'Basic Information' });
    const choice = await field('accounts', 'Service', { type: 'Dropdown', options: ['Gold', 'Silver'] });
    const text = await field('accounts', 'Short text');
    const long = await field('accounts', 'Long text', { type: 'Long Text' });
    for (const [id, value] of [[number.id, '12'], [date.id, '2026-02-30'], [choice.id, 'Bronze'], [text.id, 'x'.repeat(1001)], [long.id, 'x'.repeat(10001)]]) {
      expect((await call('/crm/accounts', 'POST', { name: 'Invalid', customFieldValues: { [id]: value } })).status).toBe(400);
    }
    expect(await prisma.account.count({ where: { tenantId } })).toBe(0);
    const created = await call('/crm/accounts', 'POST', { name: 'Office', customFieldValues: { [number.id]: 8, [date.id]: '2026-10-07', [choice.id]: 'Gold', [long.id]: 'x'.repeat(1500) } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.data.id;
    expect((await call(`/administration/closing-requirements/${choice.id}`, 'PATCH', { options: ['Silver'] })).status).toBe(400);
    expect((await call(`/crm/accounts/${id}`, 'PUT', { customFieldValues: { [number.id]: 12 } })).status).toBe(200);
    const values = (await call(`/crm/accounts/${id}/custom-fields`)).body.data.values;
    expect(values[number.id]).toBe(12); expect(values[date.id]).toBe('2026-10-07');
    expect(values[choice.id]).toBe('Gold');
    expect((await call(`/crm/accounts/${id}`, 'PUT', { customFieldValues: { [choice.id]: 'Gold' } })).status).toBe(200);
    await call(`/crm/accounts/${id}/archive`, 'PATCH');
    expect((await call(`/crm/accounts/${id}/custom-fields`)).body.data.values[number.id]).toBe(12);
  });

  it('keeps Closed Won requirements separate, required even when hidden, and frozen after closing', async () => {
    const normal = await field('deals', 'Site code', { group: 'Deal Information', required: true });
    const product = await prisma.productInterest.create({ data: { tenantId, name: 'Camera', dealValue: 100 } });
    const pipeline = await tenantContext.run({ tenantId }, () => salesTransaction(tx => salesPipeline(tx, tenantId)));
    const stages = await prisma.stage.findMany({ where: { tenantId, pipelineId: pipeline.pipeline.id } });
    const leadStage = stages.find(s => s.name === 'Lead')!, qualified = stages.find(s => s.name === 'Qualified')!, won = stages.find(s => s.isWon)!;
    const input = { title: 'Installation', pipelineId: pipeline.pipeline.id, stageId: leadStage.id, productInterestIds: [product.id] };
    expect((await call('/crm/deals/batch', 'POST', { ...input, idempotencyKey: randomUUID() })).status).toBe(400);
    const created = await call('/crm/deals/batch', 'POST', { ...input, idempotencyKey: randomUUID(), customFieldValues: { [normal.id]: 'SITE-1' } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.data.deals[0].id;
    expect((await call(`/crm/deals/${id}/custom-fields`)).body.data.values[normal.id]).toBe('SITE-1');
    expect((await call(`/crm/deals/${id}/closing-requirements`)).body.data.fields.some((f: ClosingField) => f.id === normal.id)).toBe(false);
    await call('/administration/closing-requirements/reference-number', 'PATCH', { required: true, visibleInForm: false });
    await prisma.deal.update({ where: { id }, data: { stageId: qualified.id } });
    expect((await call(`/crm/deals/${id}/stage`, 'PATCH', { stageId: won.id })).status).toBe(400);
    const closed = await call(`/crm/deals/${id}/closing-requirements`, 'PATCH', { values: { 'reference-number': 'REF-1', 'confirmation-date': '2026-10-07', 'confirmation-type': 'Approved Quotation' } });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200); expect(closed.body.data.locked).toBe(true);
    const snapshot = (await prisma.deal.findUniqueOrThrow({ where: { id } })).closingSnapshot;
    expect((await call(`/crm/deals/${id}/closing-requirements`, 'PATCH', { values: { 'reference-number': 'changed' } })).status).toBe(400);
    await call('/administration/closing-requirements/reference-number', 'PATCH', { name: 'Renamed evidence', required: false });
    expect((await prisma.deal.findUniqueOrThrow({ where: { id } })).closingSnapshot).toEqual(snapshot);
    expect((await prisma.customFieldValue.findFirstOrThrow({ where: { tenantId, dealId: id, fieldId: 'reference-number' } })).value).toBe('REF-1');
  });

  it('enforces configuration permissions while CRM users can fill their module fields', async () => {
    const custom = await field('leads', 'Customer note');
    const agent = await prisma.user.create({ data: { tenantId, firstName: 'Rep', lastName: 'Test', email: `${randomUUID()}@camxian.com`, role: 'Sales Rep', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Sales Rep' } });
    await prisma.rolePermission.create({ data: { tenantId, roleId: role.id, module: 'leads', canView: true, canCreate: true, canEdit: true } });
    await prisma.userRole.create({ data: { tenantId, roleId: role.id, userId: agent.id } });
    const auth = (await issueAuthSession(agent)).token;
    expect((await call('/administration/closing-requirements', 'GET', undefined, auth)).status).toBe(403);
    for (const patch of [{ visibleInForm: false }, { active: false }, { name: 'Changed' }]) expect((await call(`/administration/closing-requirements/${custom.id}`, 'PATCH', patch, auth)).status).toBe(403);
    expect((await call('/crm/leads/custom-fields', 'GET', undefined, auth)).status).toBe(200);
    expect((await call('/crm/leads', 'POST', { ...person(), customFieldValues: { [custom.id]: 'Filled by rep' } }, auth)).status).toBe(201);
    expect((await call('/crm/accounts/custom-fields', 'GET', undefined, auth)).status).toBe(403);
    const foreign = await prisma.tenant.create({ data: { name: 'Foreign', slug: randomUUID() } });
    const record = await prisma.lead.create({ data: { tenantId: foreign.id, ...person() } });
    expect((await call(`/crm/leads/${record.id}/custom-fields`)).status).toBe(404);
  });

  it('uses secure upload validation and claims only uploader-owned module files', async () => {
    const document = await field('accounts', 'Site plan', { type: 'File Upload', required: true });
    const { createPrivateStorageFixture } = await import('../../../tests/private-storage-fixture');
    const storage = await createPrivateStorageFixture();
    try {
      const upload = async (bytes: string) => {
        const response = await fetch(`${base}/crm/accounts/custom-field-uploads?name=site.pdf&type=application/pdf`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: bytes });
        return { status: response.status, body: await response.json() };
      };
      expect((await upload('not a PDF')).status).toBe(400);
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const beforeFiles = await prisma.recordFile.count({ where: { tenantId } });
      await fs.writeFile(path.join(storage.root, 'files'), 'blocked storage directory');
      expect((await upload('%PDF-storage failure')).status).toBe(502);
      expect(await prisma.recordFile.count({ where: { tenantId } })).toBe(beforeFiles);
      await fs.rm(path.join(storage.root, 'files'));
      const pending = await upload('%PDF-test fixture'); expect(pending.status).toBe(201);
      const id = pending.body.data.id;
      expect((await prisma.recordFile.findUniqueOrThrow({ where: { id } })).pendingModule).toBe('accounts');
      const other = await prisma.user.create({ data: { tenantId, firstName: 'Other', lastName: 'Admin', email: `${randomUUID()}@camxian.com`, role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
      const otherToken = (await issueAuthSession(other)).token;
      expect((await call('/crm/accounts', 'POST', { name: 'Wrong uploader', customFieldValues: { [document.id]: id } }, otherToken)).status).toBe(400);
      expect((await prisma.recordFile.findUniqueOrThrow({ where: { id } })).pendingModule).toBe('accounts');
      const created = await call('/crm/accounts', 'POST', { name: 'File account', customFieldValues: { [document.id]: id } });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const saved = await prisma.recordFile.findUniqueOrThrow({ where: { id } });
      expect(saved.pendingModule).toBeNull(); expect(saved.accountId).toBe(created.body.data.id);
      expect((await call('/crm/accounts', 'POST', { name: 'Other record', customFieldValues: { [document.id]: id } })).status).toBe(400);
      const state = (await call(`/crm/accounts/${created.body.data.id}/custom-fields`)).body.data;
      expect(state.files[0].name).toBe('site.pdf'); expect(state.values[document.id]).toBe(id);
      const expired = await upload('%PDF-expired fixture');
      await prisma.recordFile.update({ where: { id: expired.body.data.id }, data: { uploadedAt: new Date(Date.now() - 2 * 86400000) } });
      expect((await call('/crm/accounts', 'POST', { name: 'Expired file', customFieldValues: { [document.id]: expired.body.data.id } })).status).toBe(400);
    } finally { await storage.cleanup(); }
  });

  it('attaches one pending upload to every Deal in an atomic, replayable product batch', async () => {
    const document = await field('deals', 'Site plan', { type: 'File Upload', group: 'Deal Information', required: true });
    const products = await Promise.all(['Camera', 'Recorder'].map(name => prisma.productInterest.create({ data: { tenantId, name, dealValue: 100 } })));
    const pipeline = await tenantContext.run({ tenantId }, () => salesTransaction(tx => salesPipeline(tx, tenantId)));
    const stage = await prisma.stage.findFirstOrThrow({ where: { tenantId, pipelineId: pipeline.pipeline.id, name: 'Lead' } });
    const { createPrivateStorageFixture } = await import('../../../tests/private-storage-fixture');
    const storage = await createPrivateStorageFixture();
    try {
      const upload = await fetch(`${base}/crm/deals/custom-field-uploads?name=site.pdf&type=application/pdf`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: '%PDF-batch fixture' });
      expect(upload.status).toBe(201);
      const fileId = (await upload.json()).data.id;
      const input = { title: 'Installation', pipelineId: pipeline.pipeline.id, stageId: stage.id, productInterestIds: products.map(p => p.id), idempotencyKey: randomUUID(), customFieldValues: { [document.id]: fileId } };
      const created = await call('/crm/deals/batch', 'POST', input);
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const ids = created.body.data.deals.map((deal: { id: string }) => deal.id);
      const values = await prisma.customFieldValue.findMany({ where: { tenantId, fieldId: document.id, dealId: { in: ids } } });
      expect(values).toHaveLength(2); expect(new Set(values.map(row => row.value)).size).toBe(2);
      const files = await prisma.recordFile.findMany({ where: { tenantId, dealId: { in: ids } } });
      expect(files).toHaveLength(2); expect(new Set(files.map(file => file.objectKey)).size).toBe(1);
      const replay = await call('/crm/deals/batch', 'POST', input);
      expect(replay.status).toBe(200); expect(replay.body.data.replayed).toBe(true);
      expect(await prisma.recordFile.count({ where: { tenantId } })).toBe(2);
    } finally { await storage.cleanup(); }
  });
  it('preserves legacy groups on edit but prevents creating arbitrary or mismatched groups', async () => {
    const existing = await field('contacts', 'Legacy note');
    await prisma.closingFieldDefinition.update({ where: { tenantId_id: { tenantId, id: existing.id } }, data: { definition: { ...existing, groupId: undefined, group: 'Legacy Section' } } });
    await prisma.tenantPreference.deleteMany({ where: { tenantId, module: 'contacts', key: 'field-layout' } });
    expect((await call(`/administration/closing-requirements/${existing.id}`, 'PATCH', { name: 'Renamed legacy' })).status).toBe(200);
    const list = (await call('/administration/closing-requirements')).body.data as ClosingField[];
    expect(list.find(f => f.id === existing.id)?.group).toBe('Legacy Section');
    for (const group of ['Closed Won Requirements', 'New arbitrary section']) {
      expect((await call('/administration/closing-requirements', 'POST', { module: 'contacts', group, name: 'Invalid group', type: 'Text', required: false })).status).toBe(400);
    }
  });
  it('creates tenant Accounts without consuming sales assignment rotation', async () => {
    const agents = [];
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Sales Agent' } });
    for (const module of ['accounts']) await prisma.rolePermission.create({ data: { tenantId, roleId: role.id, module, canView: true, canEdit: true } });
    for (let i = 0; i < 2; i++) {
      const agent = await prisma.user.create({ data: { tenantId, firstName: 'Agent', lastName: String(i), email: `${randomUUID()}@camxian.com`, role: 'Sales Agent', status: 'ACTIVE' } });
      await prisma.userRole.create({ data: { tenantId, userId: agent.id, roleId: role.id } });
      agents.push(agent.id);
    }
    const first = await call('/crm/accounts', 'POST', { name: 'First automatic' });
    const second = await call('/crm/accounts', 'POST', { name: 'Second automatic' });
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    for (const result of [first, second, await call(`/crm/accounts/${first.body.data.id}`)]) {
      expect(result.body.data).not.toHaveProperty('assignedUserId');
      expect(result.body.data).not.toHaveProperty('assignedUser');
    }
  });

  it('persists field sections and technical identities through rename, ordering, safe moves and independent Details hiding', async () => {
    const initial = (await call('/administration/closing-requirements/layout/leads')).body.data;
    const added = await call('/administration/closing-requirements/layout/leads', 'PATCH', { action: 'add', label: ' Project information ' });
    expect(added.status).toBe(200);
    const group = added.body.data.layout.groups.find((group: { label: string }) => group.label === 'Project information');
    const budget = await field('leads', 'Budget', { group: group.label, groupId: group.id, type: 'Number' });
    const created = await call('/crm/leads', 'POST', { ...person(), customFieldValues: { [budget.id]: 0 } });
    expect(created.status).toBe(201); const id = created.body.data.id;
    expect((await call('/administration/closing-requirements/layout/leads', 'PATCH', { action: 'rename', groupId: group.id, label: 'Site information' })).status).toBe(200);
    expect((await call('/administration/closing-requirements/layout/leads', 'PATCH', { action: 'moveGroup', groupId: group.id, direction: 'up' })).status).toBe(200);
    expect((await call(`/administration/closing-requirements/${budget.id}`, 'PATCH', { name: 'Project value', visibleInDetails: false })).status).toBe(200);
    const reloaded = (await call(`/crm/leads/${id}/custom-fields`)).body.data;
    expect(reloaded.values[budget.id]).toBe(0);
    expect(reloaded.fields.find((field: ClosingField) => field.id === budget.id)).toMatchObject({ name: 'Project value', groupId: group.id, group: 'Site information', visibleInDetails: false, visibleInForm: true });
    expect((await call('/administration/closing-requirements/layout/leads', 'PATCH', { action: 'field', technicalKey: 'email', visibleInForm: false })).status).toBe(400);
    expect((await call('/administration/closing-requirements/layout/leads', 'PATCH', { action: 'delete', groupId: group.id })).status).toBe(400);
    expect((await call('/administration/closing-requirements/layout/leads', 'PATCH', { action: 'delete', groupId: group.id, moveToGroupId: initial.layout.groups[0].id })).status).toBe(200);
    expect((await call(`/crm/leads/${id}/custom-fields`)).body.data.values[budget.id]).toBe(0);
  });

  it('requires Delete permission and blocks immutable dependencies before retirement without purging values', async () => {
    const budget = await field('leads', 'Budget', { type: 'Number' });
    const created = await call('/crm/leads', 'POST', { ...person(), customFieldValues: { [budget.id]: 1200 } });
    const workflow = await prisma.workflow.create({ data: { tenantId, name: 'Budget routing', trigger: 'lead.created', actions: [], conditions: { operator: 'AND', conditions: [{ field: `lead.customFieldValues.${budget.id}`, operator: 'greater_than', value: 100 }] } } });
    const referenced = await call(`/administration/closing-requirements/${budget.id}`, 'DELETE');
    expect(referenced.status).toBe(400); expect(referenced.body.message ?? referenced.body.error).toContain('Budget routing');
    await prisma.workflow.update({ where: { id: workflow.id }, data: { conditions: { operator: 'AND', conditions: [] } } });
    const template = await prisma.template.create({ data: { tenantId, name: 'Budget email', type: 'Email', content: `Budget: {{ \n customFieldValues.${budget.id}\t }}` } });
    expect((await call(`/administration/closing-requirements/${budget.id}`, 'DELETE')).status).toBe(400);
    await prisma.template.update({ where: { id: template.id }, data: { content: 'Repaired content' } });
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Field editor' } });
    await prisma.rolePermission.create({ data: { tenantId, roleId: role.id, module: 'custom_fields', canView: true, canEdit: true } });
    const editor = await prisma.user.create({ data: { tenantId, firstName: 'Field', lastName: 'Editor', email: `${randomUUID()}@camxian.com`, role: role.name, status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    await prisma.userRole.create({ data: { tenantId, roleId: role.id, userId: editor.id } });
    const editorToken = (await issueAuthSession(editor)).token;
    expect((await call(`/administration/closing-requirements/${budget.id}`, 'DELETE', undefined, editorToken)).status).toBe(403);
    expect((await call('/administration/closing-requirements/confirmation-type', 'DELETE')).status).toBe(400);
    expect((await call(`/administration/closing-requirements/${budget.id}`, 'DELETE')).status).toBe(200);
    expect((await call('/administration/closing-requirements')).body.data.some((field: ClosingField) => field.id === budget.id)).toBe(false);
    const history = (await call(`/crm/leads/${created.body.data.id}/custom-fields`)).body.data;
    expect(history.values[budget.id]).toBe(1200); expect(history.fields.find((field: ClosingField) => field.id === budget.id).deletedAt).toBeTruthy();
    expect(await prisma.closingFieldDefinition.count({ where: { tenantId, id: budget.id } })).toBe(1);
    expect(await prisma.customFieldValue.count({ where: { tenantId, fieldId: budget.id } })).toBe(1);
  });

  it('backfills the existing Age identity idempotently and preserves its stored row through rename and reorder', async () => {
    const id = '2857e8ec-456d-4503-b955-46db45560974';
    const definition = { id, name: 'Age', type: 'Number', module: 'leads', group: 'Basic Information', groupId: 'leads:section:0', active: true, visibleInForm: true, visibleInDetails: true, required: false, options: [], description: '', order: 0, version: 7 };
    await prisma.closingFieldDefinition.create({ data: { tenantId, id, definition } });
    const record = await prisma.lead.create({ data: { tenantId, ...person() } });
    const stored = await prisma.customFieldValue.create({ data: { tenantId, fieldId: id, module: 'leads', leadId: record.id, value: 37 } });
    const first = (await call('/administration/closing-requirements/layout/leads')).body.data;
    expect(first.fields.find((field: { customFieldId: string }) => field.customFieldId === id).technicalKey).toBe('customFieldValues.age');
    const metadata = (await prisma.closingFieldDefinition.findUniqueOrThrow({ where: { tenantId_id: { tenantId, id } } })).definition;
    await call('/administration/closing-requirements/layout/leads');
    expect((await prisma.closingFieldDefinition.findUniqueOrThrow({ where: { tenantId_id: { tenantId, id } } })).definition).toEqual(metadata);
    expect((await call(`/administration/closing-requirements/${id}`, 'PATCH', { name: 'Customer Age' })).status).toBe(200);
    const layout = (await call('/administration/closing-requirements/layout/leads')).body.data;
    const keys = layout.fields.filter((field: { groupId: string }) => field.groupId === definition.groupId).map((field: { technicalKey: string }) => field.technicalKey).reverse();
    expect((await call('/administration/closing-requirements/layout/leads', 'PATCH', { action: 'reorderFields', groupId: definition.groupId, technicalKeys: keys, expectedRevision: layout.layout.revision ?? 0 })).status).toBe(200);
    expect(await prisma.customFieldValue.findUniqueOrThrow({ where: { id: stored.id } })).toEqual(stored);
    const reloaded = (await call(`/crm/leads/${record.id}/custom-fields`)).body.data;
    expect(reloaded.values[id]).toBe(37); expect(reloaded.fields.find((field: ClosingField) => field.id === id)).toMatchObject({ name: 'Customer Age', technicalAlias: 'age' });
    expect((await call(`/crm/leads/${record.id}`, 'PUT', { customFieldValues: { 'customFieldValues.age': 38 } })).status).toBe(200);
    expect((await call(`/crm/leads/${record.id}`, 'PUT', { customFieldValues: { [id]: 39 } })).status).toBe(200);
    expect((await call(`/crm/leads/${record.id}/custom-fields`)).body.data.values[id]).toBe(39);
    expect((await call(`/crm/leads/${record.id}`, 'PUT', { customFieldValues: { age: 40, [id]: 41 } })).status).toBe(400);
  });

  it('allocates distinct aliases for simultaneous creates and scopes identical aliases to their module and tenant', async () => {
    const [one, two] = await Promise.all([field('leads', 'Age!'), field('leads', 'Age?')]);
    expect(new Set([one.technicalAlias, two.technicalAlias])).toEqual(new Set(['age', 'age-2']));
    const contact = await field('contacts', 'Age'); expect(contact.technicalAlias).toBe('age');
    const created = await call('/crm/leads', 'POST', { ...person(), customFieldValues: { [contact.id]: 'Wrong module' } }); expect(created.status).toBe(400);
    const otherTenant = (await prisma.tenant.create({ data: { name: 'Other', slug: randomUUID() } })).id;
    const otherFieldId = randomUUID();
    await prisma.closingFieldDefinition.create({ data: { tenantId: otherTenant, id: otherFieldId, definition: { ...one, id: otherFieldId, technicalAlias: 'private-age' } } });
    expect((await call('/crm/leads', 'POST', { ...person(), customFieldValues: { 'customFieldValues.private-age': 'Wrong tenant' } })).status).toBe(400);
    expect((await call('/administration/closing-requirements', 'POST', { module: 'leads', group: 'Basic Information', name: 'Constructor', type: 'Text', required: false })).status).toBe(400);
  });

  it('resolves readable and legacy Workflow conditions/actions and Campaign audiences/personalization to the same values', async () => {
    const age = await field('leads', 'Age', { type: 'Number' });
    const created = await call('/crm/leads', 'POST', { ...person(), customFieldValues: { 'customFieldValues.age': 37 } }); expect(created.status).toBe(201);
    const run = <T>(fn: () => Promise<T>) => tenantContext.run({ tenantId }, fn);
    for (const key of ['customFieldValues.age', `customFieldValues.${age.id}`]) {
      expect(await run(() => fieldUpdatePatch({ type: 'update_field', config: { field: key, value: 40 } }, 'lead', tenantId))).toEqual({ customFieldValues: { [age.id]: 40 } });
      const fields = await run(() => conditionFields({ name: 'Check', trigger: 'lead.updated', conditions: { operator: 'AND', conditions: [{ field: 'lead.' + key, operator: 'equals', value: 37 }] }, actions: [] }, tenantId));
      expect(fields.some(field => field.field === 'lead.' + key)).toBe(true);
      expect((await run(() => entityContext('lead', created.body.data.id, tenantId)))?.['lead.' + key]).toBe(37);
      const audience = await run(() => resolveAudience(tenantId, { source: 'LEADS', conditions: [{ field: key, operator: 'equals', value: 37 }] }));
      expect(audience.records).toHaveLength(1); expect(audience.records[0].personalization[key]).toBe('37');
    }
    const stored = await prisma.workflow.create({ data: { tenantId, name: 'Alias editor', trigger: 'lead.updated', conditions: { operator: 'AND', conditions: [{ field: 'lead.customFieldValues.age', operator: 'equals', value: 37 }] }, actions: [{ type: 'update_field', config: { field: 'customFieldValues.age', value: 40 } }] } });
    const adapted = await run(() => compatibleWorkflow(stored, tenantId));
    expect(adapted.conditions).toMatchObject({ conditions: [{ field: `lead.customFieldValues.${age.id}` }] });
    expect(adapted.actions).toMatchObject([{ config: { field: `customFieldValues.${age.id}` } }]);
    expect((await prisma.workflow.findUniqueOrThrow({ where: { id: stored.id } })).conditions).toEqual(stored.conditions);
    await call(`/administration/closing-requirements/${age.id}`, 'PATCH', { active: false });
    await expect(run(() => fieldUpdatePatch({ type: 'update_field', config: { field: 'customFieldValues.age', value: 40 } }, 'lead', tenantId))).rejects.toThrow('editable');
  });

  it.each(['leads', 'contacts', 'accounts', 'deals'] as const)('authorizes %s inline partial updates by record permission, preserving other values and identities', async module => {
    const count = await field(module, 'Inline Count', { type: 'Number' });
    const note = await field(module, 'Inline Note');
    const reason = await field(module, 'Cancellation Reason', { type: 'Long Text', visibleInForm: false, visibleInDetails: true });
    let id: string;
    if (module === 'deals') {
      const product = await prisma.productInterest.create({ data: { tenantId, name: 'Inline product', dealValue: 100 } });
      const pipeline = await tenantContext.run({ tenantId }, () => salesTransaction(tx => salesPipeline(tx, tenantId)));
      const stage = await prisma.stage.findFirstOrThrow({ where: { tenantId, pipelineId: pipeline.pipeline.id, name: 'Lead' } });
      const created = await call('/crm/deals/batch', 'POST', { title: 'Inline Deal', pipelineId: pipeline.pipeline.id, stageId: stage.id, productInterestIds: [product.id], idempotencyKey: randomUUID(), customFieldValues: { [count.id]: 1, [note.id]: 'Keep' } });
      expect(created.status, JSON.stringify(created.body)).toBe(201); id = created.body.data.deals[0].id;
    } else {
      const created = await call(`/crm/${module}`, 'POST', { ...(module === 'accounts' ? { name: 'Inline Account' } : person()), ...(module === 'contacts' ? { requestId: randomUUID() } : {}), customFieldValues: { [count.id]: 1, [note.id]: 'Keep' } });
      expect(created.status).toBe(201); id = created.body.data.id;
    }
    const userFor = async (name: string, canEdit: boolean, configEditor: boolean) => {
      const role = await prisma.roleDefinition.create({ data: { tenantId, name } });
      const user = await prisma.user.create({ data: { tenantId, firstName: name, lastName: 'Tester', email: `${randomUUID()}@camxian.com`, role: name, status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
      await prisma.rolePermission.create({ data: { tenantId, roleId: role.id, module, canView: true, canEdit } });
      if (configEditor) await prisma.rolePermission.create({ data: { tenantId, roleId: role.id, module: 'custom_fields', canView: true, canEdit: true } });
      await prisma.userRole.create({ data: { tenantId, userId: user.id, roleId: role.id } });
      return (await issueAuthSession(user)).token;
    };
    const reader = await userFor('Configuration editor', false, true);
    expect((await call(`/crm/${module}/${id}/custom-fields`, 'GET', undefined, reader)).status).toBe(200);
    expect((await call(`/crm/${module}/${id}`, 'PUT', { customFieldValues: { [count.id]: 3 } }, reader)).status).toBe(403);
    expect((await call(`/crm/${module}/${id}`, 'PUT', { customFieldValues: { [reason.id]: 'Denied' } }, reader)).status).toBe(403);
    const editor = await userFor('Record editor', true, false);
    const savedReason = 'Customer cancelled\nNo longer needed';
    expect((await call(`/crm/${module}/${id}`, 'PUT', { customFieldValues: { [reason.id]: savedReason } }, editor)).status).toBe(200);
    const detailsOnly = (await call(`/crm/${module}/${id}/custom-fields`, 'GET', undefined, editor)).body.data;
    expect(detailsOnly.fields.find((field: ClosingField) => field.id === reason.id)).toMatchObject({ active: true, visibleInForm: false, visibleInDetails: true });
    expect(detailsOnly.values).toMatchObject({ [reason.id]: savedReason, [count.id]: 1, [note.id]: 'Keep' });
    const storedReason = await prisma.customFieldValue.findFirstOrThrow({ where: { tenantId, module, fieldId: reason.id } });
    expect(storedReason.value).toBe(savedReason);
    expect((await call(`/crm/${module}/${id}`, 'PUT', { customFieldValues: { [reason.id]: 'x'.repeat(10001) } }, editor)).status).toBe(400);
    expect((await call(`/administration/closing-requirements/${reason.id}`, 'PATCH', { visibleInDetails: false })).status).toBe(200);
    expect((await call(`/crm/${module}/${id}`, 'PUT', { customFieldValues: { [reason.id]: 'Hidden everywhere' } }, editor)).status).toBe(400);
    expect((await call(`/administration/closing-requirements/${reason.id}`, 'PATCH', { visibleInDetails: true, active: false })).status).toBe(200);
    expect((await call(`/crm/${module}/${id}`, 'PUT', { customFieldValues: { [reason.id]: 'Disabled' } }, editor)).status).toBe(400);
    expect((await call(`/administration/closing-requirements/${reason.id}`, 'DELETE')).status).toBe(200);
    expect((await call(`/crm/${module}/${id}`, 'PUT', { customFieldValues: { [reason.id]: 'Retired' } }, editor)).status).toBe(400);
    expect((await prisma.customFieldValue.findUniqueOrThrow({ where: { id: storedReason.id } })).value).toBe(savedReason);
    expect((await call(`/crm/${module}/${id}`, 'PUT', { customFieldValues: { [count.id]: 0 } }, editor)).status).toBe(200);
    let state = (await call(`/crm/${module}/${id}/custom-fields`)).body.data;
    expect(state.values[count.id]).toBe(0); expect(state.values[note.id]).toBe('Keep');
    expect((await call(`/crm/${module}/${id}`, 'PUT', { customFieldValues: { [count.id]: null } }, editor)).status).toBe(200);
    state = (await call(`/crm/${module}/${id}/custom-fields`)).body.data;
    expect(state.values[count.id]).toBeNull(); expect(state.values[note.id]).toBe('Keep');
    const column = module === 'leads' ? 'leadId' : module === 'contacts' ? 'contactId' : module === 'accounts' ? 'accountId' : 'dealId';
    expect(await prisma.customFieldValue.count({ where: { tenantId, module, fieldId: count.id, [column]: id } })).toBe(1);
    expect(state.fields.find((field: ClosingField) => field.id === count.id).technicalAlias).toBe(count.technicalAlias);
  });

  it('rejects stale layout revisions and protects group deletion with delete permission', async () => {
    expect((await call('/administration/closing-requirements', 'POST', [])).status).toBe(400);
    const initial = (await call('/administration/closing-requirements/layout/leads')).body.data.layout;
    const groupIds = [...initial.groups].reverse().map((group: { id: string }) => group.id);
    const input = { action: 'reorderGroups', groupIds, expectedRevision: initial.revision ?? 0 };
    expect((await call('/administration/closing-requirements/layout/leads', 'PATCH', input)).status).toBe(200);
    expect((await call('/administration/closing-requirements/layout/leads', 'PATCH', input)).status).toBe(409);
    expect((await call('/administration/closing-requirements', 'POST', { module: 'leads', group: 'Basic Information', name: 'Stale draft', type: 'Text', required: false, expectedRevision: initial.revision ?? 0 })).status).toBe(409);
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Layout editor' } });
    await prisma.rolePermission.create({ data: { tenantId, roleId: role.id, module: 'custom_fields', canView: true, canEdit: true } });
    const editor = await prisma.user.create({ data: { tenantId, firstName: 'Layout', lastName: 'Editor', email: `${randomUUID()}@camxian.com`, role: role.name, status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    await prisma.userRole.create({ data: { tenantId, roleId: role.id, userId: editor.id } }); const auth = (await issueAuthSession(editor)).token;
    expect((await call('/administration/closing-requirements/layout/leads', 'PATCH', { action: 'delete', groupId: initial.groups[0].id, moveToGroupId: initial.groups[1].id }, auth)).status).toBe(403);
  });
});
