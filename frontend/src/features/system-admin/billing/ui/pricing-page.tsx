'use client';
import { uuid } from '@/lib/utils';
import React, { useState } from 'react';
import { CheckCircle2, Server, Users, Plus, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ModalCloseButton } from '@/shared/components/ui/modal-close-button';
import { pricingApiService } from '../services/pricing.service';
import { adminStripeService } from '../services/admin-stripe.service';

const DEFAULT_PLANS = [
  {
    id: 'starter', name: 'Starter', price: 299, billingCycle: 'Monthly',
    usersLimit: '5', storage: '10GB', apiCalls: '10,000',
    features: [
      { id: 'f1', text: 'Basic Contact Tracking', enabled: true },
      { id: 'f2', text: 'Standard Support',       enabled: true },
      { id: 'f3', text: 'Custom Workflows',        enabled: false },
    ],
    paymentMethods: { stripe: true, bank: true, paypal: false },
    isPopular: false,
  },
  {
    id: 'professional', name: 'Professional', price: 799, billingCycle: 'Monthly',
    usersLimit: '20', storage: '50GB', apiCalls: '100,000',
    features: [
      { id: 'f1', text: 'Advanced Contact Tracking', enabled: true },
      { id: 'f2', text: 'Priority Support',           enabled: true },
      { id: 'f3', text: 'Custom Workflows',           enabled: true },
    ],
    paymentMethods: { stripe: true, bank: true, paypal: true },
    isPopular: true,
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 2499, billingCycle: 'Monthly',
    usersLimit: 'Unlimited', storage: '500GB', apiCalls: 'Unlimited',
    features: [
      { id: 'f1', text: 'Custom Contact Tracking',   enabled: true },
      { id: 'f2', text: '24/7 Dedicated Support',    enabled: true },
      { id: 'f3', text: 'Advanced Custom Workflows', enabled: true },
    ],
    paymentMethods: { stripe: true, bank: true, paypal: true },
    isPopular: false,
  },
];

type BillingView = 'Monthly' | 'Quarterly' | 'Annual';

/**
 * System Admin — Pricing page.
 * Manage subscription plan tiers, feature toggles, and payment methods.
 */
export default function PricingPage() {
  const [pricingView, setPricingView] = useState<BillingView>('Monthly');
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [editingPlan, setEditingPlan] = useState<(typeof DEFAULT_PLANS)[0] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

  const getDisplayPrice = (base: number) => {
    if (pricingView === 'Quarterly') return Math.round(base * 3 * 0.9);
    if (pricingView === 'Annual')    return Math.round(base * 12 * 0.8);
    return base;
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    setIsSaving(true);
    try {
      // Wire save to real API
      await pricingApiService.updatePlan(editingPlan.id, {
        price:    editingPlan.price,
        features: editingPlan.features.filter((f) => f.enabled).map((f) => f.text),
      });
      // Also kick off Stripe product sync if the plan has a real ID
      await adminStripeService.syncPlan(editingPlan.id).catch(() => {
        // Non-fatal — plan saved in DB, Stripe sync can be retried
      });
      setPlans(plans.map((p) => (p.id === editingPlan.id ? editingPlan : p)));
      setSaveStatus('success');
      setTimeout(() => { setEditingPlan(null); setSaveStatus('idle'); }, 900);
    } catch {
      toast.error('Failed to save plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Pricing</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage subscription tiers and features</p>
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 dark:bg-amber-500/10 inline-block px-2 py-1 rounded border border-amber-200 dark:border-amber-500/20">
            Note: Maximum of 3 active plans supported.
          </p>
        </div>
        <div className="flex bg-slate-200 dark:bg-slate-700/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          {(['Monthly', 'Quarterly', 'Annual'] as BillingView[]).map((v) => (
            <button key={v} onClick={() => setPricingView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pricingView === v
                  ? 'bg-white dark:bg-slate-950 text-blue-600 shadow-sm border border-slate-200 dark:border-slate-700/50'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className={`relative bg-white dark:bg-slate-950 border rounded-2xl p-6 flex flex-col hover:shadow-md transition-shadow ${plan.isPopular ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">Most Popular</div>
            )}
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h4>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4">
              ${getDisplayPrice(plan.price)}<span className="text-sm font-normal text-slate-500"> / {pricingView.toLowerCase()}</span>
            </div>
            <div className="space-y-3 mb-8 flex-1">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Users size={16} /> {plan.usersLimit} Users</div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Server size={16} /> {plan.storage} Storage</div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wider">Features</p>
                {plan.features.slice(0, 3).map((f) => (
                  <div key={f.id} className="flex items-start gap-2 mb-2">
                    <CheckCircle2 size={16} className={f.enabled ? 'text-blue-500 shrink-0' : 'text-slate-400 shrink-0'} />
                    <span className={`text-sm ${f.enabled ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 line-through'}`}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setEditingPlan(JSON.parse(JSON.stringify(plan)))}
              className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${plan.isPopular ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white'}`}>
              Edit Plan
            </button>
          </div>
        ))}
      </div>

      {/* Edit drawer */}
      <AnimatePresence>
        {editingPlan && (
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex justify-end">
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-slate-950 w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit {editingPlan.name} Plan</h3>
                <ModalCloseButton onClose={() => setEditingPlan(null)} ariaLabel="Close edit plan drawer" size={20} />
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <Field label="Plan Name">
                  <input type="text" value={editingPlan.name} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                </Field>
                <Field label="Monthly Price ($)">
                  <input type="number" value={editingPlan.price} onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                </Field>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Features</p>
                    <button onClick={() => setEditingPlan({ ...editingPlan, features: [...editingPlan.features, { id: Date.now().toString(), text: 'New Feature', enabled: true }] })}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                  <div className="space-y-2">
                    {editingPlan.features.map((f, idx) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <input type="checkbox" checked={f.enabled} onChange={(e) => { const nf = [...editingPlan.features]; nf[idx] = { ...nf[idx], enabled: e.target.checked }; setEditingPlan({ ...editingPlan, features: nf }); }} className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600" />
                        <input type="text" value={f.text} onChange={(e) => { const nf = [...editingPlan.features]; nf[idx] = { ...nf[idx], text: e.target.value }; setEditingPlan({ ...editingPlan, features: nf }); }}
                          className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                        <button onClick={() => { const nf = editingPlan.features.filter((_, i) => i !== idx); setEditingPlan({ ...editingPlan, features: nf }); }} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                <button onClick={() => setEditingPlan(null)} className="flex-1 px-4 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm transition-colors">Cancel</button>
                <button onClick={handleSavePlan} disabled={isSaving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : saveStatus === 'success' ? <CheckCircle2 size={16} /> : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  );
}
