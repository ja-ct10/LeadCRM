'use client';

/**
 * Converts a frontend status string to a backend status string (UPPERCASE).
 * Default fallback is 'WARM'.
 * 
 * @param {string | undefined} status Frontend status (e.g., 'Hot', 'Warm', 'Cold')
 * @returns {string} Backend status (e.g., 'HOT', 'WARM', 'COLD')
 */
export function toBackendStatus(status?: string): string {
  if (!status) return 'WARM';
  const upper = status.toUpperCase();
  if (['HOT', 'WARM', 'COLD', 'CANCELLED', 'CLOSED'].includes(upper)) {
    return upper;
  }
  return 'WARM';
}

/**
 * Converts a backend status string to a frontend status string (Title Case).
 * Default fallback is 'Warm'.
 * 
 * @param {string | undefined} status Backend status (e.g., 'HOT', 'WARM', 'COLD')
 * @returns {string} Frontend status (e.g., 'Hot', 'Warm', 'Cold')
 */
export function toFrontendStatus(status?: string): string {
  if (!status) return 'Warm';
  const upper = status.toUpperCase();
  switch (upper) {
    case 'HOT': return 'Hot';
    case 'WARM': return 'Warm';
    case 'COLD': return 'Cold';
    case 'CANCELLED': return 'Cancelled';
    case 'CLOSED': return 'Closed';
    default: return 'Warm';
  }
}

/**
 * Splits a full name into first and last name.
 * 
 * @param {string} fullName The full name string
 * @returns {{ firstName: string, lastName: string }} First and last name parts
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: 'Unknown', lastName: 'Unknown' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Unknown' };
  const lastName = parts.pop() || 'Unknown';
  const firstName = parts.join(' ') || 'Unknown';
  return { firstName, lastName };
}

/**
 * Prepares frontend Contact data for backend creation (CreateContactDto).
 * Maps field names and drops frontend-only properties.
 * 
 * @param {Partial<any>} data Frontend contact data
 * @returns {Record<string, any>} Data formatted for backend creation
 */
export function toBackendCreateContact(data: Record<string, any>): Record<string, any> {
  const { firstName, lastName } = data.contactPerson 
    ? splitName(data.contactPerson) 
    : { 
        firstName: data.firstName || 'Unknown', 
        lastName: data.lastName || 'Unknown' 
      };

  return {
    firstName,
    lastName,
    email: data.email || undefined,
    phone: data.phone || undefined,
    company: data.companyName || undefined,
    jobTitle: data.jobTitle || undefined,
    linkedinUrl: data.linkedin || undefined,
    status: toBackendStatus(data.status),
    score: typeof data.score === 'number' ? data.score : undefined,
    source: data.leadSource || undefined,
    notes: data.notes || undefined,
    doNotContact: !!data.doNotContact,
    organizationId: data.organizationId || undefined,
    assignedUserId: data.assignedUserId || undefined,
    productInterest: data.productInterest || undefined,
    address: data.address || undefined,
  };
}

/**
 * Prepares frontend Contact data for backend update (UpdateContactDto).
 * Only includes fields that are present, translating keys appropriately.
 * 
 * @param {Partial<any>} data Frontend contact data
 * @returns {Record<string, any>} Data formatted for backend update
 */
export function toBackendUpdateContact(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  if (data.contactPerson !== undefined || data.firstName !== undefined || data.lastName !== undefined) {
    if (data.contactPerson) {
      const { firstName, lastName } = splitName(data.contactPerson);
      result.firstName = firstName;
      result.lastName = lastName;
    } else {
      if (data.firstName !== undefined) result.firstName = data.firstName;
      if (data.lastName !== undefined) result.lastName = data.lastName;
    }
  }

  if (data.email !== undefined) result.email = data.email || undefined;
  if (data.phone !== undefined) result.phone = data.phone || undefined;
  if (data.companyName !== undefined) result.company = data.companyName || undefined;
  if (data.jobTitle !== undefined) result.jobTitle = data.jobTitle || undefined;
  if (data.linkedin !== undefined) result.linkedinUrl = data.linkedin || undefined;
  if (data.status !== undefined) result.status = toBackendStatus(data.status);
  if (data.score !== undefined) result.score = data.score;
  if (data.leadSource !== undefined) result.source = data.leadSource || undefined;
  if (data.notes !== undefined) result.notes = data.notes || undefined;
  if (data.doNotContact !== undefined) result.doNotContact = !!data.doNotContact;
  if (data.organizationId !== undefined) result.organizationId = data.organizationId || undefined;
  if (data.assignedUserId !== undefined) result.assignedUserId = data.assignedUserId || undefined;
  if (data.productInterest !== undefined) result.productInterest = data.productInterest || undefined;
  if (data.address !== undefined) result.address = data.address || undefined;

  return result;
}

/**
 * Translates backend contact response into frontend Contact type.
 * Handles missing fields with safe defaults.
 * 
 * @param {any} backendContact Backend contact object
 * @returns {Record<string, any>} Frontend Contact object
 */
export function toFrontendContact(backendContact: any): Record<string, any> {
  if (!backendContact) return {};

  const firstName = backendContact.firstName || '';
  const lastName = backendContact.lastName || '';
  const contactPerson = [firstName, lastName].filter(Boolean).join(' ');

  return {
    id: backendContact.id || '',
    tenantId: backendContact.tenantId || '',
    organizationId: backendContact.organizationId || undefined,
    companyName: backendContact.company || '',
    contactPerson: contactPerson || 'Unknown',
    firstName,
    lastName,
    jobTitle: backendContact.jobTitle || '',
    email: backendContact.email || '',
    phone: backendContact.phone || '',
    productInterest: backendContact.productInterest || '', 
    leadSource: backendContact.source || '',
    estimatedValue: 0, // Frontend only
    assignedUserId: backendContact.assignedUserId || '',
    expectedCloseDate: '', // Frontend only
    notes: backendContact.notes || '',
    status: toFrontendStatus(backendContact.status),
    score: typeof backendContact.score === 'number' ? backendContact.score : 0,
    createdAt: backendContact.createdAt || new Date().toISOString(),
    isArchived: !!backendContact.isArchived,
    archivedAt: backendContact.deletedAt || undefined,
    archivedBy: backendContact.deletedBy || undefined,
    linkedin: backendContact.linkedinUrl || '',
    customerType: backendContact.organizationId ? 'Organization' : 'Individual',
    address: backendContact.address || '', 
    // Populate nested fields optionally if needed
    organization: backendContact.organization || undefined,
    assignedUser: backendContact.assignedUser || undefined,
  };
}
