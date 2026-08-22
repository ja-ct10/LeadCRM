import * as repo from './contacts-v2.repository';
import { NotFoundError } from '../../../shared/errors/http-error';
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

export async function createContact(tenantId: string, dto: Record<string, unknown>) {
  return repo.createContact(tenantId, dto);
}

export async function updateContact(id: string, tenantId: string, dto: Record<string, unknown>) {
  const contact = await repo.updateContact(id, tenantId, dto);
  if (!contact) throw new NotFoundError('Contact');
  return contact;
}

export async function archiveContact(id: string, tenantId: string) {
  const contact = await repo.archiveContact(id, tenantId);
  if (!contact) throw new NotFoundError('Contact');
  return contact;
}
