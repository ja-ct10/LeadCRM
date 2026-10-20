import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, type PrismaClient } from '@prisma/client';
import { hasModulePermission, isWorkspaceAccessible, isTaskAssignmentRestrictedRole, isTaskManagerRole, permittedCrmScopes, CRM_SCOPE_ACTIONS, type CrmReadScope, type CrmRecordAccessPolicy, type ResolvedPermissions } from '@leadcrm/shared';
import { resolveEffectivePermissions } from '../../administration/roles/roles.repository';
import { AppError } from '../../../shared/errors/app-error';
import { assertEligibleAssignedAgent, crmAssignmentRequirements } from './assigned-agent-eligibility';

export type CrmModule = 'leads' | 'contacts' | 'accounts' | 'deals';
type ReadPolicy = CrmRecordAccessPolicy & { permissions: ResolvedPermissions; taskAssignmentRestricted: boolean; taskManager: boolean; taskTeamUserIds?: string[] };
type Actor = { userId: string; tenantId: string; readRecords?: boolean; readPolicy?: Promise<ReadPolicy> };
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

export async function resolveCrmActor(db: Tx, actor: Actor): Promise<ReadPolicy> {
  const user = await db.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId }, include: {
    groupMemberships: { where: { tenantId: actor.tenantId }, select: { groupId: true } },
    tenant: { select: { status: true } }, userRoles: { where: { tenantId: actor.tenantId, role: { tenantId: actor.tenantId, isArchived: false } },
      include: { role: { include: { permissions: { where: { tenantId: actor.tenantId } } } } } },
  } });
  if (!user || user.status !== 'ACTIVE' || !isWorkspaceAccessible(user.tenant.status) || user.role.trim().toLowerCase() === 'guest') {
    throw new AppError('Account or workspace access is unavailable.', 403);
  }
  // User.role is the protected administrative identity. Ordinary role grants do
  // not promote an employee to Client Admin, including an extra admin-named role.
  const clientAdmin = user.role === 'Client Admin';
  const permissions = resolveEffectivePermissions(user);
  const taskManager = !clientAdmin && isTaskManagerRole(user.role);
  let taskTeamUserIds: string[] | undefined;
  if (taskManager) {
    const groupIds = (user.groupMemberships ?? []).map(member => member.groupId);
    const members = groupIds.length ? await db.user.findMany({
      where: { tenantId: user.tenantId, groupMemberships: { some: { tenantId: user.tenantId, groupId: { in: groupIds } } } },
      select: { id: true, role: true },
    }) : [];
    // Inactive historical assignees remain manageable; new assignment separately checks eligibility.
    taskTeamUserIds = [...new Set([user.id, ...members.filter(member => isTaskAssignmentRestrictedRole(member.role)).map(member => member.id)])];
  }
  return { userId: user.id, tenantId: user.tenantId, clientAdmin, permissions,
    taskAssignmentRestricted: isTaskAssignmentRestrictedRole(user.role) || taskManager, taskManager, taskTeamUserIds,
    assignmentRestricted: !clientAdmin && (isSalesRoleName(user.role) || user.userRoles.some(link => link.role.crmAssignmentRestricted || isSalesRoleName(link.role.name))) };
}

/** Shared by scoped Prisma reads and the fixed SQL archive query. */
export function taskReadWhere(policy: Pick<ReadPolicy, 'tenantId' | 'userId' | 'taskAssignmentRestricted' | 'taskTeamUserIds'>): Prisma.TaskWhereInput {
  return { tenantId: policy.tenantId, ...(policy.taskAssignmentRestricted
    ? { assignedUserId: policy.taskTeamUserIds ? { in: policy.taskTeamUserIds } : policy.userId } : {}) };
}

export function taskAssigneeInScope(policy: Pick<ReadPolicy, 'userId' | 'taskAssignmentRestricted' | 'taskTeamUserIds'>, assignedUserId: string): boolean {
  return !policy.taskAssignmentRestricted || (policy.taskTeamUserIds ?? [policy.userId]).includes(assignedUserId);
}

