'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '../../../lib/utils';
import { ArrowRight, LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// Base Card Component
// ═══════════════════════════════════════════════════════════════════════════

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  variant?: 'default' | 'outlined' | 'elevated' | 'glass';
}

export function Card({ 
  children, 
  className, 
  hoverable = false,
  variant = 'default',
  ...props 
}: CardProps) {
  const variantStyles = {
    default: 'rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] shadow-lg backdrop-blur-xl',
    outlined: 'rounded-2xl border-2 border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent',
    elevated: 'rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-gray-200 dark:border-white/5',
    glass: 'rounded-2xl bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl border border-white/20 dark:border-white/5 shadow-2xl',
  };

  return (
    <motion.div
      className={cn(
        variantStyles[variant],
        hoverable && 'cursor-pointer transition-all hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]',
        className
      )}
      whileHover={hoverable ? { y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Stat Card Component — Inspired by "Payrolls Cost" design
// ═══════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

export function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon,
  trend,
  className,
  variant = 'default'
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-white dark:bg-white/[0.02]',
    primary: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30',
    success: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30',
    warning: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30',
    danger: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30',
  };

  const trendStyles = {
    up: 'text-emerald-500',
    down: 'text-red-500',
    neutral: 'text-slate-500 dark:text-slate-400',
  };

  return (
    <Card 
      className={cn('p-6', variantStyles[variant], className)}
      hoverable
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {title}
        </h3>
        {Icon && (
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/5">
            <Icon size={18} className="text-slate-600 dark:text-slate-400" />
          </div>
        )}
      </div>

      <div className="mb-2">
        <p className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-2">
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
          {trend && (
            <span className={cn('text-xs font-semibold', trendStyles[trend.direction])}>
              {trend.value}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Info Card Component — Inspired by "Payroll Overview" design
// ═══════════════════════════════════════════════════════════════════════════

interface InfoCardProps {
  title: string;
  description: string;
  linkText?: string;
  onLinkClick?: () => void;
  icon?: LucideIcon;
  className?: string;
}

export function InfoCard({ 
  title, 
  description, 
  linkText = 'Learn more',
  onLinkClick,
  icon: Icon,
  className 
}: InfoCardProps) {
  return (
    <Card className={cn('p-8', className)}>
      {Icon && (
        <div className="mb-6 inline-flex p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20">
          <Icon size={24} className="text-blue-600 dark:text-blue-400" />
        </div>
      )}

      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 font-display">
        {title}
      </h2>

      <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
        {description}
      </p>

      {onLinkClick && (
        <button
          onClick={onLinkClick}
          className="group inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm hover:gap-3 transition-all"
        >
          {linkText}
          <ArrowRight 
            size={16} 
            className="transition-transform group-hover:translate-x-1" 
          />
        </button>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Feature Card Component — Inspired by horizontal card design
// ═══════════════════════════════════════════════════════════════════════════

interface FeatureCardProps {
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  title: string;
  description: string;
  onClick?: () => void;
  className?: string;
  variant?: 'horizontal' | 'vertical';
}

export function FeatureCard({ 
  icon: Icon,
  iconColor = 'text-blue-600',
  iconBgColor = 'bg-blue-50 dark:bg-blue-950/20',
  title, 
  description,
  onClick,
  className,
  variant = 'horizontal'
}: FeatureCardProps) {
  const isClickable = !!onClick;

  if (variant === 'horizontal') {
    return (
      <Card
        className={cn(
          'p-6 transition-all',
          isClickable && 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-700',
          className
        )}
        onClick={onClick}
        hoverable={isClickable}
      >
        <div className="flex items-center gap-4">
          <div className={cn('p-3 rounded-xl shrink-0', iconBgColor)}>
            <Icon size={24} className={cn(iconColor, 'dark:opacity-90')} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              {title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {description}
            </p>
          </div>

          {isClickable && (
            <ArrowRight 
              size={20} 
              className="text-slate-400 dark:text-slate-500 shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" 
            />
          )}
        </div>
      </Card>
    );
  }

  // Vertical variant — Inspired by the grid card designs
  return (
    <Card
      className={cn(
        'p-6 transition-all',
        isClickable && 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-700',
        className
      )}
      onClick={onClick}
      hoverable={isClickable}
    >
      <div className={cn('p-3 rounded-xl inline-flex mb-4', iconBgColor)}>
        <Icon size={28} className={cn(iconColor, 'dark:opacity-90')} />
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>

      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {description}
      </p>

      {isClickable && (
        <div className="mt-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm">
          Learn more
          <ArrowRight size={14} />
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Pricing Card Component
// ═══════════════════════════════════════════════════════════════════════════

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  badgeText?: string;
  onSelect?: () => void;
  className?: string;
}

export function PricingCard({
  name,
  price,
  period,
  features,
  highlighted = false,
  badgeText,
  onSelect,
  className
}: PricingCardProps) {
  return (
    <Card
      className={cn(
        'p-8 relative',
        highlighted && 'border-blue-600 dark:border-blue-500 shadow-2xl ring-2 ring-blue-600/20',
        className
      )}
      variant={highlighted ? 'elevated' : 'default'}
    >
      {badgeText && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-linear-to-r from-blue-600 to-blue-500 text-white text-xs font-bold uppercase tracking-wide shadow-lg">
          {badgeText}
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {name}
        </h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-slate-900 dark:text-white">
            {price}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {period}
          </span>
        </div>
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <svg
              className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-slate-700 dark:text-slate-300">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        className={cn(
          'w-full h-11 px-6 rounded-xl font-bold text-sm transition-all active:scale-95',
          highlighted
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/8 text-slate-900 dark:text-white'
        )}
      >
        Get started
      </button>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Colored Top Border Card Component — Grid variant
// ═══════════════════════════════════════════════════════════════════════════

interface ColoredBorderCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  borderColor?: string;
  iconColor?: string;
  iconBgColor?: string;
  onClick?: () => void;
  className?: string;
}

export function ColoredBorderCard({
  icon: Icon,
  title,
  description,
  borderColor = 'border-t-blue-500',
  iconColor = 'text-blue-600',
  iconBgColor = 'bg-blue-50 dark:bg-blue-950/20',
  onClick,
  className
}: ColoredBorderCardProps) {
  const isClickable = !!onClick;

  return (
    <Card
      className={cn(
        'p-6 border-t-4',
        borderColor,
        isClickable && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      hoverable={isClickable}
    >
      <div className={cn('p-3 rounded-xl inline-flex mb-4', iconBgColor)}>
        <Icon size={28} className={cn(iconColor, 'dark:opacity-90')} />
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>

      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Metric Card with Chart Placeholder
// ═══════════════════════════════════════════════════════════════════════════

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    direction: 'up' | 'down';
  };
  chart?: React.ReactNode;
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  change,
  chart,
  className 
}: MetricCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {value}
          </p>
        </div>
        
        {change && (
          <div className={cn(
            'px-2 py-1 rounded text-xs font-semibold',
            change.direction === 'up' 
              ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
          )}>
            {change.direction === 'up' ? '↑' : '↓'} {change.value}
          </div>
        )}
      </div>

      {chart && (
        <div className="mt-4">
          {chart}
        </div>
      )}
    </Card>
  );
}
