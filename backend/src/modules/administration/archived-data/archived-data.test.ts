import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const model = () => ({ count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() });
  return { db: { lead: model(), contact: model(), account: model(), deal: model(), pipeline: model(), user: model(),
    task: model(), roleDefinition: model(), workflow: model(), campaign: model(), template: model(), productInterest: model(), tenantPreference: { findUnique: vi.fn() }, auditLog: { findMany: vi.fn() }, $queryRaw: vi.fn() },
    permission: vi.fn(), audit: vi.fn(), transaction: vi.fn() };
});
vi.mock('../../../config/database.config', () => ({ default: state.db }));
vi.mock('../../../core/permissions/permission.service', () => ({ assertPermissions: state.permission }));
vi.mock('../../../core/audit/audit.service', () => ({ writeAuditLog: state.audit }));
vi.mock('../../crm/leads/lead-automation.service', () => ({ salesTransaction: state.transaction }));
import { list, restore } from './archived-data.service';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { ARCHIVE_TYPES, ArchiveQuerySchema, ArchiveRestoreParamsSchema, ArchiveTypeSchema, MAX_ACTIVE_PRODUCTS, type ArchiveType } from '@leadcrm/shared';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/errors/app-error';

const actor = { userId: 'admin', tenantId: 'tenant', role: 'Client Admin' };
const scoped = <T>(work: () => T) => tenantContext.run({ tenantId: actor.tenantId }, work);
beforeEach(() => {
  vi.resetAllMocks();
  state.permission.mockResolvedValue(undefined);
  state.transaction.mockImplementation(work => work(state.db));
  state.db.tenantPreference.findUnique.mockResolvedValue(null);
  state.db.user.findFirst.mockResolvedValue({id:'admin',tenantId:'tenant',role:'Client Admin',status:'ACTIVE',tenant:{status:'ACTIVE'},userRoles:[]});
  for (const model of Object.values(state.db)) if ('count' in model) { model.count.mockResolvedValue(0); model.findMany.mockResolvedValue([]); }
  state.db.roleDefinition.count.mockResolvedValue(1);
  state.db.roleDefinition.findMany.mockResolvedValue([{ id: 'role', name: 'Archived Sales', isSystemRole: false }]);
  state.db.workflow.count.mockResolvedValue(1);
  state.db.workflow.findMany.mockResolvedValue([{ id: 'workflow', name: 'Archived Workflow' }]);
  state.db.auditLog.findMany.mockResolvedValue([{ entityId: 'workflow', action: 'workflow.archived', createdAt: new Date('2026-01-01') }]);
  state.db.$queryRaw.mockResolvedValue([{ id: 'workflow', type: 'Workflow', name: 'Archived Workflow', detail: '', archivedAt: new Date('2026-01-01') }]);
});

it('excludes deleted roles from All totals and name ordering while preserving supported records', async () => {
  const result = await scoped(() => list(actor, ArchiveQuerySchema.parse({ sortBy: 'name' })));
  expect(result.data).toEqual([{ id: 'workflow', type: 'Workflow', name: 'Archived Workflow', detail: '', canRestore: true, archivedAt: '2026-01-01T00:00:00.000Z' }]);
  expect(result.meta.total).toBe(1);
  expect(state.db.roleDefinition.count).not.toHaveBeenCalled();
  expect(state.db.roleDefinition.findMany).not.toHaveBeenCalled();
});

it('scopes supported search and permission checks to the active workspace', async () => {
  await scoped(() => list(actor, ArchiveQuerySchema.parse({ type: 'Workflow', search: 'Archived Workflow' })));
  expect(state.permission).toHaveBeenCalledWith(actor, ['workflows.view']);
  expect(state.db.workflow.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant', isArchived: true,
    AND: [{ OR: [{ name: { contains: 'Archived', mode: 'insensitive' } }] }, { OR: [{ name: { contains: 'Workflow', mode: 'insensitive' } }] }] } });
});

it('hides supported records without their module permission and rejects explicit restricted filters', async () => {
  state.permission.mockImplementation(async (_actor, required) => { if (required.includes('workflows.view')) throw new AppError('Access denied', 403); });
  state.db.$queryRaw.mockResolvedValue([]);
  expect((await scoped(() => list(actor, ArchiveQuerySchema.parse({})))).data).toEqual([]);
  await expect(scoped(() => list(actor, ArchiveQuerySchema.parse({ type: 'Workflow' })))).rejects.toMatchObject({ statusCode: 403 });
  expect(state.db.roleDefinition.findMany).not.toHaveBeenCalled();
});

it('hydrates only a bounded page for the default archive date ordering', async () => {
  const result = await scoped(() => list(actor, ArchiveQuerySchema.parse({ page: 2, limit: 5 })));
  expect(result.data[0]).toMatchObject({ type: 'Workflow', archivedAt: '2026-01-01T00:00:00.000Z' });
  expect(state.db.$queryRaw).toHaveBeenCalledOnce();
  const statement = state.db.$queryRaw.mock.calls[0][0];
  expect(statement.sql).toContain('NULLS LAST');
  expect(statement.sql).toContain('LIMIT ? OFFSET ?');
  expect(statement.values.slice(-2)).toEqual([5, 5]);
  expect(statement.sql).not.toContain('RoleDefinition');
  expect(state.db.roleDefinition.findMany).not.toHaveBeenCalled();
  expect(state.db.auditLog.findMany).not.toHaveBeenCalled();
});