/** Related metadata must retain the source module's View boundary. */
export async function mayReadCrmModule(db: Tx, tenantId: string, module: CrmModule): Promise<boolean> {
  const actor = crmActor.getStore();
  if (!actor) return true;
  if (actor.tenantId !== tenantId) throw new AppError('Access denied', 403);
  if (authorizedWorkflowScope(tenantId)) return true;
  const policy = await resolveCrmActor(db, actor);
  return policy.clientAdmin || permittedCrmScopes(policy.permissions, module).length > 0;
}

function readWhere(policy: ReadPolicy, module: CrmModule, requested?: CrmReadScope): Args {
  const scopes = permittedCrmScopes(policy.permissions, module);
  const scope = requested ?? scopes[0];
  if (!policy.clientAdmin && (!scope || !hasModulePermission(policy.permissions, module, CRM_SCOPE_ACTIONS[scope]))) return { id: { in: [] } };
  return { tenantId: policy.tenantId,
    ...(scope === 'my' || scope === 'active' && !policy.clientAdmin && !scopes.includes('all') ? { assignedUserId: policy.userId } : {}),
    ...(scope === 'active' ? { isArchived: false, deletedAt: null, status: { in: module === 'leads' ? ['Inquiry', 'Hot', 'Warm', 'INQUIRY', 'HOT', 'WARM'] : ['INQUIRY', 'HOT', 'WARM'] } } : {}),
  };
}

/** A tab narrows the authorized record scope; browser owner filters never establish it. */
export async function crmReadWhere(db: Tx, tenantId: string, module: CrmModule, requested?: CrmReadScope): Promise<Args> {
  const actor = crmActor.getStore();
  if (!actor || authorizedWorkflowScope(tenantId)) return { tenantId };
  if (actor.tenantId !== tenantId) throw new AppError('Access denied', 403);
  const policy = actor.readRecords ? await (actor.readPolicy ??= resolveCrmActor(db, actor)) : await resolveCrmActor(db, actor);
  if (!policy.clientAdmin && !(requested ? permittedCrmScopes(policy.permissions, module).includes(requested) : permittedCrmScopes(policy.permissions, module).length)) {
    throw new AppError('You do not have permission to access this CRM view.', 403);
  }
  return readWhere(policy, module, requested);
}

export function requestedCrmScope(filters: Array<{ field: string; operator: string; value: unknown }>, direct?: unknown): CrmReadScope | undefined {
  const scopes = filters.filter(filter => filter.field === 'scope');
  if (scopes.length > 1 || direct !== undefined && scopes.length || scopes.some(filter => filter.operator !== 'equals')) throw new AppError('Supply one CRM scope.', 400);
  const value = direct ?? scopes[0]?.value;
  if (value !== undefined && (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(CRM_SCOPE_ACTIONS, value))) throw new AppError('Invalid CRM scope.', 400);
  return value as CrmReadScope | undefined;
}

export async function assertCrmRecordRead(db: Tx, module: CrmModule, id: string): Promise<void> {
  const actor = crmActor.getStore();
  if (!actor || authorizedWorkflowScope(actor.tenantId)) return;
  const policy = await resolveCrmActor(db, actor);
  const model = tables[module][0].toLowerCase() + tables[module].slice(1);
  if (!await (db as any)[model].findFirst({ where: { AND: [{ id, tenantId: actor.tenantId }, readWhere(policy, module)] }, select: { id: true } })) {
    throw new AppError('Record not found.', 404);
  }
}

function deny(module: CrmModule): never {
  throw new AppError(`You can only edit ${labels[module]} assigned to you.`, 403, 'CRM_ASSIGNMENT_REQUIRED');
}

