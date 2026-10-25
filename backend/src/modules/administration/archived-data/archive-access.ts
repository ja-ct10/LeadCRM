import { Prisma } from '@prisma/client';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { AppError } from '../../../shared/errors/app-error';

export const archiveModels = {
  Lead: 'Lead', Contact: 'Contact', Account: 'Account', Deal: 'Deal', Task: 'Task',
  Campaign: 'Campaign', Workflow: 'Workflow', User: 'User', ProductInterest: 'Product',
  Pipeline: 'Pipeline', Template: 'Template',
} as const;
export type ArchiveEntity = typeof archiveModels[keyof typeof archiveModels];
type Policy = { tenantId: string; userId: string; clientAdmin: boolean };
export const archivedState = (type: ArchiveEntity, row: Record<string, unknown>) =>
  type === 'User' ? row.status === 'INACTIVE' : type === 'Product' ? row.active === false : row.isArchived === true;
const tableFor = (type: ArchiveEntity) => type === 'Product' ? 'ProductInterest' : type;

/** Fixed server-owned table names only; identities are always parameters. */
export function archiveOwnerSql(type: ArchiveEntity, policy: Policy, alias = 'r'): Prisma.Sql {
  if (policy.clientAdmin) return Prisma.sql`true`;
  const id = Prisma.raw(`${alias}."id"`);
  const native = ['Lead', 'Contact', 'Account'].includes(type);
  const transition = Prisma.sql`(a."action" IN ('archive.archived', 'archive.restored') OR
    (NOT EXISTS (SELECT 1 FROM "AuditLog" c WHERE c."tenantId" = ${policy.tenantId}
      AND c."entityType" = ${type} AND c."entityId" = ${id} AND c."action" IN ('archive.archived', 'archive.restored'))
     AND (a."action" IN (${type.toLowerCase() + '.archived'}, ${type.toLowerCase() + '.restored'})
       ${type === 'User' ? Prisma.sql`OR a."action" = 'user.deactivated_with_reassignment' OR
         (a."action" = 'user.updated' AND a."changeset"->'after'->>'status' IN ('ACTIVE', 'INACTIVE'))` : Prisma.empty}
       ${type === 'Product' ? Prisma.sql`OR a."action" = 'product_interests.remove'` : Prisma.empty})))`;
  const isArchive = Prisma.sql`(a."action" IN ('archive.archived', ${type.toLowerCase() + '.archived'})
    ${type === 'User' ? Prisma.sql`OR a."action" = 'user.deactivated_with_reassignment' OR
      (a."action" = 'user.updated' AND a."changeset"->'after'->>'status' = 'INACTIVE'
       AND a."changeset"->'before'->>'status' IS DISTINCT FROM 'INACTIVE')` : Prisma.empty}
    ${type === 'Product' ? Prisma.sql`OR a."action" = 'product_interests.remove'` : Prisma.empty})`;
  // New transactional transitions supersede legacy best-effort logs. A conflicting
  // actor/restore at the latest timestamp is ambiguous, never a UUID tie-break.
  const audited = Prisma.sql`(SELECT bool_and(a."userId" = ${policy.userId} AND ${isArchive})
    FROM "AuditLog" a WHERE a."tenantId" = ${policy.tenantId} AND a."entityId" = ${id}
      AND (a."entityType" = ${type} ${type === 'Product' ? Prisma.sql`OR a."entityType" = 'ProductInterest'` : Prisma.empty})
      AND ${transition}
      ${native ? Prisma.sql`AND (${Prisma.raw(`${alias}."deletedAt"`)} IS NULL OR a."createdAt" >= ${Prisma.raw(`${alias}."deletedAt"`)})` : Prisma.empty}
      AND a."createdAt" = (SELECT max(a."createdAt") FROM "AuditLog" a WHERE a."tenantId" = ${policy.tenantId}
        AND a."entityId" = ${id}
        AND (a."entityType" = ${type} ${type === 'Product' ? Prisma.sql`OR a."entityType" = 'ProductInterest'` : Prisma.empty})
        AND ${transition}))`;
  const owner = native ? Prisma.sql`CASE WHEN ${Prisma.raw(`${alias}."deletedBy"`)} IS NOT NULL
    THEN ${Prisma.raw(`${alias}."deletedBy"`)} = ${policy.userId} ELSE coalesce(${audited}, false) END`
    : Prisma.sql`coalesce(${audited}, false)`;
  // Recovery retains the source module's creator boundary, including unknown
  // historical creators and administrators who have since become regular staff.
  return type === 'Campaign' || type === 'Workflow'
    ? Prisma.sql`(${Prisma.raw(`${alias}."createdById"`)} = ${policy.userId} AND ${owner})` : owner;
}

export async function archiveReadWhere(db: Prisma.TransactionClient, type: ArchiveEntity, policy: Policy): Promise<Record<string, any>> {
  if (policy.clientAdmin) return {};
  const active = type === 'User' ? { status: { not: 'INACTIVE' } } : type === 'Product' ? { active: true } : { isArchived: false };
  const state = type === 'User' ? Prisma.sql`r."status" = 'INACTIVE'` : type === 'Product' ? Prisma.sql`r."active" = false` : Prisma.sql`r."isArchived" = true`;
  // Only authorized archived identities are loaded. Prisma applies this predicate
  // before its existing search/count/pagination and record-access predicates.
  const ids = await tenantContext.exit(async () => await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT r."id" FROM ${Prisma.raw('"' + tableFor(type) + '"')} r
    WHERE r."tenantId" = ${policy.tenantId} AND ${state} AND ${archiveOwnerSql(type, policy)}`));
  return { OR: [active, { id: { in: ids.map(row => row.id) } }] };
}

export async function assertArchiveOwner(db: Prisma.TransactionClient, type: ArchiveEntity, id: string, policy: Policy) {
  if (policy.clientAdmin) return;
  const rows = await tenantContext.exit(async () => await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT r."id" FROM ${Prisma.raw('"' + tableFor(type) + '"')} r
    WHERE r."tenantId" = ${policy.tenantId} AND r."id" = ${id} AND ${archiveOwnerSql(type, policy)} FOR UPDATE`));
  if (!rows.length) throw new AppError('Archived record not found.', 404);
}
