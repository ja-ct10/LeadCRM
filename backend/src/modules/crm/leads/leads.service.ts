import * as repo from './leads.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { enforcePlanLimit } from '../../../config/database.config';
import { CreateLeadDto, UpdateLeadDto, ConvertLeadDto } from './leads.dto';
import { paginate } from '../../../shared/helpers/pagination';
import { fireDealCreated } from '../../automation/triggers/triggers.service';
import prisma from '../../../config/database.config';

export async function getLeads(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllLeads(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getLeadById(id: string, tenantId: string) {
  const lead = await repo.findLeadById(id, tenantId);
  if (!lead) throw new NotFoundError('Lead');
  return lead;
}

export async function createLead(tenantId: string, userId: string, dto: CreateLeadDto) {
  const lead = await repo.createLead(tenantId, { ...dto, ownerId: userId } as CreateLeadDto & { ownerId: string });

  await writeAuditLog({
    tenantId, userId,
    action:     'lead.created',
    entityType: 'Lead',
    entityId:   lead.id,
    after:      { firstName: dto.firstName, lastName: dto.lastName, status: lead.status },
  });

  // Fire workflow trigger (non-blocking — never fails the request)
  // fireDealCreated({
  //   tenantId,
  //   lead: { ...lead },
  // }).catch(() => {});

  return lead;
}

export async function updateLead(
  id: string, tenantId: string, userId: string, dto: UpdateLeadDto,
) {
  const before = await repo.findLeadById(id, tenantId);
  if (!before) throw new NotFoundError('Lead');

  const lead = await repo.updateLead(id, tenantId, dto);
  if (!lead) throw new NotFoundError('Lead');

  await writeAuditLog({
    tenantId, userId,
    action:     'lead.updated',
    entityType: 'Lead',
    entityId:   id,
  });

  // Fire status-change trigger if status changed
  if (dto.status && dto.status !== before.status) {
    /* fireLeadStatusChanged({
      tenantId,
      lead: { ...lead },
      prevStatus: before.status,
    }).catch(() => {}); */
  }

  return lead;
}

export async function archiveLead(id: string, tenantId: string, userId: string) {
  const lead = await repo.archiveLead(id, tenantId, userId);
  if (!lead) throw new NotFoundError('Lead');

  await writeAuditLog({
    tenantId, userId,
    action:     'lead.archived',
    entityType: 'Lead',
    entityId:   id,
    after:      { isArchived: true },
  });

  return lead;
}

/**
 * Convert a Lead/Qualified lead into a full Lead with an Account link and optional Deal.
 * One transaction, six+ records: lifecycle advance, org link, deal, leadDeal, history, activity, audit.
 * Non-destructive — nothing is deleted, all history is retained.
 */
export async function convertLead(id: string, tenantId: string, userId: string, dto: ConvertLeadDto) {
  const lead = await repo.findLeadById(id, tenantId);
  if (!lead) throw new NotFoundError('Lead');

  // Guard: only LEAD or QUALIFIED leads can be converted
  if (lead.status !== 'LEAD' && lead.status !== 'QUALIFIED') {
    throw new ValidationError(`Lead lifecycle is "${lead.status}" — only LEAD or QUALIFIED leads can be converted`);
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Resolve or create the Account
    let accountId = dto.organizationId;
    let account;

    if (accountId) {
      account = await tx.account.findFirst({ where: { id: accountId, tenantId } });
      if (!account) throw new NotFoundError('Account');
    } else if (dto.organizationName) {
      account = await tx.account.create({
        data: { tenantId, name: dto.organizationName },
      });
      accountId = account.id;
    }

    // 2. Advance the lead's lifecycle and link the account
    const updatedLead = await tx.lead.update({
      where: { id },
      data: {
        status: 'CONTACT',
        accountId: accountId,
      },
    });

    // 3. Optionally create a Deal
    let deal = null;
    let stageHistory = null;

    if (dto.createDeal && dto.dealTitle) {
      // Find the default pipeline and its entry stage
      const pipeline = dto.dealPipelineId
        ? await tx.pipeline.findFirst({ where: { id: dto.dealPipelineId, tenantId, isArchived: false }, include: { stages: { orderBy: { order: 'asc' } } } })
        : await tx.pipeline.findFirst({ where: { tenantId, isDefault: true, isArchived: false }, include: { stages: { orderBy: { order: 'asc' } } } });

      if (!pipeline || pipeline.stages.length === 0) {
        throw new ValidationError('No pipeline with stages available for deal creation');
      }

      const entryStage = pipeline.stages.find(s => s.isDefault) || pipeline.stages[0];

      deal = await tx.deal.create({
        data: {
          tenantId,
          pipelineId: pipeline.id,
          stageId: entryStage.id,
          accountId: accountId!,
          ownerId: userId,
          assignedUserId: lead.assignedUserId || userId,
          title: dto.dealTitle,
          value: dto.dealValue,
          priority: dto.dealPriority || 'MEDIUM',
        },
      });

      // 4. Create LeadDeal junction with Primary Lead role
      await tx.leadDeal.create({
        data: {
          tenantId,
          dealId: deal.id,
          leadId: id,
          role: 'Primary Lead',
          addedById: userId,
        },
      });

      // 5. Create initial DealStageHistory
      stageHistory = await tx.dealStageHistory.create({
        data: {
          tenantId,
          dealId: deal.id,
          previousStageId: null,
          newStageId: entryStage.id,
          movedById: userId,
          movedAt: now,
          timeInPrevStage: 0,
          note: 'Deal created via lead conversion',
        },
      });

      // 6. Activity for deal creation
      await tx.activity.create({
        data: {
          tenantId,
          createdById: userId,
          type: 'deal_created',
          title: `Deal "${dto.dealTitle}" created via conversion of ${lead.firstName} ${lead.lastName}`,
          dealId: deal.id,
          leadId: id,
          accountId: accountId,
        },
      });
    }

    // 7. Activity for conversion itself
    await tx.activity.create({
      data: {
        tenantId,
        createdById: userId,
        type: 'conversion',
        title: `Lead "${lead.firstName} ${lead.lastName}" converted — linked to ${account?.name || 'Account'}`,
        leadId: id,
        accountId: accountId,
      },
    });

    return { lead: updatedLead, account, deal, stageHistory };
  });

  // 8. Audit log (outside transaction — non-blocking)
  await writeAuditLog({
    tenantId, userId,
    action: 'lead.converted',
    entityType: 'Lead',
    entityId: id,
    after: {
      status: 'CONTACT',
      accountId: result.account?.id,
      dealId: result.deal?.id,
    },
  });

  return result;
}
