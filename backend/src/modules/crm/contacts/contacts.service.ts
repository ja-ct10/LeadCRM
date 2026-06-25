import * as repo from './contacts.repository';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { paginate } from '../../../shared/helpers/pagination';

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
  const contact = await repo.createContact(tenantId, dto);

  await writeAuditLog({
    tenantId,
    userId,
    action:     'contact.created',
    entityType: 'Contact',
    entityId:   contact.id,
    after:      { firstName: dto.firstName, lastName: dto.lastName },
  });

  return contact;
}

export async function updateContact(
  id: string,
  tenantId: string,
  userId: string,
  dto: UpdateContactDto,
) {
  const contact = await repo.updateContact(id, tenantId, dto);
  if (!contact) throw new NotFoundError('Contact');

  await writeAuditLog({
    tenantId,
    userId,
    action:     'contact.updated',
    entityType: 'Contact',
    entityId:   id,
  });

  return contact;
}

export async function archiveContact(id: string, tenantId: string, userId: string) {
  const contact = await repo.archiveContact(id, tenantId);
  if (!contact) throw new NotFoundError('Contact');

  await writeAuditLog({
    tenantId,
    userId,
    action:     'contact.archived',
    entityType: 'Contact',
    entityId:   id,
  });

  return contact;
}
