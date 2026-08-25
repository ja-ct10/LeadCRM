/**
 * Shared type definitions for entity-specific record detail page configurations.
 * Each CRM entity (Lead, Contact, Account, Deal) exports a config conforming to this shape.
 */

import type { LucideIcon } from 'lucide-react';
import type { PermissionKey } from '@leadcrm/shared';
import type { FieldSection } from './record-overview-tab';
import type { RelatedSectionConfig } from './record-related-tab';
import type { RecordModule } from '@/shared/hooks/use-record-detail';

export interface StatusConfig {
  value: string;
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface ActionConfigTemplate {
  id: string;
  label: string;
  icon: LucideIcon;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  permission?: PermissionKey;
  primary?: boolean;
}

export interface RecordDetailConfig {
  /** Module identifier */
  module: RecordModule;
  /** Permission module for RBAC (e.g., 'contacts' for leads) */
  permissionModule: string;
  /** Edit permission key */
  editPermission: PermissionKey;
  /** Delete permission key */
  deletePermission: PermissionKey;
  /** Available status options for this entity */
  statuses: StatusConfig[];
  /** Action button templates (onClick wired at page level) */
  actionTemplates: ActionConfigTemplate[];
  /** Activity filter key for the activities API */
  activityFilterKey: string;
  /** Whether to show pipeline progress bar in header (deals only) */
  headerExtra?: 'pipeline-progress';
  /** Build field sections from a record */
  buildFieldSections: (record: Record<string, unknown>, onSave: (key: string, value: unknown) => Promise<void>) => FieldSection[];
  /** Build related sections from relationships data */
  buildRelatedSections: (relationships: Record<string, unknown> | null) => Omit<RelatedSectionConfig, 'onAdd'>[];
}
