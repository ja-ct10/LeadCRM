import * as repo from './contacts.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';
import { enforcePlanLimit } from '../../../config/database.config';
import { CreateContactDto, UpdateContactDto, ConvertContactDto } from './contacts.dto';
import { paginate } from '../../../shared/helpers/pagination';
import { fireContactCreated, fireContactStatusChanged } from '../../automation/triggers/triggers.service';
import prisma from '../../../config/database.config';

export async function getContacts(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllContacts(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getContactById(id: string, tenantId: string) {
  const contact = await repo.findContactById(id, tenantId);
  if (!contact) throw new NotFoundError('Contact');
  return contact;
}

export async function createContact(tenantId: string, userId: string, dto: CreateContactDto) {
  await enforcePlanLimit(tenantId, 'contacts');
  const contact = await repo.createContact(tenantId, dto, userId);

  await writeAuditLog({
    tenantId, userId,
    action:     'contact.created',
    entityType: 'Contact',
    entityId:   contact.id,
    after:      { firstName: dto.firstName, lastName: dto.lastName },
  });

  // Fire workflow trigger (non-blocking)
  fireContactCreated({
    tenantId,
    contact: contact as never,
  }).catch(() => {});

  return contact;
}

export async function updateContact(
  id: string, tenantId: string, userId: string, dto: UpdateContactDto,
) {
  const before = await repo.findContactById(id, tenantId);
  if (!before) throw new NotFoundError('Contact');

  const contact = await repo.updateContact(id, tenantId, dto, userId, before.status);
  if (!contact) throw new NotFoundError('Contact');

  await writeAuditLog({
    tenantId, userId,
    action:     'contact.updated',
    entityType: 'Contact',
    entityId:   id,
  });

  // Fire status-change trigger if status changed
  if (dto.status && dto.status !== before.status) {
    fireContactStatusChanged({
      tenantId,
      contact: contact as never,
      prevStatus: before.status,
    }).catch(() => {});
  }

  return contact;
}

export async function archiveContact(id: string, tenantId: string, userId: string) {
  const contact = await repo.archiveContact(id, tenantId, userId);
  if (!contact) throw new NotFoundError('Contact');

  await writeAuditLog({
    tenantId, userId,
    action:     'contact.archived',
    entityType: 'Contact',
    entityId:   id,
    after:      { status: 'Archived' },
  });

  return contact;
}

/**
 * Convert a Lead contact into a full Contact with an Account link and optional Deal.
 */
export async function convertContact(
  id: string, tenantId: string, userId: string, dto: ConvertContactDto,
) {
  const contact = await repo.findContactById(id, tenantId);
  if (!contact) throw new NotFoundError('Contact');

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Resolve or create the Account
    let accountId = dto.accountId;
    let account: { id: string; name: string; customerSince?: Date | null; activeProducts?: string[] } | null = null;

    if (accountId) {
      account = await tx.account.findFirst({ where: { id: accountId, tenantId } });
      if (!account) throw new NotFoundError('Account');
    } else if (dto.accountName) {
      account = await tx.account.create({
        data: { tenantId, name: dto.accountName } as never,
      });
      accountId = account.id;
    }

    // 2. Optionally create a Deal
    let deal = null;
    if (dto.createDeal && dto.dealTitle) {
      const pipeline = dto.dealPipelineId
        ? await tx.pipeline.findFirst({ where: { id: dto.dealPipelineId, tenantId, isArchived: false }, include: { stages: { orderBy: { order: 'asc' } } } })
        : await tx.pipeline.findFirst({ where: { tenantId, isDefault: true, isArchived: false }, include: { stages: { orderBy: { order: 'asc' } } } });

      if (!pipeline || pipeline.stages.length === 0) {
        throw new ValidationError('No pipeline with stages available for deal creation');
      }

      const entryStage = pipeline.stages.find((s: { isDefault: boolean }) => s.isDefault) || pipeline.stages[0];

      deal = await tx.deal.create({
        data: {
          tenantId, pipelineId: pipeline.id, stageId: entryStage.id,
          accountId: accountId,
          ownerId: userId,
          assignedUserId: contact.assignedUserId || userId,
          title: dto.dealTitle, value: dto.dealValue,
          priority: dto.dealPriority || 'MEDIUM',
        } as never,
      });

      // LeadDeal junction
      await tx.leadDeal.create({
        data: { tenantId, dealId: deal.id, leadId: id, addedById: userId } as never,
      });

      // Activity for deal creation
      await tx.activity.create({
        data: {
          tenantId, createdById: userId,
          type:  'deal_created',
          title: `Deal "${dto.dealTitle}" created via conversion`,
          dealId: deal.id, leadId: id, accountId: accountId,
        } as never,
      });
    }

    // 3. Activity for conversion
    await tx.activity.create({
      data: {
        tenantId, createdById: userId,
        type:  'conversion',
        title: `Contact converted — linked to ${account?.name || 'Account'}`,
        leadId: id, accountId: accountId,
      } as never,
    });

    return { contact, account, deal };
  });

  await writeAuditLog({
    tenantId, userId,
    action:     'contact.converted',
    entityType: 'Contact',
    entityId:   id,
    after:      { accountId: result.account?.id, dealId: result.deal?.id },
  });

  return result;
}
