'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
  module: string;
  actions?: React.ReactNode;
}

/**
 * Contextual breadcrumb-style page header
 * Used consistently across all module pages below the topbar
 * 
 * Example: LeadCRM / Dashboard
 *          LeadCRM / Leads
 *          LeadCRM / Pipeline
 */
export function PageHeader({ module, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-14 z-30 border-b border-gray-200 dark:border-white/[0.08] bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            LeadCRM
          </span>
          <ChevronRight size={14} className="text-slate-400 dark:text-slate-500" />
          <span className="text-slate-900 dark:text-slate-100 font-medium">
            {module}
          </span>
        </div>

        {/* Optional Actions */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
