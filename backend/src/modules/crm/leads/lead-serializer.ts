import { normalizeCrmStatus, type LeadRead, type LeadUserSummary } from '@leadcrm/shared';
import type { Lead as StoredLead } from '@prisma/client';
type LeadProjectionSource = Omit<StoredLead, 'companyFromAccount'> & {
  lastSalesActivityAt?: Date;
  assignedUser?: LeadUserSummary | null; account?: { id: string; name: string } | null;
  createdBy?: LeadUserSummary | null; updatedBy?: LeadUserSummary | null;
};

/** Product arrays are canonical projections from core/tenant/product-projections.
 * Migration flags, retry keys and engagement state stay internal.
 */
export function serializeLead(lead: LeadProjectionSource): LeadRead {
  return {
    id: lead.id, tenantId: lead.tenantId, firstName: lead.firstName, lastName: lead.lastName,
    email: lead.email, phone: lead.phone, companyName: lead.companyName, address: lead.address, source: lead.source,
    accountId: lead.accountId, assignedUserId: lead.assignedUserId, status: normalizeCrmStatus(lead.status), manualCancellation: lead.manualCancellation,
    firstStaffOutreachAt: lead.firstStaffOutreachAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(), updatedAt: lead.updatedAt.toISOString(),
    ...(lead.lastSalesActivityAt ? { lastSalesActivityAt: lead.lastSalesActivityAt.toISOString() } : {}),
    createdById: lead.createdById, updatedById: lead.updatedById, lastStatusChangedAt: lead.lastStatusChangedAt?.toISOString() ?? null,
    contactId: lead.contactId, convertedAt: lead.convertedAt?.toISOString() ?? null, convertedById: lead.convertedById,
    isArchived: lead.isArchived, deletedAt: lead.deletedAt?.toISOString() ?? null, deletedBy: lead.deletedBy,
    assignedUser: lead.assignedUser, account: lead.account, createdBy: lead.createdBy, updatedBy: lead.updatedBy,
    productInterestIds: lead.productInterestIds, productInterest: lead.productInterest, productInterests: lead.productInterest,
  };
}
