import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, type PrismaClient } from '@prisma/client';
import { EMPTY_PERMISSION_FLAGS, hasModulePermission, isWorkspaceAccessible, type CrmRecordAccessPolicy, type ResolvedPermissions } from '@leadcrm/shared';
import { AppError } from '../../../shared/errors/app-error';

export type CrmModule = 'leads' | 'contacts' | 'accounts' | 'deals';
type Actor = { userId: string; tenantId: string };
type Tx = Prisma.TransactionClient;
type Args = Record<string, any>;
const modules: Record<string, CrmModule> = { Lead: 'leads', Contact: 'contacts', Account: 'accounts', Deal: 'deals' };
const tables = { leads: 'Lead', contacts: 'Contact', accounts: 'Account', deals: 'Deal' } as const;
const labels = { leads: 'Leads', contacts: 'Contacts', accounts: 'Accounts', deals: 'Deals' };
// These are the repository's current Sales templates and legacy role identifiers.
// Membership is read from tenant-scoped roles, never supplied by the browser.
const salesNames = new Set(['sales', 'salesrep', 'salesrepresentative', 'salesagent', 'salesstaff', 'salesmanager']);
export const isSalesRoleName = (name: string) => salesNames.has(name.trim().toLowerCase().replace(/[\s_-]/g, ''));
export const crmActor = new AsyncLocalStorage<Actor>();
const transaction = new AsyncLocalStorage<{ tx: Tx; created: Set<string> }>();
const internal = new AsyncLocalStorage<boolean>();
const creationAssignment = new AsyncLocalStorage<{ tx: Tx; module: CrmModule; assignedUserId: string | null }>();
/** Only repositories enter this scope after validating explicit input and selecting
 * the automatic assignee. It authorizes that one create, never an existing row. */
export async function runCrmAutomaticCreation<T>(tx: Tx, module: CrmModule, assignedUserId: string | null, work: () => Promise<T>): Promise<T> {
  return creationAssignment.run({ tx, module, assignedUserId }, async () => await work());
}
export const isCrmAccessQuery = () => internal.getStore() === true;
export function isCrmTransactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' ||
    error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code)));
}

/** Separate server authority, only entered after the saved Workflow's grants are validated. */
const system = new AsyncLocalStorage<{ tenantId: string; provenance: string }>();
export function runAuthorizedWorkflow<T>(tenantId: string, executionId: string, work: () => T): T {
  return system.run({ tenantId, provenance: `workflow:${executionId}` }, work);
}
export const authorizedWorkflowScope = (tenantId: string) => system.getStore()?.tenantId === tenantId ? system.getStore() : undefined;

export async function resolveCrmActor(db: Tx, actor: Actor): Promise<CrmRecordAccessPolicy & { permissions: ResolvedPermissions }> {
  const user = await db.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId }, include: {
    tenant: { select: { status: true } }, userRoles: { where: { tenantId: actor.tenantId, role: { tenantId: actor.tenantId, isArchived: false } },
      include: { role: { include: { permissions: { where: { tenantId: actor.tenantId } } } } } },
  } });
  if (!user || user.status !== 'ACTIVE' || !isWorkspaceAccessible(user.tenant.status) || user.role.trim().toLowerCase() === 'guest') {
    throw new AppError('Account or workspace access is unavailable.', 403);
  }
  // User.role is the protected administrative identity. Ordinary role grants do
  // not promote an employee to Client Admin, including an extra admin-named role.
  const clientAdmin = user.role === 'Client Admin';
  const permissions: ResolvedPermissions = {};
  for (const link of user.userRoles) for (const row of link.role.permissions) {
    const flags = permissions[row.module] ??= { ...EMPTY_PERMISSION_FLAGS };
    for (const key of Object.keys(EMPTY_PERMISSION_FLAGS) as Array<keyof typeof flags>) flags[key] ||= row[key];
  }
  return { userId: user.id, tenantId: user.tenantId, clientAdmin, permissions,
    assignmentRestricted: !clientAdmin && (isSalesRoleName(user.role) || user.userRoles.some(link => link.role.crmAssignmentRestricted || isSalesRoleName(link.role.name))) };
}

function deny(module: CrmModule): never {
  throw new AppError(`You can only edit ${labels[module]} assigned to you.`, 403, 'CRM_ASSIGNMENT_REQUIRED');
}

