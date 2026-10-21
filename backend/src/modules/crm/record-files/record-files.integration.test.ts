import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import prisma from '../../../config/database.config';
import app from '../../../app';
import { issueAuthSession } from '../../../core/auth/auth-session';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { EMPTY_PERMISSION_FLAGS, CRM_FILE_FORMAT_ERROR, CRM_FILE_SIZE_ERROR, RECORD_FILE_MAX_BYTES } from '@leadcrm/shared';
import { uploadFile } from './record-files.service';
import { validFiles, zipFixture } from './__tests__/file-fixtures';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
describe.skipIf(!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/leadcrm_forms_test_2')('CRM Files with authenticated HTTP, database and private storage', () => {
  let server: Server, base: string, tenantId: string, userId: string, token: string, otherToken: string, foreignToken: string, storageRoot: string;
  const previousRoot = process.env.STORAGE_ROOT;
  const records: Record<string, string> = {};
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  beforeAll(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'leadcrm-record-files-'));
    process.env.STORAGE_ROOT = storageRoot;
    tenantId = (await prisma.tenant.create({ data: { name: 'File validation', slug: `files-${randomUUID()}`, status: 'ACTIVE' } })).id;
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Custom file editor', permissions: { create: ['leads','contacts','deals','accounts'].map(module => ({
      ...EMPTY_PERMISSION_FLAGS, module, canView: true, canViewAll: true, canEdit: true, canCreate: false,
    })) } } });
    async function user(name: string, identityTenant = tenantId, admin = false) {
      const row = await prisma.user.create({ data: { tenantId: identityTenant, role: admin ? 'Client Admin' : role.name, firstName: name, lastName: 'Files', email: `${randomUUID()}@camxian.com`,
        mustChangePassword: false, onboardingCompletedAt: new Date(), ...(!admin ? { userRoles: { create: { roleId: role.id } } } : {}) } });
      return { id: row.id, token: (await issueAuthSession(row)).token };
    }
    const actor = await user('Owner'); userId = actor.id; token = actor.token;
    otherToken = (await user('Other')).token;
    const foreign = await prisma.tenant.create({ data: { name: 'Foreign files', slug: `files-${randomUUID()}`, status: 'ACTIVE' } });
    foreignToken = (await user('Foreign', foreign.id, true)).token;
    await scope(async () => {
      const pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'File pipeline' } });
      const stage = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Lead', order: 0, requiredFields: [] } });
      records.leads = (await prisma.lead.create({ data: { tenantId, firstName: 'File', lastName: 'Lead', assignedUserId: userId } })).id;
      records.contacts = (await prisma.contact.create({ data: { tenantId, firstName: 'File', lastName: 'Contact', assignedUserId: userId } })).id;
      records.deals = (await prisma.deal.create({ data: { tenantId, title: 'File Deal', pipelineId: pipeline.id, stageId: stage.id, assignedUserId: userId } })).id;
      records.accounts = (await prisma.account.create({ data: { tenantId, name: 'File Account' } })).id;
    });
    server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (previousRoot === undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT = previousRoot;
    if (storageRoot?.startsWith(join(tmpdir(), 'leadcrm-record-files-'))) await rm(storageRoot, { recursive: true, force: true });
    await prisma.$disconnect();
  });
  async function upload(module: string, name: string, type: string, bytes: Buffer, auth = token, custom = false) {
    const params = new URLSearchParams({ name, type, ...(custom ? { recordId: records[module] } : {}) });
    const response = await fetch(`${base}/crm/${module}/${custom ? 'custom-field-uploads' : records[module] + '/files'}?${params}`, {
      method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(bytes),
    });
    return { status: response.status, body: await response.json() };
  }
  it.each(['leads','contacts','deals'])('persists all supported formats on %s and reads their original bytes after reopening', async module => {
    for (const file of validFiles()) {
      const result = await upload(module, file.name, file.type, file.bytes);
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      const saved = await scope(() => prisma.recordFile.findUniqueOrThrow({ where: { id: result.body.data.id } }));
      expect(saved).toMatchObject({ tenantId, uploadedById: userId, [`${module === 'leads' ? 'lead' : module === 'contacts' ? 'contact' : 'deal'}Id`]: records[module], type: file.type });
      const reopened = await fetch(`${base}/crm/${module}/${records[module]}/files`, { headers: { Authorization: `Bearer ${token}` } }).then(response => response.json());
      expect(reopened.data.some((row: { id: string }) => row.id === saved.id)).toBe(true);
      const download = await fetch(`${base}/crm/${module}/${records[module]}/files/${saved.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      expect(download.status).toBe(200); expect(Buffer.from(await download.arrayBuffer())).toEqual(file.bytes);
    }
  });
  it('rejects invalid uploads before rows or objects are created and accepts exactly 10 MB', async () => {
    const before = await scope(() => prisma.recordFile.count());
    const objects = await readdir(storageRoot, { recursive: true });
    expect((await upload('leads', 'image.webp', 'image/webp', Buffer.from('RIFFxxxxWEBP'))).body.error).toBe(CRM_FILE_FORMAT_ERROR);
    expect((await upload('leads', 'fake.docx', 'application/octet-stream', zipFixture({ 'x.txt': 'not Word' }))).status).toBe(400);
    expect((await upload('leads', 'fake.pdf', 'image/png', Buffer.from('%PDF-1.4'))).status).toBe(400);
    expect((await upload('leads', 'empty.txt', 'text/plain', Buffer.alloc(0))).status).toBe(400);
    for (const extension of ['txt', 'csv'])
      expect((await upload('leads', `binary.${extension}`, 'application/octet-stream', Buffer.from([0xff, 0xfe, 0xfd]))).status).toBe(400);
    const oversized = await upload('leads', 'large.txt', 'text/plain', Buffer.alloc(RECORD_FILE_MAX_BYTES + 1, 65));
    expect(oversized.status).toBe(413); expect(oversized.body.error).toBe(CRM_FILE_SIZE_ERROR);
    expect(await scope(() => prisma.recordFile.count())).toBe(before);
    expect(await readdir(storageRoot, { recursive: true })).toEqual(objects);
    expect((await upload('leads', 'maximum.txt', 'text/plain', Buffer.alloc(RECORD_FILE_MAX_BYTES, 65))).status).toBe(201);
  });
  it('retains custom-field and Account formats while enforcing edit grants, ownership and tenant scope', async () => {
    const webp = Buffer.from('RIFFxxxxWEBP');
    expect((await upload('leads', 'custom.webp', 'image/webp', webp, token, true)).status).toBe(201);
    expect((await upload('accounts', 'account.webp', 'image/webp', webp)).status).toBe(201);
    const count = await scope(() => prisma.recordFile.count());
    // Give only My access for this check, then restore the fixture's normal read scope.
    const role = await scope(() => prisma.roleDefinition.findFirstOrThrow({ where: { tenantId, name: 'Custom file editor' } }));
    await scope(() => prisma.rolePermission.updateMany({ where: { tenantId, roleId: role.id, module: 'leads' }, data: { canViewAll: false, canViewMy: true } }));
    try {
      expect((await upload('leads', 'denied.txt', 'text/plain', Buffer.from('denied'), otherToken)).status).toBe(404);
      expect((await upload('leads', 'denied.txt', 'text/plain', Buffer.from('denied'), otherToken, true)).status).toBe(404);
      const file = await scope(() => prisma.recordFile.findFirstOrThrow({ where: { tenantId, leadId: records.leads } }));
      for (const auth of [otherToken, foreignToken]) {
        for (const path of [`/crm/leads/${records.leads}/files`, `/crm/leads/${records.leads}/files/${file.id}/download`]) {
          expect((await fetch(base + path, { headers: { Authorization: `Bearer ${auth}` } })).status).toBe(404);
        }
      }
    }
    finally { await scope(() => prisma.rolePermission.updateMany({ where: { tenantId, roleId: role.id, module: 'leads' }, data: { canViewAll: true, canViewMy: false } })); }
    expect((await upload('leads', 'foreign.txt', 'text/plain', Buffer.from('denied'), foreignToken)).status).toBe(404);
    const draft = await fetch(`${base}/crm/leads/custom-field-uploads?name=draft.txt&type=text/plain`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: 'draft',
    });
    expect(draft.status).toBe(403);
    expect(await scope(() => prisma.recordFile.count())).toBe(count);
  });
  it('removes stored bytes when database persistence rolls back', async () => {
    const count = await scope(() => prisma.recordFile.count());
    const objects = await readdir(storageRoot, { recursive: true });
    await expect(scope(() => uploadFile('leads', records.leads, tenantId, randomUUID(), { name: 'rollback.txt', type: 'text/plain' }, Buffer.from('rollback')))).rejects.toBeTruthy();
    expect(await scope(() => prisma.recordFile.count())).toBe(count);
    expect(await readdir(storageRoot, { recursive: true })).toEqual(objects);
  });
});
