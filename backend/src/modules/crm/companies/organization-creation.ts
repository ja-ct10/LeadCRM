import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { NewAccountSchema, hasModulePermission } from '@leadcrm/shared';
import { crmActor, resolveCrmActor } from '../access/crm-record-access.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../shared/errors/http-error';
import { createCompany } from './companies.service';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}

/** Called only inside the person mutation's sales transaction. */
export async function createLinkedAccount(tx: Prisma.TransactionClient, tenantId: string, input: unknown, actorId?: string) {
  const { requestId, ...details } = NewAccountSchema.parse(input);
  const actor = crmActor.getStore();
  if (!actorId || !actor || actor.tenantId !== tenantId || actor.userId !== actorId) throw new ForbiddenError('An authenticated Account creator is required.');
  const policy = await resolveCrmActor(tx, actor);
  if (!policy.clientAdmin && (!hasModulePermission(policy.permissions, 'accounts', 'canCreate') || !hasModulePermission(policy.permissions, 'accounts', 'canView')))
    throw new ForbiddenError('Accounts View and Create permissions are required to create a linked Account.');
  const requestHash = createHash('sha256').update(JSON.stringify(canonical(details))).digest('hex');
  const receipt = await tx.accountCreationReceipt.findUnique({ where: { tenantId_requestId: { tenantId, requestId } } });
  if (receipt) {
    if (receipt.actorId !== actorId || receipt.requestHash !== requestHash) throw new ConflictError('This Account request ID belongs to different input. Use a new request ID.');
    const account = await tx.account.findFirst({ where: { id: receipt.accountId, tenantId, isArchived: false, deletedAt: null } });
    if (!account) throw new NotFoundError('Active Account');
    return account;
  }
  const account = await createCompany(tenantId, actorId, { ...details, tags: [] });
  await tx.accountCreationReceipt.create({ data: { tenantId, requestId, actorId, requestHash, accountId: account.id } });
  return account;
}
