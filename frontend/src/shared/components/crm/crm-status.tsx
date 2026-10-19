import React from 'react';
import { StatusBadge } from './record-drawer';
import { CRM_STATUSES, normalizeCrmStatus, CUSTOMER_STATUS_HELP, type CrmStatus } from '@leadcrm/shared';

// Preserve the existing Leads table palette and presentation for both modules.
export const CRM_STATUS_DOT_COLORS: Record<CrmStatus, string> = {
  Inquiry: '#64748b',
  Hot: '#ef4444',
  Warm: '#f59e0b',
  Cold: '#3b82f6',
  'Closed Deal': '#8b5cf6',
  Cancelled: '#6b7280',
};

export function CrmStatusIndicator({ status }: { status?: string }) {
  const label = normalizeCrmStatus(status);
  return <span title={CUSTOMER_STATUS_HELP[label]} className="flex items-center gap-1.5 min-w-0">
    <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CRM_STATUS_DOT_COLORS[label] }} />
    <span className="text-[13px] text-[#3C4858] dark:text-slate-300 truncate">{label}</span>
  </span>;
}

// Status configuration shared by the legacy record-detail surfaces.
const CRM_DETAIL_VARIANTS = { Inquiry: 'neutral', Hot: 'danger', Warm: 'warning', Cold: 'neutral', 'Closed Deal': 'info', Cancelled: 'neutral' } as const;
export const CRM_DETAIL_STATUSES = CRM_STATUSES.map(value => ({ value, label: value, variant: CRM_DETAIL_VARIANTS[value] }));

export function CrmStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <StatusBadge label="Status unavailable" variant="neutral" dot={false} />;
  const value = normalizeCrmStatus(status);
  const variants = { Inquiry: 'neutral', Hot: 'danger', Warm: 'warn', Cold: 'info', 'Closed Deal': 'purple', Cancelled: 'neutral' } as const;
  return <StatusBadge label={value} variant={variants[value]} />;
}
