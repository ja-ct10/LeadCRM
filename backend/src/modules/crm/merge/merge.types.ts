/**
 * Merge module types — interfaces for the record merge functionality.
 */

export type MergeEntityType = 'lead' | 'contact' | 'account';

export interface MergePreviewParams {
  tenantId: string;
  entityType: MergeEntityType;
  primaryId: string;
  secondaryId: string;
}

export interface MergeExecuteParams {
  tenantId: string;
  userId: string;
  entityType: MergeEntityType;
  primaryId: string;
  secondaryId: string;
  fieldResolutions: Record<string, 'primary' | 'secondary'>;
}

export interface FieldComparison {
  field: string;
  primaryValue: unknown;
  secondaryValue: unknown;
  isDifferent: boolean;
}

export interface RelationshipCounts {
  activities: number;
  tasks: number;
  deals: number;
  leads?: number;      // for account merge
  contacts?: number;   // for account merge
  campaigns?: number;
  invoices?: number;
}

export interface MergePreviewResult {
  primary: Record<string, unknown>;
  secondary: Record<string, unknown>;
  fieldComparisons: FieldComparison[];
  relationshipCounts: {
    primary: RelationshipCounts;
    secondary: RelationshipCounts;
  };
}

export interface MergeExecuteResult {
  mergedRecord: Record<string, unknown>;
  archivedRecordId: string;
  reassignedCounts: RelationshipCounts;
}
