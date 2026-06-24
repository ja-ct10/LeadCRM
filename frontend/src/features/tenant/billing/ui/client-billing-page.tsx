'use client';

import React, { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { Receipt, CreditCard, Download, ExternalLink, AlertCircle, CheckCircle2, Calculator, Info, Sparkles, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function ClientBillingPage() {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'payment-methods'>('overview');

  // Interactive states for Payment Prediction
  const [frequency, setFrequency] = useState<'monthly' | 'semi-annual' | 'annual'>('monthly');
  const [extraUsers, setExtraUsers] = useState<number>(0);
  const [extraStorage, setExtraStorage] = useState<number>(0); // GB
  const [premiumSupport, setPremiumSupport] = useState<boolean>(false);
  const [advancedAPI, setAdvancedAPI] = useState<boolean>(false);

  const handleDownloadInvoice = (id: string) => {
    toast.success(`Downloading invoice ${id}...`);
  };

  // Prediction calculation math
  const basePrice = 9999;
  const userCost = extraUsers * 200;
  const storageCost = extraStorage * 50; // Each extra GB costs ₱50
  const supportCost = premiumSupport ? 1500 : 0;
  const apiCost = advancedAPI ? 2500 : 0;

  const rawSubtotal = basePrice + userCost + storageCost + supportCost + apiCost;

  let discountPercent = 0;
  if (frequency === 'semi-annual') {
    discountPercent = 10;
  } else if (frequency === 'annual') {
    discountPercent = 20;
  }

  const discountAmount = Math.round(rawSubtotal * (discountPercent / 100));
  const estimatedNextMonthlyAmount = rawSubtotal - discountAmount;

  const invoices = [
    { id: 'INV-2026-001', date: 'Apr 01, 2026', amount: '₱9,999.00', status: 'Paid', method: '₱·₱·₱·₱· 4242' },
    { id: 'INV-2026-002', date: 'Mar 01, 2026', amount: '₱9,999.00', status: 'Paid', method: '₱·₱·₱·₱· 4242' },
    { id: 'INV-2026-003', date: 'Feb 01, 2026', amount: '₱9,999.00', status: 'Paid', method: '₱·₱·₱·₱· 4242' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Billing & Subscription</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your plan, payment methods, and billing history.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => toast.success('Redirecting to upgrade flow...')}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm"
          >
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'history', label: 'Billing History' },
          { id: 'payment-methods', label: 'Payment Methods' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-4 text-sm font-semibold transition-all relative ${
              activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:text-white'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeBillingTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" 
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Current Plan</h3>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100">Professional</span>
                </div>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">₱9,999</span>
                  <span className="text-slate-500 dark:text-slate-400 mb-1">/ month</span>
                </div>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 size={16} className="text-emerald-500" /> Up to 50 Users
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 size={16} className="text-emerald-500" /> 100GB Storage
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 size={16} className="text-emerald-500" /> Priority Support
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <button 
                    onClick={() => toast.success('Cancellation request submitted. A representative will contact you shortly.')}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-200 transition-colors"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Next Payment</h3>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">May 01, 2026</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">Amount: ₱9,999.00</div>
                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <CreditCard size={16} className="text-slate-500 dark:text-slate-400" />
                  Visa ending in 4242
                </div>
              </div>

              {/* Payment Prediction Widget */}
              <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                  <Calculator size={18} className="text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Payment Prediction</h3>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Real-time client simulator. Adjust additional requirements to view your calculated pricing and estimated next bill instantly.
                </p>

                {/* Contract Frequency */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Billing Cycle</span>
                    <span className="text-[10px] bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold px-1.5 py-0.5 rounded">Contract Frequency</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-150 dark:border-slate-800/80">
                    {[
                      { id: 'monthly', label: 'Monthly', desc: 'No disc' },
                      { id: 'semi-annual', label: 'Semi-Ann', desc: '10% off' },
                      { id: 'annual', label: 'Annual', desc: '20% off' },
                    ].map((freq) => (
                      <button
                        key={freq.id}
                        type="button"
                        onClick={() => {
                          setFrequency(freq.id as any);
                          toast.success(`Frequency updated to ${freq.label}! =···`);
                        }}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                          frequency === freq.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <div>{freq.label}</div>
                        <div className={`text-[8px] opacity-75 font-semibold ${frequency === freq.id ? 'text-white' : 'text-blue-500'}`}>
                          {freq.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Users */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Extra Users (+₱200/ea)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">+{extraUsers} Users</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={extraUsers}
                    onChange={(e) => setExtraUsers(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>Base Tier Included (50)</span>
                    <span>Max +100 Users</span>
                  </div>
                </div>

                {/* Extra storage */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Extra Storage (+₱50/GB)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">+{extraStorage} GB</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="50"
                    value={extraStorage}
                    onChange={(e) => setExtraStorage(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>100GB Baseline</span>
                    <span>Max +500 GB</span>
                  </div>
                </div>

                {/* Feature Checkboxes */}
                <div className="space-y-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Enterprise Add-ons</span>
                  
                  <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={premiumSupport}
                      onChange={(e) => {
                        setPremiumSupport(e.target.checked);
                        if (e.target.checked) toast.success('Added Premium 24/7 SLA Support! ₱·');
                      }}
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Premium SLA Support (+₱1,500)</div>
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5">Priority routing, guaranteed sub-hour responses</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={advancedAPI}
                      onChange={(e) => {
                        setAdvancedAPI(e.target.checked);
                        if (e.target.checked) toast.success('Unlocked unlimited API and CRM webhooks! =···');
                      }}
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Unlimited API Access (+₱2,500)</div>
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5">Integration tokens, raw database sync, custom endpoints</p>
                    </div>
                  </label>
                </div>

                {/* Calculation breakdown */}
                <div className="pt-3.5 border-t border-slate-150 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    <span>Professional Plan:</span>
                    <span className="text-slate-750 dark:text-slate-200">₱9,999.00</span>
                  </div>
                  {extraUsers > 0 && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <span>Extra Users ({extraUsers}):</span>
                      <span className="text-slate-755 dark:text-slate-200">+₱{userCost.toLocaleString()}</span>
                    </div>
                  )}
                  {extraStorage > 0 && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <span>Extra Storage ({extraStorage} GB):</span>
                      <span className="text-slate-755 dark:text-slate-200">+₱{storageCost.toLocaleString()}</span>
                    </div>
                  )}
                  {premiumSupport && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <span>Premium Support SLA:</span>
                      <span className="text-slate-755 dark:text-slate-200">+₱1,500.00</span>
                    </div>
                  )}
                  {advancedAPI && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <span>Enterprise API Access:</span>
                      <span className="text-slate-755 dark:text-slate-200">+₱2,500.00</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-rose-500 dark:text-rose-400 font-bold font-mono text-[11px]">
                      <span>{frequency === 'annual' ? '20%' : '10%'} Frequency Disc:</span>
                      <span>-₱{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Total estimate */}
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-150 dark:border-slate-800 text-center sm:text-left">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Predicted Bill:</span>
                    <span className="text-xs text-blue-500 font-extrabold capitalize tracking-wider flex items-center gap-1">
                      <TrendingUp size={12} /> {frequency}
                    </span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-baseline justify-center sm:justify-start gap-1">
                    <span>₱{estimatedNextMonthlyAmount.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 normal-case font-normal font-mono">/ month</span>
                  </div>
                  
                  {frequency !== 'monthly' ? (
                    <p className="text-[10px] text-teal-600 dark:text-teal-400 font-bold mt-2 flex items-center gap-1 justify-center sm:justify-start bg-teal-50 ml-[-4px] mr-[-4px] dark:bg-teal-900/10 px-2 py-1.5 rounded-lg border border-teal-100/40 dark:border-teal-900/20">
                      <Sparkles size={11} className="shrink-0 animate-pulse text-teal-500" />
                      Dynamic Cycle: ₱{(estimatedNextMonthlyAmount * (frequency === 'annual' ? 12 : 6)).toLocaleString()} billed every {frequency === 'annual' ? '12' : '6'} months.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium mt-1 leading-normal italic">
                      * Billed on a monthly rolling basis. Upgrade contract length to qualify for multi-month billing discounts.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Invoice History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-medium">Invoice ID</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Amount</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-blue-600">{inv.id}</td>
                      <td className="px-6 py-4 text-slate-900 dark:text-white">{inv.date}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{inv.amount}</td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full text-xs font-medium">
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDownloadInvoice(inv.id)}
                          className="text-slate-600 dark:text-slate-400 hover:text-blue-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Download size={14} /> Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payment-methods' && (
          <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payment Methods</h3>
              <button 
                onClick={() => toast.success('Opening payment method modal...')}
                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-medium text-sm hover:bg-blue-100 transition-colors"
              >
                Add New Method
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50/50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 rounded flex items-center justify-center font-bold text-blue-900 italic">
                    VISA
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      Visa ending in 4242
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-full">Default</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Expires 12/2028</div>
                  </div>
                </div>
                <button 
                  onClick={() => toast.success('Removing payment method...')}
                  className="text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:text-red-600 p-2 transition-colors"
                >
                  <AlertCircle size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
