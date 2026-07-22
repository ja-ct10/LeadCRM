'use client';

import React, { ReactNode } from 'react';
import { BackButton, BackButtonProps } from './BackButton';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backButtonProps?: BackButtonProps;
  actions?: ReactNode;
  className?: string;
  badge?: ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  backButtonProps,
  actions,
  className = '',
  badge,
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-200/80 dark:border-white/10 ${className}`}>
      <div className="flex items-start gap-3">
        {backButtonProps && (
          <div className="pt-0.5">
            <BackButton {...backButtonProps} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
