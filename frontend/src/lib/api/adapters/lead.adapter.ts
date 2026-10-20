import { formatLeadName, normalizeCrmStatus, type LeadRead } from '@leadcrm/shared';
import type { Lead } from '@/store/types';

/** Convert only the real public projection; canonical name fields are never reconstructed. */
export function toFrontendLead(lead: LeadRead): Lead {
  return {
    id: lead.id, tenantId: lead.tenantId, firstName: lead.firstName ?? '', lastName: lead.lastName ?? '',
    contactPerson: formatLeadName(lead), email: lead.email ?? undefined, phone: lead.phone ?? undefined,
    companyName: lead.companyName ?? undefined, address: lead.address ?? undefined, source: lead.source ?? undefined,
    leadSource: lead.source ?? undefined, accountId: lead.accountId ?? undefined, organizationId: lead.accountId ?? undefined,
    assignedUserId: lead.assignedUserId ?? undefined, assignedUser: lead.assignedUser ?? undefined,
    account: lead.account ?? undefined,
    productInterestIds: lead.productInterestIds ?? [], productInterests: lead.productInterest ?? [], productInterest: lead.productInterest ?? [],
    status: normalizeCrmStatus(lead.status), createdAt: lead.createdAt, updatedAt: lead.updatedAt,
    lastSalesActivityAt: lead.lastSalesActivityAt,
    createdById: lead.createdById ?? undefined, updatedById: lead.updatedById ?? undefined,
    createdByUser: lead.createdBy ?? undefined, updatedByUser: lead.updatedBy ?? undefined,
    firstStaffOutreachAt: lead.firstStaffOutreachAt,
    lastStatusChangedAt: lead.lastStatusChangedAt ?? undefined,
    contactId: lead.contactId ?? undefined, convertedAt: lead.convertedAt ?? undefined, convertedById: lead.convertedById ?? undefined,
    isArchived: lead.isArchived, deletedAt: lead.deletedAt, deletedBy: lead.deletedBy,
  };
}
