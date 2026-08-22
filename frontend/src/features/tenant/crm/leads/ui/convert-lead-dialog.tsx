'use client';

import React, { useState, useCallback } from 'react';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { useData } from '@/store/DataContext';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Building,
  UserPlus,
  Briefcase,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { Lead } from '@/store/types';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ConvertLeadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  onSuccess?: () => void;
}

interface ConvertFormState {
  // Account
  accountMode: 'create' | 'existing';
  accountName: string;
  accountId: string;
  // Contact
  contactMode: 'create' | 'existing' | 'skip';
  contactId: string;
  // Deal
  createDeal: boolean;
  dealMode: 'create' | 'existing';
  dealTitle: string;
  dealValue: number | undefined;
  dealId: string;
  dealPipelineId: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

// ─── Component ─────────────────────────────────────────────────────────────

export function ConvertLeadDialog({ isOpen, onClose, lead, onSuccess }: ConvertLeadDialogProps): React.ReactElement {
  const { refreshContacts, refreshOrganizations, refreshDeals, pipelines } = useData();
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<ConvertFormState>({
    accountMode: 'create',
    accountName: lead.companyName || '',
    accountId: lead.accountId || lead.organizationId || '',
    contactMode: 'create',
    contactId: '',
    createDeal: false,
    dealMode: 'create',
    dealTitle: `${lead.firstName || ''} ${lead.lastName || ''} - Opportunity`.trim(),
    dealValue: undefined,
    dealId: '',
    dealPipelineId: pipelines[0]?.id || '',
  });

  const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unnamed Lead';

  // ── Navigation ────────────────────────────────────────────────────────────
  const canGoNext = useCallback((): boolean => {
    switch (step) {
      case 1: return true; // Review step is always valid
      case 2: return form.accountMode === 'existing' ? !!form.accountId : !!form.accountName;
      case 3: return form.contactMode === 'existing' ? !!form.contactId : true;
      case 4: {
        if (!form.createDeal) return true;
        if (form.dealMode === 'existing') return !!form.dealId;
        return !!form.dealTitle;
      }
      case 5: return true;
      default: return false;
    }
  }, [step, form]);

  const goNext = (): void => { if (canGoNext() && step < 5) setStep((s) => (s + 1) as Step); };
  const goBack = (): void => { if (step > 1) setStep((s) => (s - 1) as Step); };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleConvert = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};

      // Account
      if (form.accountMode === 'existing' && form.accountId) {
        payload.accountId = form.accountId;
      } else {
        payload.accountName = form.accountName;
      }

      // Contact
      if (form.contactMode === 'create') {
        payload.createContact = true;
      } else if (form.contactMode === 'existing' && form.contactId) {
        payload.createContact = false;
        payload.contactId = form.contactId;
      } else {
        payload.createContact = false;
      }

      // Deal
      if (form.createDeal) {
        if (form.dealMode === 'existing' && form.dealId) {
          payload.createDeal = false;
          payload.dealId = form.dealId;
        } else {
          payload.createDeal = true;
          payload.dealTitle = form.dealTitle;
          if (form.dealValue) payload.dealValue = form.dealValue;
          if (form.dealPipelineId) payload.dealPipelineId = form.dealPipelineId;
        }
      } else {
        payload.createDeal = false;
      }

      await apiClient.post(`/crm/leads/${lead.id}/convert`, payload);

      toast.success('Lead converted successfully');

      // Refresh data across all affected modules
      await Promise.all([
        refreshContacts(),
        refreshOrganizations(),
        refreshDeals(),
      ]).catch(() => {});

      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to convert lead';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const cardCls = 'border border-gray-200 dark:border-white/[0.08] rounded-xl p-4 bg-white dark:bg-white/[0.02]';
  const radioCls = 'w-full text-left px-4 py-3 rounded-xl border transition-all text-sm';
  const radioActiveCls = 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300';
  const radioInactiveCls = 'border-gray-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-500/30';
  const inputCls = 'w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';

  // ── Step Renderers ─────────────────────────────────────────────────────────

