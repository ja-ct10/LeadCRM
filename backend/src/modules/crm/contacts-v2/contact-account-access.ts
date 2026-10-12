import type { Prisma } from '@prisma/client';
import { hasModulePermission } from '@leadcrm/shared';
import { crmActor, resolveCrmActor, authorizedWorkflowScope } from '../access/crm-record-access.service';
import { ForbiddenError } from '../../../shared/errors/http-error';

/** Contact permission does not grant access to the linked Account's metadata. */
export async function mayReadContactAccount(db: Prisma.TransactionClient, tenantId: string): Promise<boolean> {
  const actor = crmActor.getStore();
  if (!actor) return true; // Internal services retain their explicit tenant policies.
  if (actor.tenantId !== tenantId) throw new ForbiddenError();
  if (authorizedWorkflowScope(tenantId)) return true;
  const policy = await resolveCrmActor(db, actor);
  return policy.clientAdmin || hasModulePermission(policy.permissions, 'accounts', 'canView');
}

export async function assertContactAccountSelection(db: Prisma.TransactionClient, tenantId: string, accountId: unknown, previousId?: string | null): Promise<void> {
  // Keeping a historical FK or removing it reveals no new Account information.
  if (accountId == null || accountId === previousId) return;
  if (!await mayReadContactAccount(db, tenantId)) throw new ForbiddenError('Accounts View permission is required to select an Account.');
}
