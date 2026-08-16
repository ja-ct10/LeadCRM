import React from 'react';
import { Mail, Smartphone, MousePointerClick, Activity } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  percentage?: number;
  icon: React.ElementType;
  colorClass: string;
  className?: string;
}

export function AnalyticsCard({ title, value, percentage, icon: Icon, colorClass, className }: AnalyticsCardProps) {
  return (
    <div className={cn("bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl p-6 shadow-sm flex flex-col justify-between", className)}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</span>
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
        </div>
        <div className={cn("p-3 rounded-lg flex items-center justify-center", colorClass)}>
          {React.createElement(Icon as any, { className: "w-5 h-5" })}
        </div>
      </div>
      
      {percentage !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className={cn("h-1.5 rounded-full transition-all duration-500", colorClass.replace('bg-', 'bg-').replace('/10', '').replace('/20', '').replace('text-', 'bg-').split(' ').find(c => c.startsWith('bg-')) || 'bg-blue-500')}
              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">
            {percentage.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

export function CampaignAnalytics({ type, metrics }: { type: 'EMAIL' | 'SMS' | 'MULTI_CHANNEL', metrics: any }) {
  const sent = metrics?.sentCount || 0;
  const delivered = metrics?.deliveredCount || 0;
  const opened = metrics?.openedCount || 0;
  const clicked = metrics?.clickedCount || 0;
  const bounced = metrics?.bouncedCount || 0;

  const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
  const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
  const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;
  const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <AnalyticsCard
        title="Sent Messages"
        value={sent}
        icon={type === 'EMAIL' ? Mail : Smartphone}
        colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
      />
      
      <AnalyticsCard
        title="Delivery Rate"
        value={`${deliveryRate.toFixed(1)}%`}
        percentage={deliveryRate}
        icon={Activity}
        colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      />

      {(type === 'EMAIL' || type === 'MULTI_CHANNEL') && (
        <AnalyticsCard
          title="Open Rate"
          value={`${openRate.toFixed(1)}%`}
          percentage={openRate}
          icon={Mail}
          colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      )}

      {(type === 'EMAIL' || type === 'MULTI_CHANNEL') && (
        <AnalyticsCard
          title="Click Rate"
          value={`${clickRate.toFixed(1)}%`}
          percentage={clickRate}
          icon={MousePointerClick}
          colorClass="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
        />
      )}
    </div>
  );
}
