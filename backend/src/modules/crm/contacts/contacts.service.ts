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
 * Convert a Lead into a full CRM record chain:
 * Lead → Contact (create/link) + Account (create/link) + optional Deal (create/link).
 *
 * After conversion:
 * - Lead.status = 'Converted'
 * - Lead.contactId = created/linked Contact ID
 * - Lead.convertedAt = now
 * - Lead.convertedById = userId
 * - Lead.accountId = resolved Account ID
 */
export async function convertContact(
  id: string, tenantId: string, userId: string, dto: ConvertContactDto,
) {
  const lead = await repo.findContactById(id, tenantId);
  if (!lead) throw new NotFoundError('Contact');

  // Prevent re-conversion
  if (lead.status === 'Converted') {
    throw new ValidationError('This lead has already been converted');
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // ─── 1. Resolve or create the Account ─────────────────────────────────
    let accountId = dto.accountId;
    let account: { id: string; name: string } | null = null;

    if (accountId) {
      account = await tx.account.findFirst({ where: { id: accountId, tenantId } });
      if (!account) throw new NotFoundError('Account');
    } else if (dto.accountName) {
      account = await tx.account.create({
        data: { tenantId, name: dto.accountName } as never,
      });
      accountId = account.id;
    }

    // ─── 2. Resolve or create the Contact ─────────────────────────────────
    let contactId: string | null = null;
    let contact: { id: string; firstName: string; lastName: string } | null = null;

    if (dto.contactId) {
      // Link to existing contact
      contact = await tx.contact.findFirst({ where: { id: dto.contactId, tenantId } });
      if (!contact) throw new NotFoundError('Contact');
      contactId = contact.id;

      // Update existing contact's accountId if not already set
      if (accountId) {
        await tx.contact.update({
          where: { id: contactId } as never,
          data: { accountId } as never,
        });
      }
    } else if (dto.createContact !== false) {
      // Create new Contact from Lead data
      contact = await tx.contact.create({
        data: {
          tenantId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          companyName: lead.companyName,
          address: lead.address,
          source: lead.source,
          productInterest: lead.productInterest || [],
          assignedUserId: lead.assignedUserId,
          accountId: accountId,
          status: 'Active',
        } as never,
      });
      contactId = contact.id;
    }

    // ─── 3. Resolve or create the Deal ────────────────────────────────────
    let deal: { id: string; title: string } | null = null;

    if (dto.dealId) {
      // Link to existing deal
      deal = await tx.deal.findFirst({
        where: { id: dto.dealId, tenantId },
        select: { id: true, title: true },
      });
      if (!deal) throw new NotFoundError('Deal');

      // Create LeadDeal junction
      await tx.leadDeal.create({
        data: { tenantId, dealId: deal.id, leadId: id, addedById: userId } as never,
      });

      // Create ContactDeal junction if contact exists
      if (contactId) {
        await tx.contactDeal.create({
          data: { tenantId, dealId: deal.id, contactId, addedById: userId } as never,
        }).catch(() => {
          // Ignore if junction already exists (unique constraint)
        });
      }

      // Update deal accountId if not set
      if (accountId) {
        await tx.deal.update({
          where: { id: deal.id } as never,
          data: { accountId } as never,
        });
      }
    } else if (dto.createDeal && dto.dealTitle) {
      // Create new deal
      const pipeline = dto.dealPipelineId
        ? await tx.pipeline.findFirst({ where: { id: dto.dealPipelineId, tenantId, isArchived: false }, include: { stages: { orderBy: { order: 'asc' } } } })
        : await tx.pipeline.findFirst({ where: { tenantId, isDefault: true, isArchived: false }, include: { stages: { orderBy: { order: 'asc' } } } });

      if (!pipeline || pipeline.stages.length === 0) {
        throw new ValidationError('No pipeline with stages available for deal creation');
      }

      const entryStage = pipeline.stages.find((s: { isDefault: boolean }) => s.isDefault) || pipeline.stages[0];

      deal = await tx.deal.create({
        data: {
          tenantId,
          pipelineId: pipeline.id,
          stageId: entryStage.id,
          accountId: accountId,
          ownerId: userId,
          assignedUserId: lead.assignedUserId || userId,
          title: dto.dealTitle,
          value: dto.dealValue,
          priority: dto.dealPriority || 'MEDIUM',
        } as never,
      });

      // LeadDeal junction
      await tx.leadDeal.create({
        data: { tenantId, dealId: deal.id, leadId: id, addedById: userId } as never,
      });

      // ContactDeal junction (if contact was created/linked)
      if (contactId) {
        await tx.contactDeal.create({
          data: { tenantId, dealId: deal.id, contactId, addedById: userId } as never,
        });
      }

      // Activity for deal creation
      await tx.activity.create({
        data: {
          tenantId, createdById: userId,
          type: 'deal_created',
          title: `Deal "${dto.dealTitle}" created via conversion`,
          dealId: deal.id, leadId: id, accountId: accountId,
        } as never,
      });
    }

    // ─── 4. Update the Lead record ────────────────────────────────────────
    await tx.lead.update({
      where: { id } as never,
      data: {
        status: 'Converted',
        accountId: accountId,
        contactId: contactId,
        convertedAt: now,
        convertedById: userId,
      } as never,
    });

    // ─── 5. Activity for conversion ───────────────────────────────────────
    await tx.activity.create({
      data: {
        tenantId, createdById: userId,
        type: 'conversion',
        title: `Lead converted — linked to ${account?.name || 'Account'}${contact ? `, Contact ${contact.firstName} ${contact.lastName}` : ''}`,
        leadId: id, accountId: accountId,
        ...(contactId ? { customerId: contactId } : {}),
      } as never,
    });

    return { lead, contact, account, deal };
  });

  await writeAuditLog({
    tenantId, userId,
    action: 'contact.converted',
    entityType: 'Contact',
    entityId: id,
    after: {
      accountId: result.account?.id,
      contactId: result.contact?.id,
      dealId: result.deal?.id,
      convertedAt: now.toISOString(),
    },
  });

  return result;
}