/** Locks and rechecks the canonical row in the mutation's transaction. Reads use no ownership predicate. */
export async function assertCrmRecordMutation(tx: Tx, module: CrmModule, id: string,
  operation: 'edit' | 'archive' | 'restore' = 'edit', data: Args = {}): Promise<void> {
  const actor = crmActor.getStore();
  if (!actor) return; // autonomous services retain their existing explicit tenant/business policies
  const authority = system.getStore();
  if (authority && authority.tenantId !== actor.tenantId) throw new AppError('Record not found.', 404);
  // This is the only permitted internal raw SQL; table names are fixed and IDs are parameters.
  // Prisma queries are lazy: await inside this context so the allow-list stays
  // active when middleware executes the lock statement.
  await internal.run(true, async () => await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${Prisma.raw('"' + tables[module] + '"')} WHERE "tenantId" = ${actor.tenantId} AND "id" = ${id} FOR UPDATE`));
  const model = tables[module][0].toLowerCase() + tables[module].slice(1);
  const record = await (tx as any)[model].findFirst({ where: { id, tenantId: actor.tenantId }, select: { id: true, assignedUserId: true } });
  if (!record) throw new AppError('Record not found.', 404);
  if (authority) return; // validated saved automation, scoped to its tenant and audited by its execution
  const policy = await resolveCrmActor(tx, actor);
  const initializing = transaction.getStore()?.created.has(`${module}:${id}`);
  if (initializing) return; // creation's validated initialization, including automatic Deal creation
  if (!policy.clientAdmin && !hasModulePermission(policy.permissions, operation === 'restore' ? 'archived_data' : module,
    operation === 'restore' ? 'canRestore' : operation === 'archive' ? 'canArchive' : initializing ? 'canCreate' : 'canEdit')) {
    throw new AppError('Access denied', 403);
  }
  if (operation === 'restore' && !policy.clientAdmin && !hasModulePermission(policy.permissions, module, 'canView')) throw new AppError('Access denied', 403);
  if (policy.assignmentRestricted && !initializing) {
    if (record.assignedUserId !== actor.userId) deny(module);
    const assignment = data.assignedUserId;
    if ((assignment !== undefined && (typeof assignment === 'object' ? assignment?.set : assignment) !== record.assignedUserId) || data.assignedUser) {
      throw new AppError('Sales users cannot reassign CRM records.', 403, 'CRM_REASSIGNMENT_DENIED');
    }
  }
  if (data.assignedUserId !== undefined && data.assignedUserId !== record.assignedUserId && data.assignedUserId !== null && data.assignedUserId !== '') {
    const targetId = typeof data.assignedUserId === 'object' ? data.assignedUserId.set : data.assignedUserId;
    const target = await resolveCrmActor(tx, { tenantId: actor.tenantId, userId: targetId });
    if (target.clientAdmin || !hasModulePermission(target.permissions, module, 'canEdit')) throw new AppError('Choose an active eligible agent in this workspace.', 400);
  }
}

export async function assertCrmCreateAssignment(db: Tx, tenantId: string, assignedUserId?: unknown): Promise<void> {
  const actor = crmActor.getStore();
  if (!actor || system.getStore() || assignedUserId == null || assignedUserId === '') return;
  if (actor.tenantId !== tenantId) throw new AppError('Record not found.', 404);
  const policy = await resolveCrmActor(db, actor);
  if (policy.assignmentRestricted && assignedUserId !== actor.userId) throw new AppError('Sales users cannot assign records to another agent.', 403, 'CRM_REASSIGNMENT_DENIED');
}

const childParents: Record<string, Array<[string, CrmModule]>> = {
  CustomFieldValue: [['leadId', 'leads'], ['contactId', 'contacts'], ['accountId', 'accounts'], ['dealId', 'deals']],
  RecordFile: [['leadId', 'leads'], ['contactId', 'contacts'], ['accountId', 'accounts'], ['dealId', 'deals']],
  LeadProductInterest: [['leadId', 'leads']], ContactProductInterest: [['contactId', 'contacts']], AccountProductInterest: [['accountId', 'accounts']],
  // Participant links belong to the Deal. Selecting a Contact/Lead reference does not edit that person.
  LeadDeal: [['dealId', 'deals']], ContactDeal: [['dealId', 'deals']], DealStageHistory: [['dealId', 'deals']],
};
const writes = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const dmmf = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name, model]));
function rejectNestedRecordWrites(model: string, data: Args): void {
  for (const field of dmmf.get(model)?.fields ?? []) {
    const value = data[field.name];
    if (field.kind !== 'object' || !value) continue;
    const parents = childParents[field.type];
    const protectedRelation = modules[field.type] || parents && (!modules[model] || !parents.some(([, parent]) => parent === modules[model]));
    if (protectedRelation && ['update', 'updateMany', 'delete', 'deleteMany', 'upsert', 'connectOrCreate', 'create', 'createMany'].some(key => key in value)) {
      throw new AppError('Change CRM records through their CRM endpoints.', 403);
    }
    // Connecting an existing protected child can move it from an unauthorized
    // parent. Same-parent nested creation/replacement remains supported.
    if (parents && ['connect', 'set', 'disconnect', 'connectOrCreate'].some(key => key in value)) {
      throw new AppError('Change CRM relationships through their CRM endpoints.', 403);
    }
    for (const operation of ['create', 'update', 'upsert', 'connectOrCreate', 'createMany', 'updateMany']) {
      for (const entry of [value[operation]].filter(Boolean).flat()) {
        if (operation === 'upsert' || operation === 'connectOrCreate') {
          rejectNestedRecordWrites(field.type, entry.create ?? {});
          rejectNestedRecordWrites(field.type, entry.update ?? {});
        } else for (const nested of [entry.data ?? entry].flat()) rejectNestedRecordWrites(field.type, nested);
      }
    }
  }
}

/** Covers auxiliary/legacy entry points at the same database boundary as tenant scoping.
 * Single writes get a transaction; multi-record services retain their existing atomic transaction. */
export function installCrmRecordAccess(prisma: PrismaClient): void {
  const rawTransaction = prisma.$transaction.bind(prisma);
  prisma.$transaction = ((work: any, options?: any) => {
    if (typeof work !== 'function') return rawTransaction(work, options);
    return rawTransaction(tx => transaction.run({ tx, created: new Set() }, async () => await work(tx)), options);
  }) as typeof prisma.$transaction;
  prisma.$use(async (params, next) => {
    if (!crmActor.getStore() || internal.getStore() || !params.model || !writes.has(params.action)) return next(params);
    const module = modules[params.model], parents = childParents[params.model];
    const args = params.args ?? {};
    for (const data of [args.data, args.create, args.update].filter(Boolean).flat()) rejectNestedRecordWrites(params.model, data);
    if (!module && !parents) return next(params);
    const context = transaction.getStore();
    if (!context) {
      if (params.runInTransaction) throw new AppError('CRM mutations require an interactive transaction.', 403);
      for (let attempt = 0; ; attempt++) {
        try { return await prisma.$transaction(tx => (tx as any)[params.model![0].toLowerCase() + params.model!.slice(1)][params.action](args), { isolationLevel: 'Serializable', timeout: 20000 }); }
        catch (error) { if (!isCrmTransactionConflict(error) || attempt >= 4) throw error; }
      }
    }
    const { tx } = context;
    const delegate = (tx as any)[params.model[0].toLowerCase() + params.model.slice(1)];
    const where = { ...args.where, tenantId: crmActor.getStore()!.tenantId };
    // Composite unique selectors need findUnique; findMany accepts ordinary predicates.
    const singular = ['update', 'delete', 'upsert'].includes(params.action);
    const rows = ['create', 'createMany'].includes(params.action) ? [] : singular
      ? [await delegate.findUnique({ where })].filter(Boolean) : await delegate.findMany({ where });
    if (module && (['create', 'createMany'].includes(params.action) || params.action === 'upsert' && !rows.length) && !system.getStore()) {
      await resolveCrmActor(tx, crmActor.getStore()!);
      const automatic = creationAssignment.getStore();
      for (const data of [params.action === 'upsert' ? args.create : args.data].filter(Boolean).flat()) {
        const assignee = data.assignedUserId ?? data.assignedUser?.connect?.id ?? null;
        if (automatic?.tx !== tx || automatic.module !== module || automatic.assignedUserId !== assignee) {
          await assertCrmCreateAssignment(tx, crmActor.getStore()!.tenantId, assignee);
        }
      }
    }
    if (module && singular && !rows.length && params.action !== 'upsert') throw new AppError('Record not found.', 404);
    for (const row of rows) {
      if (module) {
        const data = args.data ?? args.update ?? {};
        const archived = typeof data.isArchived === 'object' ? data.isArchived?.set : data.isArchived;
        const operation = archived === true ? 'archive' : archived === false && row.isArchived ? 'restore' : 'edit';
        await assertCrmRecordMutation(tx, module, row.id, operation, data);
      } else for (const [key, parent] of parents!) if (row[key]) await assertCrmRecordMutation(tx, parent, row[key]);
    }
    if (parents) for (const data of [args.data, args.create, args.update].filter(Boolean).flat()) {
      for (const [key, parent] of parents) if (data[key]) await assertCrmRecordMutation(tx, parent, data[key]);
    }
    const result = await next(params);
    if (module && ['create', 'upsert'].includes(params.action) && !rows.length && result?.id) context.created.add(`${module}:${result.id}`);
    return result;
  });
}
