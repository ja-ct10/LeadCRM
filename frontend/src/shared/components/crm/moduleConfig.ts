import type { LucideIcon } from 'lucide-react';
import React from 'react';

export type RecordModule = 'lead' | 'contact' | 'account' | 'deal';

export interface StatusOption {
  label: string;
  description?: string;
  tone?: 'info' | 'success' | 'warning' | 'muted';
}

export interface PipelineStage {
  id?: string;
  label: string;
  tone?: 'warning' | 'success' | 'muted';
  dot?: string;
  isWon?: boolean;
  isLost?: boolean;
}

export interface ActivityItem {
  id: string;
  kind: 'status' | 'task' | 'created' | 'note' | 'email' | 'call';
  title?: string;
  from?: string;
  to?: string;
  actor?: { name: string; initials: string };
  when: string;
  metadata?: Record<string, any>;
}

export interface FileItem {
  id: string;
  name: string;
  size: string;
  uploadedBy?: string;
  uploadedAt: string;
  type?: string;
  url?: string;
}

export interface FieldRow {
  label: string;
  value?: React.ReactNode;
  icon?: LucideIcon;
  editable?: boolean;
  onEdit?: () => void;
  onCopy?: () => void;
}

export interface SectionConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  count?: number;
  collapsible?: boolean;
  actions?: React.ReactNode;
  content: React.ReactNode;
}

export interface CustomFieldItem {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'url';
  value: string;
  description?: string;
}

// ── Default Status Configurations ─────────────────────────────────────────────

export const DEFAULT_LEAD_STATUSES: StatusOption[] = [
  { label: 'Inquiry', tone: 'info', description: 'Initial contact / inquiry made' },
  { label: 'Hot', tone: 'warning', description: 'High purchase intent, urgent' },
  { label: 'Warm', tone: 'warning', description: 'Engaged, evaluating solutions' },
  { label: 'Cold', tone: 'muted', description: 'Unresponsive or low priority' },
  { label: 'Closed', tone: 'success', description: 'Converted or deal finalized' },
  { label: 'Cancelled', tone: 'muted', description: 'Disqualified or canceled' },
];

export const DEFAULT_CONTACT_STATUSES: StatusOption[] = [
  { label: 'Inquiry', tone: 'info', description: 'Contact inquiry pending review' },
  { label: 'Qualified', tone: 'info', description: 'Verified buyer persona' },
  { label: 'Converted', tone: 'success', description: 'Active client contact' },
  { label: 'Archived', tone: 'muted', description: 'Historical record' },
];

export const DEFAULT_ACCOUNT_STATUSES: StatusOption[] = [
  { label: 'Prospect', tone: 'info', description: 'Prospective company account' },
  { label: 'Active Customer', tone: 'success', description: 'Ongoing contract or active services' },
  { label: 'Inactive Customer', tone: 'muted', description: 'Dormant account' },
  { label: 'Former Customer', tone: 'muted', description: 'Terminated or past customer' },
];

export const DEFAULT_PIPELINE = {
  name: 'Sales Pipeline',
  stages: [
    { label: 'Demo Completed', tone: 'warning' as const, dot: 'bg-warning' },
    { label: 'Proposal Sent', tone: 'warning' as const, dot: 'bg-warning' },
    { label: 'Contract Sent', tone: 'warning' as const, dot: 'bg-warning' },
    { label: 'Won', tone: 'success' as const, dot: 'bg-success', isWon: true },
    { label: 'Lost', tone: 'muted' as const, dot: 'bg-muted-foreground/40', isLost: true },
  ],
};
