import { salesContext } from '../leads/sales-context';
import { ACCOUNTS_TABLE_SORT_FIELDS } from '@leadcrm/shared';
import { RETIRED_ACCOUNT_FIELDS } from '@leadcrm/shared';
import { ValidationError } from '../../../shared/errors/http-error';
import { consolidateAccountAddress } from './account-address';
import { assertCrmRecordMutation } from '../access/crm-record-access.service';
import { salesTransaction } from '../leads/lead-automation.service';
import { saveRecordValues } from '../closing-requirements/custom-field-values.repository';
import { sortedPageIds, orderPage } from '../../../shared/helpers/sorted-page';
import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto';
import { buildSearchClauses } from '../../../shared/helpers/search';
import { parseFilterParams, buildPrismaFilters, type FilterFields } from '../../../shared/helpers/filter-parser';

// Allowed filter fields for accounts
const COMPANY_FILTER_FIELDS: FilterFields = {
  industry: { kind: 'text' }, address: { kind: 'text' }, size: { kind: 'choice' },
};
const COMPANY_FIELD_ALIASES: Record<string, string> = {
  type: 'size', // frontend filter sends 'type' (maps to size in Prisma)
};

// All queries scoped to tenantId — cross-tenant access is impossible by design

export async function findAllCompanies(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  // Parse filter[field]=operator:value params
  const parsedFilters = parseFilterParams(query);
  if (RETIRED_ACCOUNT_FIELDS.some(field => query[field] !== undefined) || parsedFilters.some(filter => RETIRED_ACCOUNT_FIELDS.some(field => field === filter.field) || filter.field === 'scope')) throw new ValidationError('Account assignment and product filters are retired.');
  const filterClauses = buildPrismaFilters(parsedFilters, COMPANY_FILTER_FIELDS, COMPANY_FIELD_ALIASES);
  filterClauses.push(...buildSearchClauses(query.search, ['name', 'industry', 'address', 'website']));

  const where = {
    tenantId,
    isArchived: query.archived === 'true',
    // Legacy direct params (backward compat)
    // filter[field]=operator:value clauses (AND-combined)
    ...(filterClauses.length > 0 ? { AND: filterClauses } : {}),
  };

  const ids = await sortedPageIds(query.sort, ACCOUNTS_TABLE_SORT_FIELDS, skip, limit,
    () => (salesContext.getStore() ?? prisma).account.findMany({ where, select: { id: true, name: true, industry: true, size: true, address: true, createdAt: true } }),
    direction => (salesContext.getStore() ?? prisma).account.findMany({ where, skip, take: limit, orderBy: [{ createdAt: direction }, { id: 'asc' }], select: { id: true } }));
  const [data, total] = await Promise.all([
    (salesContext.getStore() ?? prisma).account.findMany({
      where: ids ? { ...where, id: { in: ids } } : where, skip: ids ? 0 : skip, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }),
    (salesContext.getStore() ?? prisma).account.count({ where }),
  ]);

  return { data: orderPage(data, ids), total, page, limit };
}

export async function findCompanyById(id: string, tenantId: string) {
  return (salesContext.getStore() ?? prisma).account.findFirst({
    where: { id, tenantId },
  });
}

export async function createCompany(tenantId: string, dto: CreateCompanyDto, actorId?: string) {
  const { customFieldValues, ...data } = dto;
  return salesTransaction(async tx => {
    const account = await tx.account.create({ data: { ...data, address: consolidateAccountAddress(dto) ?? undefined, tenantId } });
    await saveRecordValues(tx, tenantId, 'accounts', account.id, customFieldValues, actorId);
    return account;
  });
}

export async function updateCompany(id: string, tenantId: string, dto: UpdateCompanyDto, actorId?: string) {
  return salesTransaction(async tx => {
    await assertCrmRecordMutation(tx, 'accounts', id, 'edit', dto);
    const { customFieldValues, ...data } = dto;
    await saveRecordValues(tx, tenantId, 'accounts', id, customFieldValues, actorId);
    return tx.account.update({ where: { id, tenantId }, data });
  });
}

export async function archiveCompany(id: string, tenantId: string, userId: string) {
  return (salesContext.getStore() ?? prisma).account.updateMany({
    where: { id, tenantId, isArchived: false },
    data: { isArchived: true, deletedAt: new Date(), deletedBy: userId },
  });
}

export async function restoreCompany(id: string, tenantId: string) {
  return (salesContext.getStore() ?? prisma).account.updateMany({
    where: { id, tenantId, isArchived: true },
    data: { isArchived: false, deletedAt: null, deletedBy: null },
  });
}
