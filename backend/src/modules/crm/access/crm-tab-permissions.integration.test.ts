import { afterAll, beforeAll, expect, it, describe } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { EMPTY_PERMISSION_FLAGS, PERMISSION_ACTIONS, PERMISSION_MODULES } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import app from '../../../app';
import { issueAuthSession } from '../../../core/auth/auth-session';
import { UpdateRoleSchema } from '../../administration/roles/roles.dto';
import { updateRoleAndPermissions } from '../../administration/roles/roles.repository';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/leadcrm_forms_test_2';
describe.skipIf(!disposable)('CRM tab grants with real authenticated HTTP requests', () => {
  let server: Server, base: string, tenantId: string, foreignTenant: string;
  let user: any, other: any, admin: any, pipeline: any, stage: any;
  const rows: Record<string, Record<string, any>> = {};
  const delegates = { leads: 'lead', contacts: 'contact', accounts: 'account', deals: 'deal' } as const;
  const db = prisma as any;
  async function person(name: string, administrator = false) {
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: administrator ? 'Client Admin' : name,
      isSystemRole: administrator, permissions: { create: [...Object.keys(delegates), 'archived_data'].map(module => ({ module, ...EMPTY_PERMISSION_FLAGS,
        ...Object.fromEntries(PERMISSION_MODULES.find(m => m.key === module)!.actions.map(action => [action, true])) })) } } });
    const record = await prisma.user.create({ data: { tenantId, role: role.name, firstName: name, lastName: 'Tabs', email: `${name.toLowerCase()}@camxian.com`,
      mustChangePassword: false, onboardingCompletedAt: new Date(), userRoles: { create: { roleId: role.id } } } });
    return { ...record, roleId: role.id, token: (await issueAuthSession(record)).token };
  }
  async function grants(module: string, all: boolean, my = false, active = false, actor = user) {
    await prisma.rolePermission.update({ where: { roleId_module: { roleId: actor.roleId, module } }, data: { canViewAll: all, canViewMy: my, canViewActive: active } });
  }
  async function call(path: string, actor = user, method = 'GET', body?: unknown) {
    const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    return { status: response.status, body: text.startsWith('{') ? JSON.parse(text) : text };
  }
  const ids = (result: any) => result.body.data.map((row: any) => row.id);
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'CRM Tabs', slug: `crm-tabs-${Date.now()}`, onboardingCompletedAt: new Date() } })).id;
    foreignTenant = (await prisma.tenant.create({ data: { name: 'Other Tabs', slug: `other-tabs-${Date.now()}` } })).id;
    user = await person('TabReader'); other = await person('OtherReader'); admin = await person('Administrator', true);
    pipeline = await prisma.pipeline.create({ data: { tenantId, name: 'Sales Pipeline' } });
    stage = await prisma.stage.create({ data: { tenantId, pipelineId: pipeline.id, name: 'Lead', order: 0 } });
    for (const [module, model] of Object.entries(delegates)) {
      rows[module] = {};
      for (const [kind, assignedUserId] of Object.entries({ own: user.id, cold: user.id, other: other.id, unassigned: null })) {
        rows[module][kind] = await db[model].create({ data: { tenantId,
          ...(module === 'accounts' ? { name: `${module}-${kind}` } : { assignedUserId }),
          ...(module === 'deals' ? { title: `${module}-${kind}`, pipelineId: pipeline.id, stageId: stage.id } : module === 'accounts' ? {} :
            { firstName: `${module}-${kind}`, lastName: 'Tabs', status: module === 'leads' ? kind === 'cold' ? 'Cold' : 'Hot' : kind === 'cold' ? 'COLD' : 'HOT' }),
        } });
      }
      if (module !== 'deals') rows[module].foreign = await db[model].create({ data: { tenantId: foreignTenant,
        ...(module === 'accounts' ? { name: 'foreign-record' } : { firstName: 'foreign-record', lastName: 'Tabs' }) } });
    }
    await prisma.leadDeal.create({ data: { tenantId, leadId: rows.leads.other.id, dealId: rows.deals.own.id } });
    await prisma.activity.create({ data: { tenantId, leadId: rows.leads.other.id, createdById: user.id, type: 'note', title: 'Hidden note' } });
    await prisma.recordFile.create({ data: { tenantId, leadId: rows.leads.other.id, uploadedById: user.id, name: 'hidden.txt', size: 1, type: 'text/plain', objectKey: 'fixture' } });
    rows.leads.archived = await prisma.lead.create({ data: { tenantId, firstName: 'Archived', lastName: 'Tabs', status: 'Hot', assignedUserId: user.id, isArchived: true } });
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(done => server.once('listening', done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  }, 60000);
  afterAll(async () => { if (server) await new Promise<void>(done => server.close(() => done())); await prisma.$disconnect(); });

  it.each(['leads', 'contacts'])('%s enforces every tab combination, including Active without My', async module => {
    for (let mask = 0; mask < 8; mask++) {
      const all = !!(mask & 1), my = !!(mask & 2), active = !!(mask & 4);
      await grants(module, all, my, active);
      for (const [scope, enabled] of [['all', all], ['my', my], ['active', active]] as const) {
        const result = await call(`/crm/${module}?filter[scope]=equals:${scope}&limit=100`);
        expect(result.status, `${module}/${mask}/${scope}`).toBe(enabled ? 200 : 403);
        if (!enabled) continue;
        const expected = scope === 'all' ? ['own', 'cold', 'other', 'unassigned'] : scope === 'my' ? ['own', 'cold'] : all ? ['own', 'other', 'unassigned'] : ['own'];
        expect(ids(result).sort()).toEqual(expected.map(key => rows[module][key].id).sort());
        expect(result.body.meta.total).toBe(expected.length);
      }
      const fallback = await call(`/crm/${module}?limit=100`);
      expect(fallback.status).toBe(mask ? 200 : 403);
      if (mask) expect(ids(fallback)).not.toContain(rows[module].foreign.id);
    }
  }, 60000);

  it('blocks owner/search/pagination/direct URL, nested relationship, activity and file bypasses', async () => {
    await grants('leads', false, true); await grants('deals', true, true);
    for (const suffix of [`?filter[assignedUserId]=in:${other.id}`, '?search=leads-other', '?page=2&limit=1']) {
      const result = await call(`/crm/leads${suffix}`); expect(result.status).toBe(200);
      expect(ids(result)).not.toContain(rows.leads.other.id);
    }
    for (const path of [`/leads/${rows.leads.other.id}`, `/leads/${rows.leads.foreign.id}`, `/leads/${rows.leads.other.id}/relationships`,
      `/leads/${rows.leads.other.id}/files`, `/activities?leadId=${rows.leads.other.id}`]) expect((await call(`/crm${path}`)).status).toBe(404);
    const deal = await call(`/crm/deals/${rows.deals.own.id}`); expect(deal.status).toBe(200); expect(deal.body.data.leadDeals).toEqual([]);
    expect((await call(`/crm/leads/${rows.leads.other.id}`, user, 'PUT', { firstName: 'Bypass' })).status).toBe(404);
    const csv = await call('/crm/leads/export'); expect(csv.status).toBe(200); expect(csv.body).not.toContain('leads-other');
    expect((await call('/crm/leads?filter[scope]=equals:all')).status).toBe(403);
    expect((await call('/crm/leads?filter[scope]=equals:my&scope=all')).status).toBe(400);
  });

  it('enforces My Deals on list/grouped pagination/export and Accounts All independently', async () => {
    await grants('deals', false, true); await grants('accounts', false);
    const list = await call('/crm/deals?scope=my'); expect(list.status).toBe(200);
    expect(ids(list).sort()).toEqual([rows.deals.own.id, rows.deals.cold.id].sort());
    const grouped = await call(`/crm/deals?groupByStage=true&pipelineId=${pipeline.id}&scope=my`);
    expect(grouped.status).toBe(200); expect(grouped.body.data.stages[0].total).toBe(2);
    expect((await call('/crm/deals?scope=all')).status).toBe(403);
    expect((await call('/crm/deals?scope=my&filter[scope]=equals:all')).status).toBe(400);
    expect((await call('/crm/deals/export?scope=my')).body).not.toContain('deals-other');
    expect((await call('/crm/accounts')).status).toBe(403);
    expect((await call(`/crm/accounts/${rows.accounts.own.id}`)).status).toBe(404);
    await grants('accounts', true); expect((await call('/crm/accounts')).status).toBe(200);
  });

  it('keeps Active inside live records and evicts a record after an authorized status change leaves that scope', async () => {
    await grants('leads', false, false, true);
    const archived = await call('/crm/leads?archived=true'); expect(archived.status).toBe(200); expect(ids(archived)).toEqual([]);
    const update = await call(`/crm/leads/${rows.leads.own.id}`, user, 'PUT', { status: 'Cold' });
    expect(update.status).toBe(200);
    expect((await call(`/crm/leads/${rows.leads.own.id}`)).status).toBe(404);
    await prisma.lead.update({ where: { id: rows.leads.own.id }, data: { status: 'Hot' } });
  });

  it('retains omitted legacy flags, persists explicit revocations, and rechecks grants on existing sessions', async () => {
    await grants('leads', true, true, true);
    const stored = await prisma.rolePermission.findMany({ where: { tenantId, roleId: user.roleId } });
    const permissions = stored.map(row => ({ module: row.module, ...Object.fromEntries(PERMISSION_ACTIONS.filter(key => !['canViewAll', 'canViewMy', 'canViewActive'].includes(key)).map(key => [key, row[key]])) }));
    const dto = UpdateRoleSchema.parse({ permissions });
    await updateRoleAndPermissions(user.roleId, tenantId, {}, dto.permissions);
    expect(await prisma.rolePermission.findUnique({ where: { roleId_module: { roleId: user.roleId, module: 'leads' } } })).toMatchObject({ canViewAll: true, canViewMy: true, canViewActive: true });
    await grants('leads', false, false, true);
    expect((await call('/crm/leads?scope=all')).status).toBe(403);
    expect(ids(await call('/crm/leads'))).toEqual([rows.leads.own.id]);
    expect(ids(await call('/crm/leads', other))).toContain(rows.leads.own.id);
    expect(ids(await call('/crm/leads', admin))).toContain(rows.leads.unassigned.id);
  });
});