  const renderStep1 = (): React.ReactElement => (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Review Lead</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">Confirm the lead details before conversion.</p>
      <div className={cardCls}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Name</span><span className="font-medium text-slate-900 dark:text-white">{leadName}</span></div>
          {lead.email && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Email</span><span className="text-slate-700 dark:text-slate-300">{lead.email}</span></div>}
          {lead.phone && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Phone</span><span className="text-slate-700 dark:text-slate-300">{lead.phone}</span></div>}
          {lead.companyName && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Company</span><span className="text-slate-700 dark:text-slate-300">{lead.companyName}</span></div>}
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Status</span><span className="text-slate-700 dark:text-slate-300">{lead.status}</span></div>
          {lead.leadSource && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Source</span><span className="text-slate-700 dark:text-slate-300">{lead.leadSource}</span></div>}
        </div>
      </div>
    </div>
  );

  const renderStep2 = (): React.ReactElement => (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Building size={18} className="text-blue-500" /> Account
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">Create a new account or link to an existing one.</p>
      <div className="space-y-2">
        <button type="button" onClick={() => setForm((f) => ({ ...f, accountMode: 'create' }))} className={cn(radioCls, form.accountMode === 'create' ? radioActiveCls : radioInactiveCls)}>
          Create new account
        </button>
        <button type="button" onClick={() => setForm((f) => ({ ...f, accountMode: 'existing' }))} className={cn(radioCls, form.accountMode === 'existing' ? radioActiveCls : radioInactiveCls)}>
          Use existing account
        </button>
      </div>
      {form.accountMode === 'create' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Account Name</label>
          <input
            value={form.accountName}
            onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
            className={inputCls}
            placeholder="Enter account name"
          />
        </div>
      )}
      {form.accountMode === 'existing' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Account</label>
          <EntityCombobox
            entityType="accounts"
            value={form.accountId || null}
            onChange={(id) => setForm((f) => ({ ...f, accountId: id || '' }))}
            placeholder="Search accounts..."
          />
        </div>
      )}
    </div>
  );

  const renderStep3 = (): React.ReactElement => (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <UserPlus size={18} className="text-green-500" /> Contact
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">A Contact record will be created from this lead&apos;s data, or you can link to an existing one.</p>
      <div className="space-y-2">
        <button type="button" onClick={() => setForm((f) => ({ ...f, contactMode: 'create' }))} className={cn(radioCls, form.contactMode === 'create' ? radioActiveCls : radioInactiveCls)}>
          Create new contact (from lead data)
        </button>
        <button type="button" onClick={() => setForm((f) => ({ ...f, contactMode: 'existing' }))} className={cn(radioCls, form.contactMode === 'existing' ? radioActiveCls : radioInactiveCls)}>
          Use existing contact
        </button>
        <button type="button" onClick={() => setForm((f) => ({ ...f, contactMode: 'skip' }))} className={cn(radioCls, form.contactMode === 'skip' ? radioActiveCls : radioInactiveCls)}>
          Skip (no contact)
        </button>
      </div>
      {form.contactMode === 'create' && (
        <div className={cn(cardCls, 'text-sm space-y-1')}>
          <p className="text-slate-500 dark:text-slate-400">Will create contact with:</p>
          <p className="text-slate-700 dark:text-slate-300"><strong>Name:</strong> {leadName}</p>
          {lead.email && <p className="text-slate-700 dark:text-slate-300"><strong>Email:</strong> {lead.email}</p>}
          {lead.phone && <p className="text-slate-700 dark:text-slate-300"><strong>Phone:</strong> {lead.phone}</p>}
        </div>
      )}
      {form.contactMode === 'existing' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Contact</label>
          <EntityCombobox
            entityType="contacts"
            value={form.contactId || null}
            onChange={(id) => setForm((f) => ({ ...f, contactId: id || '' }))}
            placeholder="Search contacts..."
          />
        </div>
      )}
    </div>
  );

  const renderStep4 = (): React.ReactElement => (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Briefcase size={18} className="text-purple-500" /> Deal (Optional)
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">Optionally create or link a deal for this conversion.</p>
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.createDeal}
            onChange={(e) => setForm((f) => ({ ...f, createDeal: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Create or link a deal</span>
        </label>
      </div>
      {form.createDeal && (
        <>
          <div className="space-y-2">
            <button type="button" onClick={() => setForm((f) => ({ ...f, dealMode: 'create' }))} className={cn(radioCls, form.dealMode === 'create' ? radioActiveCls : radioInactiveCls)}>
              Create new deal
            </button>
            <button type="button" onClick={() => setForm((f) => ({ ...f, dealMode: 'existing' }))} className={cn(radioCls, form.dealMode === 'existing' ? radioActiveCls : radioInactiveCls)}>
              Link to existing deal
            </button>
          </div>
          {form.dealMode === 'create' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Deal Title *</label>
                <input
                  value={form.dealTitle}
                  onChange={(e) => setForm((f) => ({ ...f, dealTitle: e.target.value }))}
                  className={inputCls}
                  placeholder="Deal title"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Value</label>
                <input
                  type="number"
                  value={form.dealValue || ''}
                  onChange={(e) => setForm((f) => ({ ...f, dealValue: e.target.value ? Number(e.target.value) : undefined }))}
                  className={inputCls}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              {pipelines.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pipeline</label>
                  <select
                    value={form.dealPipelineId}
                    onChange={(e) => setForm((f) => ({ ...f, dealPipelineId: e.target.value }))}
                    className={inputCls}
                  >
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {form.dealMode === 'existing' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Deal</label>
              <EntityCombobox
                entityType="leads"
                value={form.dealId || null}
                onChange={(id) => setForm((f) => ({ ...f, dealId: id || '' }))}
                placeholder="Search deals..."
              />
              <p className="text-xs text-slate-400">Note: Deal search uses existing lead/contact records for linking.</p>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderStep5 = (): React.ReactElement => (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Check size={18} className="text-green-500" /> Confirmation
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">Review the conversion actions below.</p>
      <div className={cn(cardCls, 'space-y-3')}>
        <div className="flex items-start gap-2 text-sm">
          <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
          <span className="text-slate-700 dark:text-slate-300">Lead status will change to <strong>Converted</strong></span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <Check size={16} className="text-blue-500 mt-0.5 shrink-0" />
          <span className="text-slate-700 dark:text-slate-300">
            Account: {form.accountMode === 'create' ? `Create "${form.accountName}"` : 'Link to existing account'}
          </span>
        </div>
        {form.contactMode !== 'skip' && (
          <div className="flex items-start gap-2 text-sm">
            <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">
              Contact: {form.contactMode === 'create' ? `Create from lead data (${leadName})` : 'Link to existing contact'}
            </span>
          </div>
        )}
        {form.createDeal && (
          <div className="flex items-start gap-2 text-sm">
            <Check size={16} className="text-purple-500 mt-0.5 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">
              Deal: {form.dealMode === 'create' ? `Create "${form.dealTitle}"` : 'Link to existing deal'}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          This action will convert the lead and set its status to &quot;Converted&quot;. This cannot be easily reversed.
        </p>
      </div>
    </div>
  );

  // ── Step Indicators ─────────────────────────────────────────────────────────
  const steps = [
    { num: 1, label: 'Review' },
    { num: 2, label: 'Account' },
    { num: 3, label: 'Contact' },
    { num: 4, label: 'Deal' },
    { num: 5, label: 'Confirm' },
  ];

  return (
    <SlidingDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Convert Lead"
      subtitle={leadName}
    >
      <div className="flex flex-col h-full">
        {/* Step Progress */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-1">
            {steps.map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                  step === s.num ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' :
                  step > s.num ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'
                )}>
                  {step > s.num ? <Check size={12} /> : <span>{s.num}</span>}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {idx < steps.length - 1 && <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-white/[0.08] px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={step === 1 ? onClose : goBack}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            {step === 1 ? 'Cancel' : <><ChevronLeft size={14} /> Back</>}
          </button>
          {step < 5 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext()}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1',
                canGoNext()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 dark:bg-white/[0.05] text-slate-400 cursor-not-allowed'
              )}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConvert}
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Convert Lead
            </button>
          )}
        </div>
      </div>
    </SlidingDrawer>
  );
}

export default ConvertLeadDialog;
