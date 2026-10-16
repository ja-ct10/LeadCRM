import type { Prisma } from '@prisma/client';
import { NewAccountSchema, hasModulePermission } from '@leadcrm/shared';
import { crmActor, resolveCrmActor } from '../access/crm-record-access.service';
import { ForbiddenError } from '../../../shared/errors/http-error';
import { createCompany } from './companies.service';

/** Called only inside the person mutation's sales transaction. */
export async function createLinkedAccount(tx: Prisma.TransactionClient, tenantId: string, input: unknown, actorId?: string) {
  const { requestId, ...details } = NewAccountSchema.parse(input);
  const actor = crmActor.getStore();
  if (!actorId || !actor || actor.tenantId !== tenantId || actor.userId !== actorId) throw new ForbiddenError('An authenticated Account creator is required.');
  const policy = await resolveCrmActor(tx, actor);
  if (!policy.clientAdmin && (!hasModulePermission(policy.permissions, 'accounts', 'canCreate') || !hasModulePermission(policy.permissions, 'accounts', 'canView')))
    throw new ForbiddenError('Accounts View and Create permissions are required to create a linked Account.');
  return createCompany(tenantId, actorId, { ...details, requestId, tags: [] });
}
