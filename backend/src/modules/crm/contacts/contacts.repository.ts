import { parseLeadCreatedFilter } from '../leads/lead-created-filter';
import { sortedPageIds, orderPage } from '../../../shared/helpers/sorted-page';
import prisma from '../../../config/database.config';
import { resolveProducts, createAssignedLead, salesTransaction, createProductDeals, validateSalesOwner } from '../leads/lead-automation.service';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { getPaginationParams } from '../../../shared/helpers/pagination';
import { parseFilterParams, buildPrismaFilters } from '../../../shared/helpers/filter-parser';

// Allowed filter fields for leads/contacts — prevents arbitrary Prisma field injection
const CONTACT_FILTER_FIELDS = new Set(['status', 'source', 'leadSource', 'assignedUserId', 'accountId']);
// Map frontend field names → Prisma field names where they differ
const CONTACT_FIELD_ALIASES: Record<string, string> = {
  source: 'source',          // frontend sends 'source' (maps from leadSource client-side)
  leadSource: 'source',      // alternate frontend key
  assignedUserId: 'assignedUserId',
};

// All queries are scoped to tenantId — cross-tenant access is impossible by design
export async function findAllContacts(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  // Parse filter[field]=operator:value params from the query string
  const parsedFilters = parseFilterParams(query);
  const filterClauses = buildPrismaFilters(parsedFilters, CONTACT_FILTER_FIELDS, CONTACT_FIELD_ALIASES);

  const createdAt = parseLeadCreatedFilter(query);
  const where: Record<string, unknown> = {
    ...(createdAt ? { createdAt } : {}),
    tenantId,
    isArchived: query.archived === 'true',
    // accountId direct param (still used by relationship lookups)
    ...(query.accountId ? { accountId: String(query.accountId) } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName:   { contains: String(query.search), mode: 'insensitive' as const } },
            { lastName:    { contains: String(query.search), mode: 'insensitive' as const } },
            { email:       { contains: String(query.search), mode: 'insensitive' as const } },
            { companyName: { contains: String(query.search), mode: 'insensitive' as const } },
          ],
        }
      : {}),
    // filter[field]=operator:value clauses — all AND-combined at query level
    ...(filterClauses.length > 0 ? { AND: filterClauses } : {}),
  };

  const ids = await sortedPageIds(query.sort, ["firstName","email","phone","companyName","status","source","createdAt","updatedAt"], skip, limit,
    () => prisma.lead.findMany({ where, select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true, status: true, source: true, createdAt: true, updatedAt: true } }));
  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where: ids ? { ...where, id: { in: ids } } : where, skip: ids ? 0 : skip, take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        account:      { select: { id: true, name: true } },
        createdBy:    { select: { id: true, firstName: true, lastName: true } },
        updatedBy:    { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { data: orderPage(data, ids), total, page, limit };
}

export async function findContactById(id: string, tenantId: string) {
  return prisma.lead.findFirst({
    where: { id, tenantId },
    include: {
      assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      account:      { select: { id: true, name: true, industry: true } },
      createdBy:    { select: { id: true, firstName: true, lastName: true } },
      updatedBy:    { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function createContact(
  tenantId: string,
  dto: CreateContactDto,
  createdById?: string,
) {
  const { requestId, productInterest, ...fields } = dto;
  return salesTransaction(tx => createAssignedLead(tx, { ...fields, productInterestIds: productInterest ?? [], tenantId, creationKey: requestId,
    ...(createdById ? { createdById, updatedById: createdById } : {}) }, createdById));
}

export async function updateContact(
  id: string,
  tenantId: string,
  dto: UpdateContactDto,
  updatedById?: string,
  prevStatus?: string,
) {
  try {
    const data: Record<string, unknown> = { ...dto };
    if (updatedById) data.updatedById = updatedById;
    // Stamp lastStatusChangedAt when status actually changes
    if (dto.status && prevStatus !== undefined && dto.status !== prevStatus) {
      data.lastStatusChangedAt = new Date();
    }
    return await salesTransaction(async tx => {
      if (dto.productInterest) {
        const previous = await tx.lead.findFirstOrThrow({ where: { id, tenantId } });
        const retained = previous.productInterestIds.filter(id => dto.productInterest!.includes(id));
        const added = dto.productInterest.filter(id => !retained.includes(id));
        const products = await resolveProducts(tx, tenantId, added);
        const existing = await tx.productInterest.findMany({ where: { tenantId, id: { in: retained } } });
        // Keep legacy snapshots that predate catalog IDs when adding a first configured product.
        const historicalNames = previous.productInterestIds.length ? [] : previous.productInterest;
        data.productInterestIds = [...retained, ...products.map(p => p.id)];
        data.productInterest = [...historicalNames, ...existing.map(p => p.name), ...products.map(p => p.name)];
      }
      if (dto.assignedUserId) await validateSalesOwner(tx, tenantId, dto.assignedUserId);
      const updated = await tx.lead.update({
      where: { id, tenantId },
      data,
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        account:      { select: { id: true, name: true } },
        createdBy:    { select: { id: true, firstName: true, lastName: true } },
        updatedBy:    { select: { id: true, firstName: true, lastName: true } },
      },
    });
      if (updatedById && dto.status && dto.status !== prevStatus) await tx.activity.create({ data: {
        tenantId, createdById: updatedById, leadId: id, type: 'stage_change', title: `Status changed from ${prevStatus} to ${dto.status}`,
      } });
      if (dto.assignedUserId || dto.productInterest) await createProductDeals(tx, tenantId, id, updatedById);
      return updated;
    });
  } catch (error) {
    throw error;
  }
}

export async function archiveContact(id: string, tenantId: string, userId: string) {
  return prisma.lead.updateMany({
    where: { id, tenantId, isArchived: false },
    data: { isArchived: true, deletedAt: new Date(), deletedBy: userId },
  });
}

export async function restoreContact(id: string, tenantId: string) {
  const lead = await prisma.lead.findFirst({ where: { id, tenantId, isArchived: true } });
  if (!lead) return { count: 0 };
  return prisma.lead.updateMany({
    where: { id, tenantId, isArchived: true },
    // Legacy archives have no recoverable prior status.
    data: { isArchived: false, deletedAt: null, deletedBy: null,
      ...(lead.status === 'Archived' ? { status: 'Warm' } : {}) },
  });
}
