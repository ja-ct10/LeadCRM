import * as repo from './companies.repository';
import { writeAuditLog, buildChangeset } from '../../../core/audit/audit.service';
import { NotFoundError } from '../../../shared/errors/http-error';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto';
import { paginate } from '../../../shared/helpers/pagination';

export async function getCompanies(tenantId: string, query: Record<string, unknown>) {
  const result = await repo.findAllCompanies(tenantId, query);
  return paginate(result.data, result.total, { page: result.page, limit: result.limit });
}

export async function getCompanyById(id: string, tenantId: string) {
  const company = await repo.findCompanyById(id, tenantId);
  if (!company) throw new NotFoundError('Company');
  return company;
}

export async function createCompany(tenantId: string, userId: string, dto: CreateCompanyDto) {
  const company = await repo.createCompany(tenantId, dto);
  await writeAuditLog({
    tenantId, userId,
    action: 'account.created', entityType: 'Account', entityId: company.id,
    after: { name: dto.name, industry: dto.industry },
  });
  return company;
}

export async function updateCompany(
  id: string, tenantId: string, userId: string, dto: UpdateCompanyDto,
) {
  const before = await repo.findCompanyById(id, tenantId);
  if (!before) throw new NotFoundError('Company');

  const company = await repo.updateCompany(id, tenantId, dto);
  if (!company) throw new NotFoundError('Company');

  const { before: cb, after: ca } = buildChangeset(
    before as unknown as Record<string, unknown>,
    company as unknown as Record<string, unknown>,
  );
  await writeAuditLog({
    tenantId, userId,
    action: 'account.updated', entityType: 'Account', entityId: id,
    before: cb, after: ca,
  });
  return company;
}

export async function archiveCompany(id: string, tenantId: string, userId: string) {
  const company = await repo.archiveCompany(id, tenantId, userId);
  if (!company) throw new NotFoundError('Company');
  await writeAuditLog({
    tenantId, userId,
    action: 'account.archived', entityType: 'Account', entityId: id,
    after: { isArchived: true },
  });
  return company;
}
