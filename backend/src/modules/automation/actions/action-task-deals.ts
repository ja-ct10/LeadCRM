import { Prisma } from '@prisma/client';
import type { WorkflowAction, WorkflowEntity } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { ValidationError } from '../../../shared/errors/http-error';

/** Existing unambiguous workflows retain their behavior; ambiguous ones fail visibly. */
export async function resolveTaskDealIds(action: WorkflowAction, entity: WorkflowEntity, tenantId: string,
  context: Record<string, unknown>, client: Prisma.TransactionClient = prisma) {
  const id = String(context[`${entity}.id`]);
  const relation: Prisma.DealWhereInput = entity === 'deal' ? { id }
    : entity === 'lead' ? { leadDeals: { some: { tenantId, leadId: id } } }
      : entity === 'contact' ? { OR: [
        { contactDeals: { some: { tenantId, contactId: id } } },
        { leadDeals: { some: { tenantId, lead: { tenantId, contactId: id, convertedAt: { not: null } } } } },
      ] } : { accountId: id };
  const rows = await client.deal.findMany({ where: { tenantId, isArchived: false, deletedAt: null, AND: [relation],
    ...(action.config.dealId ? { id: String(action.config.dealId) } : {}) }, select: { id: true }, take: 2 });
  if (!rows.length) throw new ValidationError('Create Task requires an eligible Deal connected to the triggering record. Link a Deal or update this Workflow.');
  if (rows.length > 1) throw new ValidationError('Multiple related Deals are available. Configure the intended Deal ID for this Create Task action.');
  return rows.map(row => row.id);
}