it('rejects Role in the shared type, query and restore contracts before any mutation', () => {
  expect(ArchiveTypeSchema.safeParse('Role').success).toBe(false);
  expect(ArchiveQuerySchema.safeParse({ type: 'Role' }).success).toBe(false);
  expect(ArchiveRestoreParamsSchema.safeParse({ type: 'Role', id: '0ff82f9c-48e9-4e1c-8c77-8a30755d704c' }).success).toBe(false);
  expect(state.db.roleDefinition.updateMany).not.toHaveBeenCalled();
});

it('rejects requests outside the authenticated tenant context', async () => {
  await expect(list(actor, ArchiveQuerySchema.parse({}))).rejects.toMatchObject({ statusCode: 403 });
  expect(state.db.roleDefinition.count).not.toHaveBeenCalled();
});

it('accepts Product in the shared archive type, query and restore contracts', () => {
  const type: ArchiveType = 'Product';
  expect(ARCHIVE_TYPES).toEqual(['Lead', 'Contact', 'Account', 'Deal', 'Product', 'User', 'Task', 'Campaign', 'Workflow']);
  expect(ArchiveTypeSchema.parse(type)).toBe(type);
  expect(ArchiveQuerySchema.parse({ type })).toMatchObject({ type });
  expect(ArchiveRestoreParamsSchema.parse({ type, id: '0ff82f9c-48e9-4e1c-8c77-8a30755d704c' })).toMatchObject({ type });
  expect(ArchiveQuerySchema.safeParse({ type, search: 'x'.repeat(201) }).success).toBe(false);
  expect(ArchiveRestoreParamsSchema.safeParse({ type, id: 'invalid' }).success).toBe(false);
});

const archivedProduct = { id: 'product', name: 'CCTV Surveillance System', dealValue: new Prisma.Decimal('5000.25'), updatedAt: new Date('2026-02-01') };

it('adds tenant-scoped inactive Products to All totals and global name pagination', async () => {
  state.db.productInterest.count.mockResolvedValue(1);
  state.db.productInterest.findMany.mockResolvedValue([archivedProduct]);
  const result = await scoped(() => list(actor, ArchiveQuerySchema.parse({ sortBy: 'name', sortOrder: 'asc', limit: 1, page: 2 })));
  expect(result.meta).toMatchObject({ total: 2, page: 2, hasMore: false });
  expect(result.data).toEqual([{ type: 'Product', id: 'product', name: archivedProduct.name, detail: '₱5,000.25', archivedAt: '2026-02-01T00:00:00.000Z', canRestore: true }]);
  expect(state.db.productInterest.findMany).toHaveBeenCalledWith({ where: { tenantId: actor.tenantId, active: false }, skip: 0, take: 500, orderBy: { id: 'asc' }, select: { id: true, name: true, dealValue: true, updatedAt: true } });
});

it('uses the same PHP details and updatedAt timestamp in the date-sorted Product query', async () => {
  state.db.productInterest.count.mockResolvedValue(1);
  state.db.$queryRaw.mockResolvedValue([{ type: 'Product', ...archivedProduct, detail: '5000.25', archivedAt: archivedProduct.updatedAt, isSystemRole: false }]);
  const result = await scoped(() => list(actor, ArchiveQuerySchema.parse({ type: 'Product', search: 'cctv 100%_match' })));
  expect(result.data[0]).toMatchObject({ type: 'Product', detail: '₱5,000.25', archivedAt: archivedProduct.updatedAt.toISOString() });
  expect(state.db.productInterest.count).toHaveBeenCalledWith({ where: { tenantId: actor.tenantId, active: false, AND: [{ OR: [{ name: { contains: 'cctv', mode: 'insensitive' } }] }, { OR: [{ name: { contains: '100\\%\\_match', mode: 'insensitive' } }] }] } });
  const statement = state.db.$queryRaw.mock.calls[0][0];
  expect(statement.sql).toContain('FROM "ProductInterest" r');
  expect(statement.sql).toContain('r."active" = false');
  expect(statement.sql).toContain('r."updatedAt" AS "archivedAt"');
  expect(statement.sql).not.toContain('isArchived');
  expect(statement.sql).not.toContain('100%_match');
  expect(statement.values).toContain('%100\\%\\_match%');
  expect(state.db.auditLog.findMany).not.toHaveBeenCalled();
});

it('filters Product from All without products.view and denies the explicit Product filter', async () => {
  state.permission.mockImplementation(async (_actor, required) => { if (required.includes('products.view')) throw new AppError('Access denied', 403); });
  await scoped(() => list(actor, ArchiveQuerySchema.parse({})));
  await expect(scoped(() => list(actor, ArchiveQuerySchema.parse({ type: 'Product' })))).rejects.toMatchObject({ statusCode: 403 });
  expect(state.db.productInterest.count).not.toHaveBeenCalled();
});

