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
  const contact = await repo.createContact(tenantId, { ...dto, ownerId: userId } as CreateContactDto & { ownerId: string });

  await writeAuditLog({
    tenantId, userId,
    action:     'contact.created',
    entityType: 'Contact',
    entityId:   contact.id,
    after:      { firstName: dto.firstName, lastName: dto.lastName, status: contact.status },
  });

  // Fire workflow trigger (non-blocking — never fails the request)
  fireContactCreated({
    tenantId,
    contact: { ...contact, score: contact.score ?? 75 },
  }).catch(() => {});

  return contact;
}

export async function updateContact(
  id: string, tenantId: string, userId: string, dto: UpdateContactDto,
) {
  const before = await repo.findContactById(id, tenantId);
  if (!before) throw new NotFoundError('Contact');

  const contact = await repo.updateContact(id, tenantId, dto);
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
      contact: { ...contact, score: contact.score ?? 75 },
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
    after:      { isArchived: true },
  });

  return contact;
}

/**
 * Convert a Lead/Qualified contact into a full Contact with an Account link and optional Deal.
 * One transaction, six+ records: lifecycle advance, org link, deal, contactDeal, history, activity, audit.
 * Non-destructive — nothing is deleted, all history is retained.
 */
export async function convertContact(id: string, tenantId: string, userId: string, dto: ConvertContactDto) {
  const contact = await repo.findContactById(id, tenantId);
  if (!contact) throw new NotFoundError('Contact');

  // Guard: only LEAD or QUALIFIED contacts can be converted
  if (contact.lifecycleStage !== 'LEAD' && contact.lifecycleStage !== 'QUALIFIED') {
    throw new ValidationError(`Contact lifecycle is "${contact.lifecycleStage}" — only LEAD or QUALIFIED contacts can be converted`);
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Resolve or create the Organization
    let organizationId = dto.organizationId;
    let organization;

    if (organizationId) {
      organization = await tx.organization.findFirst({ where: { id: organizationId, tenantId } });
      if (!organization) throw new NotFoundError('Organization');
    } else if (dto.organizationName) {
      organization = await tx.organization.create({
        data: { tenantId, name: dto.organizationName },
      });
      organizationId = organization.id;
    }

    // 2. Advance the contact's lifecycle and link the organization
    const updatedContact = await tx.contact.update({
      where: { id },
      data: {
        lifecycleStage: 'CONTACT',
        organizationId: organizationId,
        qualifiedAt: contact.qualifiedAt || now,
        convertedAt: now,
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
          organizationId: organizationId!,
          ownerId: userId,
          assignedUserId: contact.assignedUserId || userId,
          title: dto.dealTitle,
          value: dto.dealValue,
          priority: dto.dealPriority || 'MEDIUM',
        },
      });

      // 4. Create ContactDeal junction with Primary Contact role
      await tx.contactDeal.create({
        data: {
          tenantId,
          dealId: deal.id,
          contactId: id,
          role: 'Primary Contact',
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
          note: 'Deal created via contact conversion',
        },
      });

      // 6. Activity for deal creation
      await tx.activity.create({
        data: {
          tenantId,
          createdById: userId,
          type: 'deal_created',
          title: `Deal "${dto.dealTitle}" created via conversion of ${contact.firstName} ${contact.lastName}`,
          dealId: deal.id,
          contactId: id,
          organizationId: organizationId,
        },
      });
    }

    // 7. Activity for conversion itself
    await tx.activity.create({
      data: {
        tenantId,
        createdById: userId,
        type: 'conversion',
        title: `Contact "${contact.firstName} ${contact.lastName}" converted — linked to ${organization?.name || 'Account'}`,
        contactId: id,
        organizationId: organizationId,
      },
    });

    return { contact: updatedContact, organization, deal, stageHistory };
  });

  // 8. Audit log (outside transaction — non-blocking)
  await writeAuditLog({
    tenantId, userId,
    action: 'contact.converted',
    entityType: 'Contact',
    entityId: id,
    after: {
      lifecycleStage: 'CONTACT',
      organizationId: result.organization?.id,
      dealId: result.deal?.id,
    },
  });

  return result;
}
