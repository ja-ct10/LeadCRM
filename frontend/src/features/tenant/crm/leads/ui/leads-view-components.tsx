/**
 * Leads View Components — extracted from leads-page.tsx for code quality (R23).
 * Contains: LeadsTileView, LeadsGridView, LeadsKanbanView, LeadDrawerOverview, LeadDrawerRelated.
 */

'use client';

import React, { useMemo } from 'react';
import { StatusBadge } from '@/shared/components/crm';
import type { Lead, Organization } from '@/store/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Tile View
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadsTileViewProps {
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  getInitials: (lead: Lead) => string;
  getLeadName: (lead: Lead) => string;
  getStatusVariant: (status: string) => 'success' | 'info' | 'warn' | 'danger' | 'purple' | 'neutral';
  formatCurrency: (value?: number) => string;
}

export function LeadsTileView({ leads, onCardClick, getInitials, getLeadName, getStatusVariant, formatCurrency }: LeadsTileViewProps): React.ReactElement {
  if (leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-[#5A6B85] dark:text-slate-400">
        No leads found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {leads.map((lead) => (
        <div
          key={lead.id}
          onClick={() => onCardClick(lead)}
          className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[#2563EB]/30 transition-all group"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
              {getInitials(lead)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate group-hover:text-[#2563EB] transition-colors">
                {getLeadName(lead)}
              </p>
              <p className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                {lead.companyName ?? lead.city ?? '—'}
              </p>
            </div>
            <StatusBadge label={lead.status} variant={getStatusVariant(lead.status)} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E4E9F0] dark:border-slate-700">
            <span className="text-[12px] text-[#5A6B85] dark:text-slate-400">
              Score: <strong className="text-[#0F172A] dark:text-white">{lead.score ?? 0}</strong>
            </span>
            <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
              {formatCurrency(lead.estimatedValue)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Grid View (4-up compact cards)
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadsGridViewProps {
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  getInitials: (lead: Lead) => string;
  getLeadName: (lead: Lead) => string;
}

export function LeadsGridView({ leads, onCardClick, getInitials, getLeadName }: LeadsGridViewProps): React.ReactElement {
  if (leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-[#5A6B85] dark:text-slate-400">
        No leads found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {leads.map((lead) => (
        <div
          key={lead.id}
          onClick={() => onCardClick(lead)}
          className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-[#2563EB]/30 transition-all flex items-center gap-2.5"
        >
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
            {getInitials(lead)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white truncate">
              {getLeadName(lead)}
            </p>
            <p className="text-[10.5px] text-[#5A6B85] dark:text-slate-400 truncate">
              {lead.companyName ?? '—'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Kanban View (by status)
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadsKanbanViewProps {
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  getInitials: (lead: Lead) => string;
  getLeadName: (lead: Lead) => string;
  getStatusVariant: (status: string) => 'success' | 'info' | 'warn' | 'danger' | 'purple' | 'neutral';
}

const LEAD_STATUSES = ['New', 'Contacted', 'Nurturing', 'Qualified', 'Unqualified'];

export function LeadsKanbanView({ leads, onCardClick, getInitials, getLeadName, getStatusVariant }: LeadsKanbanViewProps): React.ReactElement {
  const columns = useMemo(() => {
    return LEAD_STATUSES.map((status) => ({
      status,
      leads: leads.filter((l) => l.status === status),
    }));
  }, [leads]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
      {columns.map(({ status, leads: columnLeads }) => (
        <div
          key={status}
          className="min-w-[260px] w-[260px] flex-shrink-0 bg-[#F6F8FB] dark:bg-slate-800/30 border border-[#E4E9F0] dark:border-slate-700 rounded-xl flex flex-col max-h-[600px]"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#E4E9F0] dark:border-slate-700">
            <div className="flex items-center gap-2">
              <StatusBadge label={status} variant={getStatusVariant(status)} />
              <span className="text-[11px] font-semibold text-[#5A6B85] dark:text-slate-500 tabular-nums">
                {columnLeads.length}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {columnLeads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => onCardClick(lead)}
                className="bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[9px] shrink-0">
                    {getInitials(lead)}
                  </div>
                  <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white truncate">
                    {getLeadName(lead)}
                  </p>
                </div>
                <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate">
                  {lead.companyName ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drawer — Overview Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadDrawerOverviewProps {
  lead: Lead;
  getOwnerName: (userId?: string) => string;
  formatCurrency: (value?: number) => string;
  organizations: Organization[];
}

export function LeadDrawerOverview({ lead, getOwnerName, formatCurrency, organizations }: LeadDrawerOverviewProps): React.ReactElement {
  const org = organizations.find((o) => o.id === lead.organizationId);

  const fields = [
    { label: 'Company', value: lead.companyName ?? '—' },
    { label: 'Industry', value: lead.industry ?? '—' },
    { label: 'City', value: lead.city ?? '—' },
    { label: 'Lead source', value: lead.leadSource ?? '—' },
    { label: 'Estimated value', value: formatCurrency(lead.estimatedValue) },
    { label: 'Owner', value: getOwnerName(lead.assignedUserId) },
    { label: 'Created', value: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-3">
          DETAILS
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 mb-0.5">{label}</p>
              <p className="text-[13px] font-medium text-[#0F172A] dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {org && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400">
              LINKED ACCOUNT
            </h3>
            <span className="text-[11px] text-[#5A6B85] dark:text-slate-500 tabular-nums">1</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-[#F6F8FB] dark:bg-slate-800/40 rounded-lg border border-[#E4E9F0] dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[10px]">
              {org.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate">{org.name}</p>
              <p className="text-[11px] text-[#5A6B85] dark:text-slate-400">{org.industry ?? 'Account'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drawer — Related Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadDrawerRelatedProps {
  lead: Lead;
  organizations: Organization[];
}

export function LeadDrawerRelated({ lead, organizations }: LeadDrawerRelatedProps): React.ReactElement {
  const org = organizations.find((o) => o.id === lead.organizationId);

  return (
    <div className="space-y-6">
      {org && (
        <div>
          <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-2">
            LINKED ACCOUNT
          </h3>
          <div className="flex items-center gap-3 p-3 bg-[#F6F8FB] dark:bg-slate-800/40 rounded-lg border border-[#E4E9F0] dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[10px]">
              {org.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate">{org.name}</p>
              <p className="text-[11px] text-[#5A6B85] dark:text-slate-400">{org.industry ?? 'Manufacturing'} · Account</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-2">
          DEALS FROM THIS LEAD
        </h3>
        <p className="text-[12px] text-[#5A6B85] dark:text-slate-400">No deals linked yet.</p>
      </div>
    </div>
  );
}
