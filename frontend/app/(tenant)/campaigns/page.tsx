import React from 'react';
import Link from 'next/link';
import { Plus, Mail, MessageSquare, MoreVertical, Calendar } from 'lucide-react';
import { PrismaClient } from '@prisma/client';
import { CampaignAnalytics } from '@/src/features/tenant/marketing/campaigns/components/AnalyticsCards';
import { format } from 'date-fns';

const prisma = new PrismaClient();

// This would normally come from session/auth context
const TENANT_ID = 'default-tenant-id';

export default async function CampaignsPage() {
  // Fetch campaigns
  const campaigns = await prisma.campaign.findMany({
    where: { tenantId: TENANT_ID, isArchived: false },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { campaignContacts: true }
      }
    }
  });

  // Fetch some aggregate metrics for the analytics cards
  // In a real app, you would aggregate these from EmailDeliveryLog and SMSQueue
  // For now, we simulate the aggregation
  const emailLogs = await prisma.emailDeliveryLog.groupBy({
    by: ['status'],
    where: { tenantId: TENANT_ID },
    _count: true
  });

  const smsLogs = await prisma.sMSQueue.groupBy({
    by: ['status'],
    where: { tenantId: TENANT_ID },
    _count: true
  });

  const getMetric = (logs: any[], status: string) => {
    return logs.find(l => l.status === status)?._count || 0;
  };

  const emailMetrics = {
    sentCount: getMetric(emailLogs, 'sent') + getMetric(emailLogs, 'delivered'),
    deliveredCount: getMetric(emailLogs, 'delivered'),
    openedCount: getMetric(emailLogs, 'opened'),
    clickedCount: getMetric(emailLogs, 'clicked'),
    bouncedCount: getMetric(emailLogs, 'failed'),
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Campaigns</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage and track your email and SMS marketing campaigns.
          </p>
        </div>
        <Link
          href="/campaigns/create"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </Link>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Performance</h2>
        <CampaignAnalytics type="EMAIL" metrics={emailMetrics} />
      </div>

      <div className="mt-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 dark:text-white">All Campaigns</h3>
          <div className="flex items-center gap-2">
            <select className="text-sm border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <option>All Types</option>
              <option>Email</option>
              <option>SMS</option>
            </select>
            <select className="text-sm border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <option>All Statuses</option>
              <option>Draft</option>
              <option>Scheduled</option>
              <option>Active</option>
              <option>Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-3">Campaign</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Recipients</th>
                <th className="px-6 py-3">Created / Scheduled</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No campaigns found. Create one to get started.
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {campaign.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                        ${campaign.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : ''}
                        ${campaign.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : ''}
                        ${campaign.status === 'SCHEDULED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : ''}
                        ${campaign.status === 'DRAFT' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' : ''}
                      `}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                        {campaign.type === 'EMAIL' && <Mail className="w-4 h-4" />}
                        {campaign.type === 'SMS' && <MessageSquare className="w-4 h-4" />}
                        {campaign.type === 'MULTI_CHANNEL' && (
                          <div className="flex -space-x-1">
                            <Mail className="w-4 h-4 z-10 bg-white dark:bg-gray-900 rounded-full" />
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                          </div>
                        )}
                        <span className="capitalize">{campaign.type.toLowerCase().replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {campaign._count.campaignContacts}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      {campaign.status === 'SCHEDULED' && campaign.scheduledFor ? (
                        <>
                          <Calendar className="w-3.5 h-3.5 text-amber-500" />
                          {format(campaign.scheduledFor, 'MMM d, yyyy h:mm a')}
                        </>
                      ) : (
                        format(campaign.createdAt, 'MMM d, yyyy')
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
