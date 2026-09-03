import prisma from '../../../config/database.config';
import { getPaginationParams } from '../../../shared/helpers/pagination';

/**
 * Contacts V2 Repository — queries the Contact table.
 *
 * Field mapping (schema ↔ DB):
 *   company        → Contact.company       (plain text, company name)
 *   accountId      → Contact.accountId      (FK → Account.id)  ← CANONICAL company link (ADR-001)
 *   organizationId → Contact.organizationId (FK → Organization.id)  ← DEPRECATED (contract phase removes it)
 *   status         → ContactStatus enum    (HOT | WARM | COLD | CANCELLED | CLOSED)
 *   productInterests → String[]
 *   isArchived     → Boolean (archive = set isArchived:true, not status change)
 *
 * Compatibility: a client-supplied `organizationId` is accepted as a DEPRECATED input alias
 * and resolved to the canonical `accountId`. The stored/authoritative value is `accountId`.
 */

// ── Shared include shape ───────────────────────────────────────────────────
const CONTACT_INCLUDE = {
  assignedUser: { select: { id: true, firstName: true, lastName: true } },
  account:      { select: { id: true, name: true } },
  organization: { select: { id: true, name: true } },
} as const;

/**
 * Normalize a write DTO: treat a legacy `organizationId` as a deprecated alias for the
 * canonical `accountId`. If both are present, `accountId` wins. The alias key is stripped
 * so no new writes populate `organizationId`.
 */
function normalizeCompanyAlias(dto: Record<string, unknown>): Record<string, unknown> {
  const next = { ...dto };
  if (next.accountId == null && next.organizationId != null) {
    next.accountId = next.organizationId;
  }
  delete next.organizationId;
  return next;
}

export async function findAllContacts(tenantId: string, query: Record<string, unknown>) {
  const { page, limit } = getPaginationParams(query);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    tenantId,
    isArchived: false,
  };

  // Status filter — value must be a valid ContactStatus enum member
  if (query.status) {
    where['status'] = String(query.status);
  }

  if (query.assignedUserId) {
    where['assignedUserId'] = String(query.assignedUserId);
  }

  // Canonical company filter. `organizationId` accepted as a deprecated alias for accountId.
  if (query.accountId) {
    where['accountId'] = String(query.accountId);
  } else if (query.organizationId) {
    where['accountId'] = String(query.organizationId);
  }

  if (query.lifecycleStage) {
    where['lifecycleStage'] = String(query.lifecycleStage);
  }

  // Full-text search across name, email, company, phone
  if (query.search) {
    const term = String(query.search);
    where['OR'] = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName:  { contains: term, mode: 'insensitive' } },
      { email:     { contains: term, mode: 'insensitive' } },
      { company:   { contains: term, mode: 'insensitive' } },
      { phone:     { contains: term, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.contact.findMany({
      where: where as never,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: CONTACT_INCLUDE,
    }),
    prisma.contact.count({ where: where as never }),
  ]);

  return { data, total, page, limit };
}

export async function findContactById(id: string, tenantId: string) {
  return prisma.contact.findFirst({
    where: { id, tenantId, isArchived: false },
    include: CONTACT_INCLUDE,
  });
}

export async function createContact(tenantId: string, dto: Record<string, unknown>) {
  return prisma.contact.create({
    data: { ...normalizeCompanyAlias(dto), tenantId } as never,
    include: CONTACT_INCLUDE,
  });
}

export async function updateContact(id: string, tenantId: string, dto: Record<string, unknown>) {
  try {
    return await prisma.contact.update({
      where:   { id, tenantId } as never,
      data:    normalizeCompanyAlias(dto) as never,
      include: CONTACT_INCLUDE,
    });
  } catch {
    return null;
  }
}

export async function archiveContact(id: string, tenantId: string) {
  try {
    return await prisma.contact.update({
      where: { id, tenantId } as never,
      data:  { isArchived: true, archiveReason: 'Archived by user' },
    });
  } catch {
    return null;
  }
}
