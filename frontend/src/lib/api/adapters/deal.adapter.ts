'use client';

/**
 * Converts a frontend priority string to backend enum value.
 * @param priority - The frontend priority ('Low', 'Medium', 'High')
 * @returns The backend priority string ('LOW', 'MEDIUM', 'HIGH')
 */
export function toBackendPriority(priority?: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (!priority) return 'MEDIUM';
  switch (priority.toLowerCase()) {
    case 'low': return 'LOW';
    case 'high': return 'HIGH';
    case 'medium':
    default: return 'MEDIUM';
  }
}

/**
 * Converts a backend priority string to frontend enum value.
 * @param priority - The backend priority ('LOW', 'MEDIUM', 'HIGH')
 * @returns The frontend priority string ('Low', 'Medium', 'High')
 */
export function toFrontendPriority(priority?: string): 'Low' | 'Medium' | 'High' {
  if (!priority) return 'Medium';
  switch (priority.toUpperCase()) {
    case 'LOW': return 'Low';
    case 'HIGH': return 'High';
    case 'MEDIUM':
    default: return 'Medium';
  }
}

/**
 * Converts a plain date string ("YYYY-MM-DD") or ISO datetime to a full ISO 8601 datetime.
 * Required because the backend uses z.string().datetime() which rejects date-only strings.
 */
function toISODatetime(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  // Already a full ISO datetime
  if (value.includes('T')) return value;
  // Plain date "YYYY-MM-DD" → append midnight UTC
  return `${value}T00:00:00.000Z`;
}

/**
 * Maps and formats fields, and strips frontend-only properties.
 * 
 * @param data - Partial frontend deal data
 * @returns Object formatted for backend CreateDealDto
 */
export function toBackendCreateDeal(data: Partial<any>): any {
  return {
    pipelineId: data.pipelineId || '',
    stageId: data.stageId || '',
    title: data.title || 'Untitled Deal',
    value: typeof data.value === 'number' ? data.value : undefined,
    currency: 'PHP', // Default currency as per DTO
    priority: toBackendPriority(data.priority),
    expectedCloseDate: toISODatetime(data.expectedCloseDate),
    description: data.description || undefined,
    leadSource: data.leadSource || undefined,
    organizationId: data.companyId || data.organizationId || undefined,
    assignedUserId: data.assignedUserId || undefined,
    contactIds: Array.isArray(data.contactIds) 
      ? data.contactIds 
      : (data.contactId ? [data.contactId] : undefined),
  };
}

/**
 * Prepares frontend deal data for updates in the backend API.
 * Maps and formats fields, ensuring only provided fields are included.
 * 
 * @param data - Partial frontend deal data
 * @returns Object formatted for backend UpdateDealDto
 */
export function toBackendUpdateDeal(data: Partial<any>): any {
  const updateData: any = {};

  // Only include ID fields when they have a non-empty value — the backend
  // schema uses z.string().uuid() which rejects empty strings outright.
  if (data.pipelineId) updateData.pipelineId = data.pipelineId;
  if (data.stageId) updateData.stageId = data.stageId;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.value !== undefined) updateData.value = data.value;
  if (data.priority !== undefined) updateData.priority = toBackendPriority(data.priority);
  if (data.expectedCloseDate !== undefined) updateData.expectedCloseDate = toISODatetime(data.expectedCloseDate);
  if (data.description !== undefined) updateData.description = data.description;
  if (data.leadSource !== undefined) updateData.leadSource = data.leadSource;

  // Strip empty strings for optional UUID fields
  const orgId = data.companyId || data.organizationId;
  if (orgId) updateData.organizationId = orgId;

  if (data.assignedUserId) updateData.assignedUserId = data.assignedUserId;

  // Strip empty contact IDs from the array before sending
  if (data.contactIds !== undefined) {
    const filtered = data.contactIds.filter(Boolean);
    if (filtered.length > 0) updateData.contactIds = filtered;
  } else if (data.contactId) {
    updateData.contactIds = [data.contactId];
  }

  return updateData;
}

/**
 * Maps a backend deal response to the frontend Deal type structure.
 * Handles derived fields, nested relations, and supplies safe defaults.
 * 
 * @param backendDeal - The deal object returned from the backend API
 * @returns Formatted frontend Deal object
 */
export function toFrontendDeal(backendDeal: any): any {
  if (!backendDeal) return null;

  // Derive company name
  const companyName = backendDeal.organization?.name || '';
  
  // Derive contact person and contact IDs from contactDeals relation
  let contactPerson = '';
  let contactIds: string[] = [];
  
  if (backendDeal.contactDeals && Array.isArray(backendDeal.contactDeals)) {
    contactIds = backendDeal.contactDeals
      .map((cd: any) => cd?.contact?.id)
      .filter(Boolean);
      
    const firstContact = backendDeal.contactDeals[0]?.contact;
    if (firstContact) {
      contactPerson = [firstContact.firstName, firstContact.lastName]
        .filter(Boolean)
        .join(' ') || firstContact.email || '';
    }
  }

  // Process history and find last stage change date
  let history: any[] = [];
  let lastStageChangeDate: string | undefined = undefined;
  
  if (backendDeal.stageHistories && Array.isArray(backendDeal.stageHistories)) {
    history = backendDeal.stageHistories.map((sh: any) => ({
      stageId: sh.newStage?.id || '',
      previousStageId: sh.previousStage?.id || undefined,
      timestamp: sh.movedAt || new Date().toISOString(),
      userId: sh.movedBy?.id || '',
      note: sh.note || undefined
    }));
    
    if (history.length > 0) {
      const dates = history.map(h => new Date(h.timestamp).getTime());
      const maxDate = new Date(Math.max(...dates));
      lastStageChangeDate = maxDate.toISOString();
    }
  }

  return {
    id: backendDeal.id || '',
    tenantId: backendDeal.tenantId || '',
    pipelineId: backendDeal.pipelineId || '',
    stageId: backendDeal.stageId || '',
    title: backendDeal.title || 'Untitled Deal',
    organizationId: backendDeal.organizationId || backendDeal.organization?.id || undefined,
    contactId: contactIds.length > 0 ? contactIds[0] : undefined,
    contactIds: contactIds,
    companyId: backendDeal.organizationId || backendDeal.organization?.id || undefined,
    companyName: companyName,
    contactPerson: contactPerson,
    value: typeof backendDeal.value === 'number' ? backendDeal.value : 0,
    priority: toFrontendPriority(backendDeal.priority),
    expectedCloseDate: backendDeal.expectedCloseDate || '',
    description: backendDeal.description || '',
    assignedUserId: backendDeal.assignedUserId || backendDeal.ownerId || '',
    lostReason: backendDeal.lostReason || undefined,
    order: typeof backendDeal.order === 'number' ? backendDeal.order : 0,
    createdAt: backendDeal.createdAt || new Date().toISOString(),
    updatedAt: backendDeal.updatedAt || undefined,
    lastStageChangeDate: lastStageChangeDate,
    leadSource: backendDeal.leadSource || undefined,
    industry: backendDeal.industry || undefined,
    
    // Frontend-only or unmapped backend fields default setups
    location: undefined,
    campaign: undefined,
    customerType: undefined,
    tags: Array.isArray(backendDeal.tags) ? backendDeal.tags.join(', ') : (backendDeal.tags || undefined),
    isArchived: !!backendDeal.isArchived,
    history: history,
    activities: [],
    ownershipHistory: []
  };
}
