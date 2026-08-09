import * as repo from './companies.repository';
import { writeAuditLog, buildChangeset } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { CreateAccountDto, UpdateAccountDto } from './companies.dto';
import { paginate } from '../../../shared/helpers/pagination';

export async function getCompanies(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllCompanies(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getAccountById(id: string, tenantId: string) {
  const account = await repo.findAccountById(id, tenantId);
  if (!account) throw new NotFoundError('Account');
  return account;
}

export async function createAccount(tenantId: string, userId: string, dto: CreateAccountDto) {
  const account = await repo.createAccount(tenantId, dto);
  await writeAuditLog({
    tenantId, userId,
    action: 'account.created', entityType: 'Account', entityId: account.id,
    after: { name: dto.name, industry: dto.industry },
  });
  return account;
}

export async function updateAccount(
  id: string, tenantId: string, userId: string, dto: UpdateAccountDto,
) {
  const before = await repo.findAccountById(id, tenantId);
  if (!before) throw new NotFoundError('Account');

  const account = await repo.updateAccount(id, tenantId, dto);
  if (!account) throw new NotFoundError('Account');

  const { before: cb, after: ca } = buildChangeset(
    before as unknown as Record<string, unknown>,
    account as unknown as Record<string, unknown>,
  );
  await writeAuditLog({
    tenantId, userId,
    action: 'account.updated', entityType: 'Account', entityId: id,
    before: cb, after: ca,
  });
  return account;
}

export async function archiveAccount(id: string, tenantId: string, userId: string) {
  const account = await repo.archiveAccount(id, tenantId, userId);
  if (!account) throw new NotFoundError('Account');
  await writeAuditLog({
    tenantId, userId,
    action: 'account.archived', entityType: 'Account', entityId: id,
    after: { isArchived: true },
  });
  return account;
}