/** Locks and rechecks the canonical row and current read/action grants in the mutation's transaction. */
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
  const record = await (tx as any)[model].findFirst({ where: { id, tenantId: actor.tenantId }, select: { id: true, ...(module === 'accounts' ? {} : { assignedUserId: true }) } });
  if (!record) throw new AppError('Record not found.', 404);
  if (authority) return; // validated saved automation, scoped to its tenant and audited by its execution
  const policy = await resolveCrmActor(tx, actor);
  const initializing = transaction.getStore()?.created.has(`${module}:${id}`);
  if (initializing) return; // creation's validated initialization, including automatic Deal creation
  await assertCrmRecordRead(tx, module, id);
  if (!policy.clientAdmin && !hasModulePermission(policy.permissions, operation === 'restore' ? 'archived_data' : module,
    operation === 'restore' ? 'canRestore' : operation === 'archive' ? 'canArchive' : initializing ? 'canCreate' : 'canEdit')) {
    throw new AppError('Access denied', 403);
  }
  if (operation === 'restore' && !policy.clientAdmin && !hasModulePermission(policy.permissions, module, 'canView')) throw new AppError('Access denied', 403);
  if (module !== 'accounts' && policy.assignmentRestricted && !initializing) {
    if (record.assignedUserId !== actor.userId) deny(module);
    const assignment = data.assignedUserId;
    if ((assignment !== undefined && (typeof assignment === 'object' ? assignment?.set : assignment) !== record.assignedUserId) || data.assignedUser) {
      throw new AppError('Sales users cannot reassign CRM records.', 403, 'CRM_REASSIGNMENT_DENIED');
    }
  }
  if (module !== 'accounts' && data.assignedUserId !== undefined && data.assignedUserId !== record.assignedUserId && data.assignedUserId !== null && data.assignedUserId !== '') {
    const targetId = typeof data.assignedUserId === 'object' ? data.assignedUserId.set : data.assignedUserId;
    await assertEligibleAssignedAgent(tx, actor.tenantId, targetId, crmAssignmentRequirements(module));
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
  LeadProductInterest: [['leadId', 'leads']], ContactProductInterest: [['contactId', 'contacts']],
  // Participant links belong to the Deal. Selecting a Contact/Lead reference does not edit that person.
  LeadDeal: [['dealId', 'deals']], ContactDeal: [['dealId', 'deals']], DealStageHistory: [['dealId', 'deals']],
};
const writes = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const dmmf = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name, model]));
const reads = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
const and = (where: Args | undefined, scope: Args): Args => Object.keys(scope).length ? { ...where, AND: [...(Array.isArray(where?.AND) ? where.AND : where?.AND ? [where.AND] : []), scope] } : { ...where };

function readParents(model: string) {
  return (dmmf.get(model)?.fields ?? []).filter(field => field.kind === 'object' && (modules[field.type] || field.type === 'Task') && !modules[model] && model !== 'Task' &&
    (field.isRequired && !field.isList || model === 'Activity' || childParents[model]?.some(([key]) => field.relationFromFields?.includes(key))));
}

function modelReadWhere(model: string, policy: ReadPolicy): Args {
  if (model === 'Task') return policy.taskAssignmentRestricted ? taskReadWhere(policy) : {};
  if (modules[model]) return readWhere(policy, modules[model]);
  const clauses = readParents(model).filter(field => field.type !== 'Task' || policy.taskAssignmentRestricted).map(field => {
    const parent = { [field.name]: { is: modelReadWhere(field.type, policy) } };
    if (field.isRequired) return parent;
    // Composite CRM relations share a required tenantId. Prisma's relation-null
    // filter also tests that column, hiding rows whose optional parent ID is null.
    const nullableKeys = field.relationFromFields?.filter(key => dmmf.get(model)?.fields.some(scalar => scalar.name === key && !scalar.isRequired)) ?? [];
    return { OR: [...nullableKeys.map(key => ({ [key]: null })), parent] };
  });
  return clauses.length ? { AND: clauses } : {};
}

