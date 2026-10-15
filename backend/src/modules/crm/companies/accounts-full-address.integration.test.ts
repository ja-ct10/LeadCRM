import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { consolidateAccountAddress } from './account-address';
import prisma from '../../../config/database.config';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { createCompany, findAllCompanies, findCompanyById, updateCompany } from './companies.repository';
import { CreateCompanySchema, UpdateCompanySchema } from './companies.dto';
import { createImportRow, type ResolvedRow } from '../imports/import-rows.service';
import { crmActor } from '../access/crm-record-access.service';

it.each([
  [{ address: '123 Street', city: 'Makati', province: 'Metro Manila', country: 'Philippines' }, '123 Street, Makati, Metro Manila, Philippines'],
  [{ address: '123 Street\nMakati; Metro  Manila, PHILIPPINES', city: ' makati ', province: 'Metro Manila', country: 'Philippines' }, '123 Street\nMakati; Metro  Manila, PHILIPPINES'],
  [{ address: null, country: 'Philippines' }, null],
  [{ address: '', country: 'Philippines' }, ''],
  [{ province: 'Laguna' }, 'Laguna'],
  [{ city: 'Manila', province: 'Manila' }, 'Manila'],
  [{ address: 'Manilaville Road', city: 'Manila' }, 'Manilaville Road, Manila'],
  [{ address: '42 Queen Street\nToronto, Ontario, Canada', country: 'Philippines' }, '42 Queen Street\nToronto, Ontario, Canada'],
])('consolidates without losing or duplicating text: %j', (fields, expected) => {
  expect(consolidateAccountAddress(fields)).toBe(expected);
  expect(consolidateAccountAddress({ ...fields, address: expected })).toBe(expected);
});

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = url.hostname === '127.0.0.1' && /^\/leadcrm_accounts_full_address_\d+$/.test(url.pathname);
describe.skipIf(!disposable).sequential('Accounts on isolated native PostgreSQL', () => {
  let tenantId: string, userId: string, accountId: string;
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, () => crmActor.run({ tenantId, userId }, work));
  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Address persistence', slug: randomUUID() } });
    tenantId = tenant.id;
    const user = await prisma.user.create({ data: { tenantId, email: `${randomUUID()}@example.test`, firstName: 'Assigned', lastName: 'Agent', role: 'Sales' } });
    userId = user.id;
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Sales', crmAssignmentRestricted: true } });
    for (const module of ['accounts', 'contacts']) await prisma.rolePermission.create({ data: { tenantId, roleId: role.id, module, canView: true, canCreate: true, canEdit: true } });
    await prisma.userRole.create({ data: { tenantId, userId, roleId: role.id } });
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('creates and reads a multiline full address without retired Account fields', async () => {
    const account = await scope(() => createCompany(tenantId, CreateCompanySchema.parse({ name: 'Full Address Account', address: '123 Street\nMakati, Metro Manila, Philippines' }), userId));
    accountId = account.id;
    const stored = await scope(() => findCompanyById(account.id, tenantId));
    expect(stored).toMatchObject({ address: '123 Street\nMakati, Metro Manila, Philippines', notes: null });
  });

  it('keeps historical Notes, legacy fields, and Account relationships during editing', async () => {
    await scope(() => updateCompany(accountId, tenantId, UpdateCompanySchema.parse({ notes: 'Public notes' }), userId));
    await scope(() => prisma.contact.create({ data: { tenantId, firstName: 'Linked', lastName: 'Contact', accountId, assignedUserId: userId } }));
    const edited = await scope(() => updateCompany(accountId, tenantId, { address: '42 Street\nParis, France' }, userId));
    expect(edited).toMatchObject({ address: '42 Street\nParis, France', notes: 'Public notes' });
    for (const field of ['city', 'province', 'country']) expect(edited).not.toHaveProperty(field);
    expect(await scope(() => prisma.contact.count({ where: { tenantId, accountId } }))).toBe(1);
  });

  it('imports split and complete addresses through the existing Account import handler', async () => {
    const data = { name: 'Legacy CSV Account', address: '10 Street', city: 'Toronto', province: 'Ontario', country: 'Canada' };
    const row = { rowNumber: 2, data, products: [] } as unknown as ResolvedRow;
    const id = await scope(() => prisma.$transaction(tx => createImportRow(tx, 'accounts', tenantId, userId, 'test-import', row)));
    expect(await scope(() => findCompanyById(id, tenantId))).toMatchObject({ address: '10 Street, Toronto, Ontario, Canada' });
    const full = { ...row, rowNumber: 3, data: { name: 'Full CSV Account', address: '20 Street\nMakati, Philippines' } };
    const fullId = await scope(() => prisma.$transaction(tx => createImportRow(tx, 'accounts', tenantId, userId, 'test-import', full)));
    expect((await scope(() => findCompanyById(fullId, tenantId)))?.address).toBe('20 Street\nMakati, Philippines');
  });

  it('sorts Full Address in both directions before pagination and filters/searches its text', async () => {
    const asc = await scope(() => findAllCompanies(tenantId, { sort: 'address:asc', limit: 1, page: 1 }));
    const desc = await scope(() => findAllCompanies(tenantId, { sort: 'address:desc', limit: 1, page: 1 }));
    expect(asc.data[0].address).toBe('10 Street, Toronto, Ontario, Canada');
    expect(desc.data[0].id).toBe(accountId);
    expect((await scope(() => findAllCompanies(tenantId, { search: '42 Street' }))).data.map(row => row.id)).toEqual([accountId]);
    expect((await scope(() => findAllCompanies(tenantId, { 'filter[address]': 'contains:Toronto' }))).data).toHaveLength(1);
    expect(await scope(() => findCompanyById('case-1', tenantId))).toBeNull();
  });
});
