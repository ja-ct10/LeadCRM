import React, { useState } from 'react';
import { useAuth } from '../../../store/AuthContext';
import { Shield, Monitor, CreditCard, Package, Zap, Receipt, Calendar, CheckCircle2, Download, Eye, CreditCard as CreditCardIcon, Plus, FileText, Mail, X, ChevronDown } from 'lucide-react';

export default function AccountDetailsPage() {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'Account Details' | 'Billing & Payments'>('Account Details');
  const [environment, setEnvironment] = useState<'Sandbox' | 'Production'>('Production');
  const [isManagePlanModalOpen, setIsManagePlanModalOpen] = useState(false);
  const [isMakePaymentModalOpen, setIsMakePaymentModalOpen] = useState(false);
  const [isUpdateBillingModalOpen, setIsUpdateBillingModalOpen] = useState(false);
  const [isTaxDocumentsModalOpen, setIsTaxDocumentsModalOpen] = useState(false);
  const [isAddPaymentMethodModalOpen, setIsAddPaymentMethodModalOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState('Monthly');

  const renderAccountDetails = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Account Details Card */}
      <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Account Details</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your account information and current status</p>
          </div>
          <span className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Client Name</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{tenant?.name || 'Camxian Technologies'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Contact Email</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" /> {tenant?.email || 'billing@camxian.com'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Account ID</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">ACC-2024-1847</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Created Date</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" /> January 15, 2024
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Company Name</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{tenant?.name || 'Camxian Technologies'} Ltd.</p>
          </div>
        </div>
      </div>

      {/* Subscription Plan Card */}
      <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Subscription Plan</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your subscription and upgrade options</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 mb-6 border border-slate-200 dark:border-slate-700/50">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Current Plan: Pro</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">Billed monthly at $299/month</p>
            </div>
            <span className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-full border border-slate-300 dark:border-slate-600">
              Active
            </span>
          </div>

          <div className="mb-2 text-sm font-medium text-slate-900 dark:text-white">Plan Features:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Unlimited contacts
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Advanced pipelines
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Up to 10 users
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Email & SMS campaigns
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Priority support
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Custom workflows
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Free Plan */}
          <div className="border border-gray-200 dark:border-slate-700/50 rounded-xl p-6 bg-white dark:bg-slate-800/40">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Free</h4>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">$0</span>
              <span className="text-sm text-slate-500">/month</span>
            </div>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Up to 100 contacts
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Basic pipeline
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> 1 user
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Email support
              </li>
            </ul>
          </div>

          {/* Pro Plan */}
          <div className="border-2 border-slate-900 dark:border-slate-600 rounded-xl p-6 bg-white dark:bg-slate-800/40 relative">
            <div className="absolute top-4 right-4 px-2.5 py-1 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-full">
              Current
            </div>
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Pro</h4>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">$299</span>
              <span className="text-sm text-slate-500">/month</span>
            </div>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Unlimited contacts
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Advanced pipelines
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Up to 10 users
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Email & SMS campaigns
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Priority support
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Custom workflows
              </li>
            </ul>
          </div>

          {/* Enterprise Plan */}
          <div className="border border-gray-200 dark:border-slate-700/50 rounded-xl p-6 bg-white dark:bg-slate-800/40">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Enterprise</h4>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">Custom</span>
              <span className="text-sm text-slate-500">pricing</span>
            </div>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Everything in Pro
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Unlimited users
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Advanced RBAC
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> API access
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Dedicated support
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Custom integrations
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> SLA guarantee
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-between items-center bg-slate-500/10 dark:bg-slate-800/50 rounded-xl p-2">
          <div className="flex-1 flex justify-center items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Zap className="w-4 h-4" /> Current Plan
          </div>
          <button 
            onClick={() => setIsManagePlanModalOpen(true)}
            className="px-6 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Manage Plan
          </button>
        </div>
      </div>
    </div>
  );

  const renderBillingAndPayments = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Current Balance</h3>
            <span className="text-slate-400">$</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">$0.00</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">No outstanding balance</p>
        </div>

        <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Next Billing Date</h3>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">May 1</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">2026</p>
        </div>

        <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Payment Status</h3>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mb-2">
            <span className="px-2.5 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">Paid</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">All payments current</p>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Billing History</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">View and download your past invoices</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="border-b border-gray-200 dark:border-slate-700/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Invoice ID</th>
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Date</th>
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Amount</th>
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
              {[
                { id: 'INV-2026-004', date: 'Apr 1, 2026', amount: '$299.00', status: 'Paid' },
                { id: 'INV-2026-003', date: 'Mar 1, 2026', amount: '$299.00', status: 'Paid' },
                { id: 'INV-2026-002', date: 'Feb 1, 2026', amount: '$299.00', status: 'Paid' },
                { id: 'INV-2026-001', date: 'Jan 1, 2026', amount: '$299.00', status: 'Paid' },
                { id: 'INV-2025-012', date: 'Dec 1, 2025', amount: '$299.00', status: 'Paid' },
              ].map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-4">{invoice.id}</td>
                  <td className="px-4 py-4">{invoice.date}</td>
                  <td className="px-4 py-4">{invoice.amount}</td>
                  <td className="px-4 py-4">
                    <span className="px-2.5 py-1 bg-green-500 text-white text-xs font-semibold rounded-full flex items-center gap-1 w-max">
                      <CheckCircle2 className="w-3 h-3" /> {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <button className="flex items-center gap-1 text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition-colors">
                        <Eye className="w-4 h-4" /> View
                      </button>
                      <button className="flex items-center gap-1 text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition-colors">
                        <Download className="w-4 h-4" /> Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Payment Methods</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your payment methods</p>
          </div>
          
          <div className="border border-gray-200 dark:border-slate-700/50 rounded-xl p-4 flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <CreditCardIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Visa ending in 1234</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Expires 12/2027</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full border border-slate-200 dark:border-slate-700">
              Default
            </span>
          </div>

          <button 
            onClick={() => setIsAddPaymentMethodModalOpen(true)}
            className="w-full py-3 border border-gray-200 dark:border-slate-700/50 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-slate-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <CreditCardIcon className="w-4 h-4" /> Add Payment Method
          </button>
        </div>

        {/* Recent Payments */}
        <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Payments</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your latest payment transactions</p>
          </div>

          <div className="space-y-4">
            {[
              { amount: '$299.00', date: 'Apr 1', card: 'Visa **** 1234', id: 'PAY-2026-004' },
              { amount: '$299.00', date: 'Mar 1', card: 'Visa **** 1234', id: 'PAY-2026-003' },
              { amount: '$299.00', date: 'Feb 1', card: 'Visa **** 1234', id: 'PAY-2026-002' },
            ].map((payment, i) => (
              <div key={i} className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-700/50 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{payment.amount}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{payment.card}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{payment.date}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{payment.id}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-2xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Quick Actions</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your billing and payments</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors">
            <Download className="w-4 h-4" /> Download Invoice
          </button>
          <button 
            onClick={() => setIsMakePaymentModalOpen(true)}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <CreditCardIcon className="w-4 h-4" /> Make Payment
          </button>
          <button 
            onClick={() => setIsUpdateBillingModalOpen(true)}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Update Billing Info
          </button>
          <button 
            onClick={() => setIsTaxDocumentsModalOpen(true)}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            View Tax Documents
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Account Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your account, subscription, and billing</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-lg p-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 px-3">Environment:</span>
          <button 
            onClick={() => setEnvironment('Sandbox')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              environment === 'Sandbox' 
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Sandbox
          </button>
          <button 
            onClick={() => setEnvironment('Production')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              environment === 'Production' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-gray-200 dark:border-slate-600' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Production
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab('Account Details')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'Account Details'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
              : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          Account Details
        </button>
        <button
          onClick={() => setActiveTab('Billing & Payments')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'Billing & Payments'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
              : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          Billing & Payments
        </button>
      </div>

      {activeTab === 'Account Details' ? renderAccountDetails() : renderBillingAndPayments()}

      {/* Manage Plan Modal */}
      {isManagePlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Your Plan</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Update your subscription settings</p>
                </div>
                <button 
                  onClick={() => setIsManagePlanModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Current Plan</label>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
                    <div className="font-bold text-slate-900 dark:text-white">Pro Plan</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Next billing date: 5/1/2026</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Billing Cycle</label>
                  <div className="relative">
                    <select 
                      value={billingCycle}
                      onChange={(e) => setBillingCycle(e.target.value)}
                      className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Annually">Annually</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-500">
                    Downgrading or canceling your plan will take effect at the end of your current billing cycle.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setIsManagePlanModalOpen(false)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors order-3 sm:order-1"
              >
                Close
              </button>
              <button 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors order-2"
              >
                Cancel Subscription
              </button>
              <button 
                onClick={() => setIsManagePlanModalOpen(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium transition-colors order-1 sm:order-3"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Make Payment Modal */}
      {isMakePaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Make a Payment</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Process a one-time payment</p>
                </div>
                <button 
                  onClick={() => setIsMakePaymentModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Payment Amount</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Payment Method</label>
                  <div className="relative">
                    <select className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Visa ending in 1234</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Description (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="Additional payment"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 mt-6">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Current balance: <span className="font-bold text-slate-900 dark:text-white">$0.00</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setIsMakePaymentModalOpen(false)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsMakePaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium transition-colors"
              >
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Billing Information Modal */}
      {isUpdateBillingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Update Billing Information</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Update your billing address and contact details</p>
                </div>
                <button 
                  onClick={() => setIsUpdateBillingModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Company Name</label>
                  <input 
                    type="text" 
                    defaultValue="Camxian Technologies Ltd."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Billing Email</label>
                  <input 
                    type="email" 
                    defaultValue="billing@camxian.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Address</label>
                  <input 
                    type="text" 
                    defaultValue="123 Main Street"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">City</label>
                    <input 
                      type="text" 
                      defaultValue="San Francisco"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">ZIP Code</label>
                    <input 
                      type="text" 
                      defaultValue="94102"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Country</label>
                  <div className="relative">
                    <select className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>United States</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setIsUpdateBillingModalOpen(false)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsUpdateBillingModalOpen(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium transition-colors"
              >
                Update Information
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Documents Modal */}
      {isTaxDocumentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tax Documents</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Download your tax-related documents</p>
                </div>
                <button 
                  onClick={() => setIsTaxDocumentsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">2026 Tax Summary</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Year-to-date summary</p>
                  </div>
                  <button className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700">
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">2025 Annual Statement</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Complete year summary</p>
                  </div>
                  <button className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700">
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">W-9 Form</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tax identification</p>
                  </div>
                  <button className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setIsTaxDocumentsModalOpen(false)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {isAddPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Payment Method</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Add a new credit or debit card</p>
                </div>
                <button 
                  onClick={() => setIsAddPaymentMethodModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Card Number</label>
                  <input 
                    type="text" 
                    placeholder="1234 5678 9012 3456"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Expiry Date</label>
                    <input 
                      type="text" 
                      placeholder="MM/YY"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">CVC</label>
                    <input 
                      type="text" 
                      placeholder="123"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Cardholder Name</label>
                  <input 
                    type="text" 
                    placeholder="John Smith"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" name="toggle" id="toggle" className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer" />
                    <label htmlFor="toggle" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
                  </div>
                  <label htmlFor="toggle" className="text-sm font-medium text-slate-900 dark:text-white">Set as default payment method</label>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setIsAddPaymentMethodModalOpen(false)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsAddPaymentMethodModalOpen(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium transition-colors"
              >
                Add Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
