'use client';

import React, { ReactNode } from 'react';
import { BackButton, BackButtonProps } from './back-button';

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
    <div className={`flex min-w-0 items-start justify-between gap-3 mb-4 ${className}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {backButtonProps && (
          <div className="pt-0.5">
            <BackButton {...backButtonProps} />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold leading-7 tracking-tight text-slate-900 dark:text-white [overflow-wrap:anywhere]">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-sm font-normal leading-5 text-slate-500 dark:text-slate-400">
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
