import { Prisma } from '@prisma/client';
import { WorkflowTaskAssociationSchema, type WorkflowAction, type WorkflowEntity } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { ValidationError } from '../../../shared/errors/http-error';

export const WORKFLOW_TASK_DEAL_LIMIT = 50;

/** Validate the selection on save and again through the mutation's transaction. */
export async function validateTaskDealSelection(action: WorkflowAction, entity: WorkflowEntity, tenantId: string,
  client: Prisma.TransactionClient = prisma) {
  const parsed = WorkflowTaskAssociationSchema.safeParse(action.config);
  if (!parsed.success) throw new ValidationError('Choose an available task association mode and valid Deal filters.');
  const selection = parsed.data;
  const mode = selection.targetMode ?? (entity === 'deal' ? 'triggering_deal' : 'single_match');
  if (entity === 'deal' && (mode !== 'triggering_deal' || selection.pipelineId || selection.currentStageId || selection.productInterestId))
    throw new ValidationError('Deal workflows associate the task with the triggering deal. Remove related-deal filters.');
  if (entity !== 'deal' && mode === 'triggering_deal')
    throw new ValidationError('Choose a Deal trigger to associate a task with the triggering deal.');
  if (entity === 'account' && (mode !== 'single_match' || selection.pipelineId || selection.currentStageId || selection.productInterestId))
    throw new ValidationError('This saved Account workflow requires one related deal. Choose a Lead or Contact trigger for related-deal filters.');
  if (selection.pipelineId && !await client.pipeline.findFirst({ where: { id: selection.pipelineId, tenantId }, select: { id: true } }))
    throw new ValidationError('The selected pipeline is unavailable. Choose another pipeline.');
  if (selection.currentStageId) {
    const stage = await client.stage.findFirst({ where: { id: selection.currentStageId, tenantId }, select: { pipelineId: true } });
    if (!stage) throw new ValidationError('The selected deal stage is unavailable. Choose another stage.');
    if (selection.pipelineId && stage.pipelineId !== selection.pipelineId)
      throw new ValidationError('The selected deal stage belongs to another pipeline. Choose a stage in the selected pipeline.');
  }
  if (selection.productInterestId && !await client.productInterest.findFirst({ where: { id: selection.productInterestId, tenantId, active: true }, select: { id: true } }))
    throw new ValidationError('The selected product is unavailable. Choose an active product.');
  if (selection.dealId && !await client.deal.findFirst({ where: { id: selection.dealId, tenantId, isArchived: false, deletedAt: null }, select: { id: true } }))
    throw new ValidationError('The selected deal is unavailable. Choose an active deal connected to the triggering record.');
  return { ...selection, targetMode: mode };
}

export function workflowTaskAssociationSummary(dealCount: number) {
  return `Creates 1 task linked to ${dealCount} ${dealCount === 1 ? 'deal' : 'deals'}.`;
}

/** Persisted relationships are authoritative; matching never chooses a first/latest deal. */
export async function resolveTaskDeals(action: WorkflowAction, entity: WorkflowEntity, tenantId: string,
  context: Record<string, unknown>, client: Prisma.TransactionClient = prisma) {
  const selection = await validateTaskDealSelection(action, entity, tenantId, client);
  const id = context[`${entity}.id`];
  if (typeof id !== 'string' || !id) throw new ValidationError('The triggering record is unavailable. Choose an active record and run the check again.');
  const relation: Prisma.DealWhereInput = entity === 'deal' ? { id }
    : entity === 'lead' ? { leadDeals: { some: { tenantId, leadId: id } } }
      : entity === 'contact' ? { OR: [
        { contactDeals: { some: { tenantId, contactId: id } } },
        { leadDeals: { some: { tenantId, lead: { tenantId, contactId: id, convertedAt: { not: null } } } } },
      ] } : { accountId: id };
  const where: Prisma.DealWhereInput = { tenantId, isArchived: false, deletedAt: null, AND: [relation],
    ...(selection.dealId ? { id: selection.dealId } : {}),
    ...(selection.pipelineId ? { pipelineId: selection.pipelineId } : {}),
    ...(selection.currentStageId ? { stageId: selection.currentStageId } : {}),
    ...(selection.productInterestId ? { OR: [
      { productInterestId: selection.productInterestId }, { productInterestIds: { has: selection.productInterestId } },
    ] } : {}),
  };
  const count = await client.deal.count({ where });
  if (!count) throw new ValidationError('No related deals match your selection. Link an active deal to the triggering record or update the deal filters.');
  if (count > 1 && selection.targetMode !== 'all_matching')
    throw new ValidationError(entity === 'account'
      ? `${count} related deals match your selection. Choose a specific related deal, or use a Lead or Contact trigger to filter related deals.`
      : `${count} related deals match your selection. Narrow your filters or choose 'All matching related deals'.`);
  if (count > WORKFLOW_TASK_DEAL_LIMIT)
    throw new ValidationError(`${count} related deals match your selection. A task supports up to ${WORKFLOW_TASK_DEAL_LIMIT} deal associations. Narrow your filters before trying again.`);
  const rows = await client.deal.findMany({ where, select: { id: true, title: true }, orderBy: { id: 'asc' } });
  // A preview can race with a relationship edit; execution rechecks in its serializable transaction.
  if (rows.length !== count) throw new ValidationError('Related deals changed during this check. Run the check again before saving.');
  return rows;
}

export async function resolveTaskDealIds(action: WorkflowAction, entity: WorkflowEntity, tenantId: string,
  context: Record<string, unknown>, client: Prisma.TransactionClient = prisma) {
  return (await resolveTaskDeals(action, entity, tenantId, context, client)).map(row => row.id);
}
