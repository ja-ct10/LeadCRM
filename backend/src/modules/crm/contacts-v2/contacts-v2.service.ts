import * as repo from './contacts-v2.repository';
import { NotFoundError } from '../../../shared/errors/http-error';
import { paginate } from '../../../shared/helpers/pagination';
import { fireContactCreated, fireContactStatusChanged } from '../../automation/triggers/triggers.service';
import { writeAuditLog } from '../../../core/audit/audit.service';
import { createNotification } from '../../notifications/notifications.service';

export async function getContacts(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllContacts(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getContactById(id: string, tenantId: string) {
  const contact = await repo.findContactById(id, tenantId);
  if (!contact) throw new NotFoundError('Contact');
  return contact;
}

export async function createContact(tenantId: string, dto: Record<string, unknown>, actorId?: string) {
  const contact = await repo.createContact(tenantId, dto);
  if (actorId) {
    await writeAuditLog({ tenantId, userId: actorId, action: 'contact.created', entityType: 'Contact', entityId: contact.id });
    await fireContactCreated({ tenantId, actorId, contact });
  }
  return contact;
}

export async function updateContact(id: string, tenantId: string, dto: Record<string, unknown>, actorId?: string) {
  const before = await getContactById(id, tenantId);
  const contact = await repo.updateContact(id, tenantId, dto);
  if (!contact) throw new NotFoundError('Contact');
  if (actorId) {
    await writeAuditLog({ tenantId, userId: actorId, action: 'contact.updated', entityType: 'Contact', entityId: id });
    if (contact.status !== before.status) await fireContactStatusChanged({ tenantId, actorId, contact, prevStatus: before.status });
    if (contact.assignedUserId && contact.assignedUserId !== before.assignedUserId && contact.assignedUserId !== actorId) {
      await createNotification({ tenantId, userId: contact.assignedUserId, type: 'contact_assigned', title: 'Client Profile assigned to you', entityType: 'Contact', entityId: id });
    }
  }
  return contact;
}

export async function archiveContact(id: string, tenantId: string, userId: string) {
  const result = await repo.archiveContact(id, tenantId, userId);
  if (!result.count) throw new NotFoundError('Active Contact');
  await writeAuditLog({ tenantId, userId, action: 'contact.archived',
    entityType: 'Contact', entityId: id, after: { isArchived: true } });
}

export async function restoreContact(id: string, tenantId: string, userId: string) {
  const result = await repo.restoreContact(id, tenantId);
  if (!result.count) throw new NotFoundError('Archived Contact');
  await writeAuditLog({ tenantId, userId, action: 'contact.restored',
    entityType: 'Contact', entityId: id, after: { isArchived: false } });
}
