'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, CreditCard, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PricingPlanDto, BillingCycle } from '@leadcrm/shared';
import { pricingApiService } from '../services/pricing.service';
import { adminStripeService } from '../services/admin-stripe.service';
import { tenantApiService } from '../../tenants/services/tenants.service';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AddBillingPageProps {
  onClose: () => void;
  /** Called after a billing checkout session is successfully created */
  onCreated?: () => void;
}

interface TenantOption {
  id:   string;
  name: string;
}

interface BillingFormData {
  tenantId:     string;
  planId:       string;
  billingCycle: BillingCycle;
}

const BILLING_CYCLES: { id: BillingCycle; label: string; hint: string }[] = [
  { id: 'MONTHLY',   label: 'Monthly',   hint: 'Billed every month' },
  { id: 'QUARTERLY', label: 'Quarterly', hint: 'Billed every 3 months (10% off)' },
  { id: 'ANNUAL',    label: 'Annual',    hint: 'Billed every 12 months (20% off)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function cyclePrice(plan: PricingPlanDto | undefined, cycle: BillingCycle): number {
  if (!plan) return 0;
  if (cycle === 'QUARTERLY') return plan.quarterlyPrice;
  if (cycle === 'ANNUAL')    return plan.annualPrice;
  return plan.monthlyPrice;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * System Admin — Add Billing.
 * Full-page form that mirrors the Add New Client layout. Lets the operator
 * create a billing checkout session for an existing client against a plan and
 * billing cycle, using the real Stripe checkout endpoint.
 */
export default function AddBillingPage({ onClose, onCreated }: AddBillingPageProps): React.ReactElement {
  const [tenants, setTenants]         = useState<TenantOption[]>([]);
  const [plans, setPlans]             = useState<PricingPlanDto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors]           = useState<Partial<Record<keyof BillingFormData, string>>>({});
  const [formData, setFormData]       = useState<BillingFormData>({
    tenantId:     '',
    planId:       '',
    billingCycle: 'MONTHLY',
  });

  // Load clients + plans for the selectors
  useEffect(() => {
    tenantApiService.getAll()
      .then((response) => {
        const options = (response.data as Array<Record<string, unknown>>).map((tenant) => ({
          id:   String(tenant.id),
          name: String(tenant.name ?? 'Unnamed client'),
        }));
        setTenants(options);
      })
      .catch(() => { /* selector stays empty — validation will guard submit */ });

    pricingApiService.getPlans()
      .then((response) => {
        if (response.success && Array.isArray(response.data)) setPlans(response.data);
      })
      .catch(() => { /* selector stays empty — validation will guard submit */ });
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === formData.planId),
    [plans, formData.planId],
  );

  const previewAmount = cyclePrice(selectedPlan, formData.billingCycle);

  const handleChange = (field: keyof BillingFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof BillingFormData, string>> = {};
    if (!formData.tenantId) newErrors.tenantId = 'Please select a client';
    if (!formData.planId)   newErrors.planId   = 'Please select a plan';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsSubmitting(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await adminStripeService.createCheckoutSession({
        tenantId:     formData.tenantId,
        planId:       formData.planId,
        billingCycle: formData.billingCycle,
        successUrl:   `${origin}/admin/billing?checkout=success`,
        cancelUrl:    `${origin}/admin/billing?checkout=cancelled`,
      });

      const checkoutUrl = response.data?.checkoutUrl;
      toast.success('Billing checkout session created successfully!');
      onCreated?.();
      onClose();

      // Open the Stripe-hosted checkout in a new tab so the admin can complete setup
      if (checkoutUrl && typeof window !== 'undefined') {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create billing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMethods = selectedPlan?.paymentMethods.filter((method) => method.enabled) ?? [];

  return (
    <div className="absolute inset-0 z-30 bg-slate-50 dark:bg-[#030712] flex flex-col">
      {/* Body - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-14 py-10 pb-32">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Billing
          </button>
          <div className="mt-5 mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Add Billing</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Create a new billing subscription for a client and start their checkout
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Client Selection Section */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-white/[0.08] p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Client</h3>
              </div>

              <div>
                <label htmlFor="billing-tenant" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select Client <span className="text-red-500">*</span>
                </label>
                <select
                  id="billing-tenant"
                  value={formData.tenantId}
                  onChange={(e) => handleChange('tenantId', e.target.value)}
                  className={cn(
                    'w-full h-11 bg-white dark:bg-slate-800 border rounded-lg px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
                    errors.tenantId ? 'border-red-500' : 'border-gray-200 dark:border-white/[0.08]',
                  )}
                >
                  <option value="">Select a client...</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                  ))}
                </select>
                {errors.tenantId && <p className="text-xs text-red-500 mt-1">{errors.tenantId}</p>}
              </div>
            </div>

            {/* Plan + Billing Cycle — side by side on large screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Plan Section */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-white/[0.08] p-6 sm:p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Subscription Plan</h3>
                </div>

                <div className="space-y-5">
                  <div>
                    <label htmlFor="billing-plan" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Plan <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="billing-plan"
                      value={formData.planId}
                      onChange={(e) => handleChange('planId', e.target.value)}
                      className={cn(
                        'w-full h-11 bg-white dark:bg-slate-800 border rounded-lg px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
                        errors.planId ? 'border-red-500' : 'border-gray-200 dark:border-white/[0.08]',
                      )}
                    >
                      <option value="">Select a plan...</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                    {errors.planId && <p className="text-xs text-red-500 mt-1">{errors.planId}</p>}
                  </div>

                  {/* Amount preview */}
                  <div className="rounded-lg border border-gray-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Amount for selected cycle</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      ₱{previewAmount.toLocaleString()}
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        / {formData.billingCycle.toLowerCase()}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Billing Cycle Section */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-white/[0.08] p-6 sm:p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Billing Cycle</h3>
                </div>

                <div className="space-y-3">
                  {BILLING_CYCLES.map((cycle) => {
                    const isSelected = formData.billingCycle === cycle.id;
                    return (
                      <button
                        type="button"
                        key={cycle.id}
                        onClick={() => handleChange('billingCycle', cycle.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-blue-500 bg-blue-500/5'
                            : 'border-gray-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                        )}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{cycle.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cycle.hint}</p>
                        </div>
                        <span
                          className={cn(
                            'w-4 h-4 rounded-full border-2 shrink-0',
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600',
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Payment Methods (read-only summary from the selected plan) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-white/[0.08] p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Available Payment Methods</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Determined by the selected plan</p>
                </div>
              </div>

              {selectedMethods.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedMethods.map((method) => (
                    <span
                      key={method.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {method.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                  Select a plan to see its available payment methods.
                </p>
              )}
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-blue-900 dark:text-blue-100">
                A Stripe checkout session will be created for the selected client. The hosted checkout page opens in a new tab so payment details can be completed securely.
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Footer - Sticky at Bottom */}
      <div className="absolute bottom-0 inset-x-0 border-t border-gray-200 dark:border-white/[0.08] bg-white dark:bg-slate-900 shrink-0 shadow-lg z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-end gap-3 px-6 sm:px-10 lg:px-14 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 px-4 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              'Create Billing'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
