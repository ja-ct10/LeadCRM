/**
 * Duplicate Detection types — shared interfaces for the duplicate detection module.
 */

export type DuplicateEntityType = 'lead' | 'contact' | 'account';
export type DuplicateConfidence = 'HIGH' | 'MEDIUM';

export interface DuplicateMatch {
  id: string;
  entityType: DuplicateEntityType;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  status?: string;
  confidence: DuplicateConfidence;
  matchedFields: string[];
}

export interface DuplicateCheckResult {
  matches: DuplicateMatch[];
}

export interface DuplicateCheckParams {
  tenantId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  excludeId?: string;
  entityTypes: DuplicateEntityType[];
}