function restorableProduct() {
  state.db.productInterest.findFirst.mockResolvedValueOnce(archivedProduct).mockResolvedValueOnce(null);
  state.db.productInterest.updateMany.mockResolvedValue({ count: 1 });
}

it('restores only active=false in the current tenant, rechecks RBAC in the transaction and audits the active transition', async () => {
  restorableProduct();
  await scoped(() => restore(actor, { type: 'Product', id: archivedProduct.id }));
  expect(state.permission).toHaveBeenCalledWith(actor, ['archived_data.restore', 'products.view'], state.db);
  expect(state.db.productInterest.findFirst).toHaveBeenNthCalledWith(2, { where: { tenantId: actor.tenantId, active: true, name: { equals: archivedProduct.name, mode: 'insensitive' } }, select: { id: true } });
  expect(state.db.productInterest.updateMany).toHaveBeenCalledWith({ where: { id: archivedProduct.id, tenantId: actor.tenantId, active: false }, data: { active: true } });
  expect(state.audit).toHaveBeenCalledExactlyOnceWith({ tenantId: actor.tenantId, userId: actor.userId, action: 'product.restored', entityType: 'Product', entityId: archivedProduct.id, before: { active: false }, after: { active: true } });
});

it('returns the archive 404 for missing, foreign or already-restored Products', async () => {
  state.db.productInterest.findFirst.mockResolvedValue(null);
  await expect(scoped(() => restore(actor, { type: 'Product', id: 'foreign' }))).rejects.toMatchObject({ statusCode: 404 });
  expect(state.db.productInterest.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', tenantId: actor.tenantId, active: false }, select: { id: true, name: true } });
  expect(state.db.productInterest.updateMany).not.toHaveBeenCalled();
  expect(state.audit).not.toHaveBeenCalled();
});

it.each(['archived_data.restore', 'products.view'])('rejects Product restore without %s', async permission => {
  state.permission.mockImplementation(async (_actor, required) => { if (required.includes(permission)) throw new AppError('Access denied', 403); });
  await expect(scoped(() => restore(actor, { type: 'Product', id: 'product' }))).rejects.toMatchObject({ statusCode: 403 });
  expect(state.transaction).not.toHaveBeenCalled();
});

it('returns a clear 409 for an active duplicate and leaves the archived Product untouched', async () => {
  state.db.productInterest.findFirst.mockResolvedValueOnce(archivedProduct).mockResolvedValueOnce({ id: 'duplicate' });
  await expect(scoped(() => restore(actor, { type: 'Product', id: 'product' }))).rejects.toMatchObject({ statusCode: 409, message: 'An active product with this name already exists.' });
  expect(state.db.productInterest.updateMany).not.toHaveBeenCalled();
  expect(state.audit).not.toHaveBeenCalled();
});

it('treats percent, underscore and backslash literally in the duplicate-name check', async () => {
  state.db.productInterest.findFirst.mockResolvedValueOnce({ ...archivedProduct, name: 'CCTV 100%_\\kit' }).mockResolvedValueOnce(null);
  state.db.productInterest.updateMany.mockResolvedValue({ count: 1 });
  await scoped(() => restore(actor, { type: 'Product', id: 'product' }));
  expect(state.db.productInterest.findFirst).toHaveBeenNthCalledWith(2, { where: { tenantId: actor.tenantId, active: true, name: { equals: 'CCTV 100\\%\\_\\\\kit', mode: 'insensitive' } }, select: { id: true } });
});

it('translates a competing Product unique-index violation after transaction rollback', async () => {
  state.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Duplicate', { code: 'P2002', clientVersion: '5.22.0', meta: { modelName: 'ProductInterest', target: 'ProductInterest_active_name_key' } }));
  await expect(scoped(() => restore(actor, { type: 'Product', id: 'product' }))).rejects.toMatchObject({ statusCode: 409, message: 'An active product with this name already exists.' });
});

it('requires the Product Interest field to be enabled without changing its preference', async () => {
  restorableProduct(); state.db.tenantPreference.findUnique.mockResolvedValue({ value: false });
  await expect(scoped(() => restore(actor, { type: 'Product', id: 'product' }))).rejects.toMatchObject({ statusCode: 409, message: 'Enable Product Interest before restoring products.' });
  expect(state.db.productInterest.updateMany).not.toHaveBeenCalled();
});

it.each([MAX_ACTIVE_PRODUCTS - 1, MAX_ACTIVE_PRODUCTS])('enforces the shared active Product limit with %s active records', async count => {
  restorableProduct(); state.db.productInterest.count.mockResolvedValue(count);
  const promise = scoped(() => restore(actor, { type: 'Product', id: 'product' }));
  if (count === MAX_ACTIVE_PRODUCTS) {
    await expect(promise).rejects.toMatchObject({ statusCode: 400, message: 'Maximum 100 products.' });
    expect(state.db.productInterest.updateMany).not.toHaveBeenCalled();
  } else await promise;
});
