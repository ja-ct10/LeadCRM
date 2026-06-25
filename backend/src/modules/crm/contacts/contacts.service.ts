import * as repo from './contacts.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { enforcePlanLimit } from '../../../config/database.config';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { paginate } from '../../../shared/helpers/pagination';
import { fireContactCreated, fireContactStatusChanged } from '../../automation/triggers/triggers.service';

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

  fireContactCreated({ tenantId, contact }).catch(() => {});

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
    fireContactStatusChanged({ tenantId, contact, prevStatus: before.status }).catch(() => {});
  }

  return contact;
}

export async function archiveContact(id: string, tenantId: string, userId: string) {
  const contact = await repo.archiveContact(id, tenantId);
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
