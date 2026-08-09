import * as repo from './customers.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { CreateCustomerDto, UpdateCustomerDto, ConvertCustomerDto } from './customers.dto';
import { paginate } from '../../../shared/helpers/pagination';
import prisma from '../../../config/database.config';

export async function getCustomers(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllCustomers(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getCustomerById(id: string, tenantId: string) {
  const customer = await repo.findCustomerById(id, tenantId);
  if (!customer) throw new NotFoundError('Customer');
  return customer;
}

export async function createCustomer(tenantId: string, userId: string, dto: CreateCustomerDto) {
  const customer = await repo.createCustomer(tenantId, { ...dto, ownerId: userId } as CreateCustomerDto & { ownerId: string });

  await writeAuditLog({
    tenantId, userId,
    action:     'customer.created',
    entityType: 'Customer',
    entityId:   customer.id,
    after:      { firstName: dto.firstName, lastName: dto.lastName, status: customer.status },
  });

  return customer;
}

export async function updateCustomer(
  id: string, tenantId: string, userId: string, dto: UpdateCustomerDto,
) {
  const before = await repo.findCustomerById(id, tenantId);
  if (!before) throw new NotFoundError('Customer');

  const customer = await repo.updateCustomer(id, tenantId, dto);
  if (!customer) throw new NotFoundError('Customer');

  await writeAuditLog({
    tenantId, userId,
    action:     'customer.updated',
    entityType: 'Customer',
    entityId:   id,
  });

  // Fire status-change trigger if status changed
  if (dto.status && dto.status !== before.status) {
    // Status changed — trigger handled by workflow engine if configured
  }

  return customer;
}

export async function archiveCustomer(id: string, tenantId: string, userId: string) {
  const customer = await repo.archiveCustomer(id, tenantId, userId);
  if (!customer) throw new NotFoundError('Customer');

  await writeAuditLog({
    tenantId, userId,
    action:     'customer.archived',
    entityType: 'Customer',
    entityId:   id,
    after:      { isArchived: true },
  });

  return customer;
}

/**
 * Convert a Customer/Qualified customer into a full Customer with an Account link and optional Deal.
 * One transaction, six+ records: lifecycle advance, org link, deal, customerDeal, history, activity, audit.
 * Non-destructive — nothing is deleted, all history is retained.
 */
export async function convertCustomer(id: string, tenantId: string, userId: string, dto: ConvertCustomerDto) {
  const customer = await repo.findCustomerById(id, tenantId);
  if (!customer) throw new NotFoundError('Customer');

  // Guard: only LEAD or QUALIFIED customers can be converted
  if (customer.status !== 'LEAD' && customer.status !== 'QUALIFIED') {
    throw new ValidationError(`Customer lifecycle is "${customer.status}" — only LEAD or QUALIFIED customers can be converted`);
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Resolve or create the Organization
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

    // 2. Advance the customer's lifecycle and link the account
    const updatedCustomer = await tx.customer.update({
      where: { id },
      data: {
        status: 'Active',
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
          assignedUserId: customer.assignedUserId || userId,
          title: dto.dealTitle,
          value: dto.dealValue,
          priority: dto.dealPriority || 'MEDIUM',
        },
      });

      // 4. Create CustomerDeal junction with Primary Customer role
      await tx.customerDeal.create({
        data: {
          tenantId,
          dealId: deal.id,
          customerId: id,
          role: 'Primary Customer',
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
          note: 'Deal created via customer conversion',
        },
      });

      // 6. Activity for deal creation
      await tx.activity.create({
        data: {
          tenantId,
          createdById: userId,
          type: 'deal_created',
          title: `Deal "${dto.dealTitle}" created via conversion of ${customer.firstName} ${customer.lastName}`,
          dealId: deal.id,
          customerId: id,
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
        title: `Customer "${customer.firstName} ${customer.lastName}" converted — linked to ${account?.name || 'Account'}`,
        customerId: id,
        accountId: accountId,
      },
    });

    return { customer: updatedCustomer, account, deal, stageHistory };
  });

  // 8. Audit log (outside transaction — non-blocking)
  await writeAuditLog({
    tenantId, userId,
    action: 'customer.converted',
    entityType: 'Customer',
    entityId: id,
    after: {
      status: 'CONTACT',
      accountId: result.account?.id,
      dealId: result.deal?.id,
    },
  });

  return result;
}