function hasReadTarget(model: string, args: Args): boolean {
  if (model === 'Task' || modules[model] || readParents(model).length) return true;
  return (dmmf.get(model)?.fields ?? []).some(field => field.kind === 'object' &&
    [args.include?.[field.name], args.select?.[field.name], args.where?.[field.name]].some(nested => nested &&
      (modules[field.type] || hasReadTarget(field.type, nested === true ? {} : nested))));
}

/** Scope relation filters too: hidden linked records must not become search/count oracles. */
function scopeReadWhere(model: string, where: Args = {}, policy: ReadPolicy): Args {
  const result = { ...where };
  for (const key of ['AND', 'OR', 'NOT']) if (result[key]) result[key] = Array.isArray(result[key])
    ? result[key].map((entry: Args) => scopeReadWhere(model, entry, policy)) : scopeReadWhere(model, result[key], policy);
  for (const field of dmmf.get(model)?.fields ?? []) {
    if (field.kind !== 'object' || !result[field.name] || typeof result[field.name] !== 'object') continue;
    const condition = { ...result[field.name] };
    if (field.isList) {
      for (const key of ['some', 'none']) if (condition[key]) condition[key] = scopeReadWhere(field.type, condition[key], policy);
      if (condition.every) condition.every = { OR: [{ NOT: modelReadWhere(field.type, policy) }, scopeReadWhere(field.type, condition.every, policy)] };
    } else if ('is' in condition || 'isNot' in condition) {
      if (condition.is) condition.is = scopeReadWhere(field.type, condition.is, policy);
      if (condition.isNot) condition.isNot = scopeReadWhere(field.type, condition.isNot, policy);
    } else result[field.name] = scopeReadWhere(field.type, condition, policy);
    if (field.isList || 'is' in condition || 'isNot' in condition) result[field.name] = condition;
  }
  return and(result, modelReadWhere(model, policy));
}

/** Prisma does not run middleware for nested includes; keep projections/counts scoped before pagination. */
function scopeReadSelection(model: string, args: Args, policy: ReadPolicy): void {
  for (const selectionKey of ['select', 'include']) {
    if (!args[selectionKey]) continue;
    const selection = args[selectionKey] = { ...args[selectionKey] };
    for (const field of dmmf.get(model)?.fields ?? []) {
      if (field.kind !== 'object' || !selection[field.name]) continue;
      const nested = selection[field.name] === true ? {} : { ...selection[field.name] };
      // Optional to-one relations support a where filter; required relations are scoped on their parent.
      if (field.isList || !field.isRequired) nested.where = scopeReadWhere(field.type, nested.where, policy);
      scopeReadSelection(field.type, nested, policy);
      selection[field.name] = nested;
    }
    if (selection._count) {
      const counts = selection._count === true ? Object.fromEntries((dmmf.get(model)?.fields ?? []).filter(field => field.kind === 'object' && field.isList).map(field => [field.name, true])) : { ...selection._count.select };
      for (const field of dmmf.get(model)?.fields ?? []) if (field.kind === 'object' && counts[field.name]) {
        const count = counts[field.name] === true ? {} : counts[field.name];
        counts[field.name] = { ...count, where: scopeReadWhere(field.type, count.where, policy) };
      }
      selection._count = { select: counts };
    }
  }
}
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
    const actor = crmActor.getStore();
    if (!actor || internal.getStore() || !params.model) return next(params);
    if (actor.readRecords && !authorizedWorkflowScope(actor.tenantId) && reads.has(params.action) && hasReadTarget(params.model, params.args ?? {})) {
      const policy = await (actor.readPolicy ??= resolveCrmActor(transaction.getStore()?.tx ?? prisma, actor));
      params.args ??= {};
      params.args.where = scopeReadWhere(params.model, params.args.where, policy);
      scopeReadSelection(params.model, params.args, policy);
      return next(params);
    }
    if (!writes.has(params.action)) return next(params);
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
