import React from 'react';
import {
  Briefcase, Layers, UserCheck, HeadphonesIcon, RefreshCw, Zap,
} from 'lucide-react';

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  accentColor: string;
  stages: Array<{
    name: string;
    order: number;
    probability: number;
    color: string;
    isDefault?: boolean;
    isWon?: boolean;
    isLost?: boolean;
  }>;
}

export const STAGE_BADGE_CLASSES: Record<string, string> = {
  '#6366f1': 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500 dark:text-indigo-400',
  '#8b5cf6': 'bg-violet-500/10 border-violet-500/30 text-violet-500 dark:text-violet-400',
  '#0ea5e9': 'bg-sky-500/10 border-sky-500/30 text-sky-500 dark:text-sky-400',
  '#3b82f6': 'bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-400',
  '#f59e0b': 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400',
  '#10b981': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400',
  '#ef4444': 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400',
};

export const DEFAULT_STAGE_BADGE = 'bg-slate-500/10 border-slate-500/30 text-slate-500 dark:text-slate-400';

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'inquiry',
    name: 'Inquiry / Sales Pipeline',
    description: 'Classic B2B sales flow from first inquiry to closed deal. Ideal for IT, Telecom & consulting services.',
    icon: <Briefcase size={20} />,
    color: 'bg-blue-500/10 border-blue-500/20',
    accentColor: 'text-blue-500',
    stages: [
      { name: 'New Inquiry', order: 1, probability: 10, color: '#6366f1', isDefault: true },
      { name: 'Contacted', order: 2, probability: 20, color: '#8b5cf6' },
      { name: 'Qualified', order: 3, probability: 40, color: '#0ea5e9' },
      { name: 'Demo / Meeting', order: 4, probability: 55, color: '#3b82f6' },
      { name: 'Proposal Sent', order: 5, probability: 70, color: '#f59e0b' },
      { name: 'Negotiation', order: 6, probability: 85, color: '#f97316' },
      { name: 'Closed Won', order: 7, probability: 100, color: '#10b981', isWon: true },
      { name: 'Closed Lost', order: 8, probability: 0, color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'it-telecom',
    name: 'IT / Telecom Sales',
    description: 'Tailored for IT services and telecom deals — includes technical evaluation and procurement stages.',
    icon: <Layers size={20} />,
    color: 'bg-sky-500/10 border-sky-500/20',
    accentColor: 'text-sky-500',
    stages: [
      { name: 'Lead Identified', order: 1, probability: 10, color: '#6366f1', isDefault: true },
      { name: 'Discovery Call', order: 2, probability: 25, color: '#8b5cf6' },
      { name: 'Technical Eval', order: 3, probability: 40, color: '#0ea5e9' },
      { name: 'Proposal / RFP', order: 4, probability: 55, color: '#3b82f6' },
      { name: 'Procurement', order: 5, probability: 70, color: '#f59e0b' },
      { name: 'Contract Review', order: 6, probability: 85, color: '#f97316' },
      { name: 'Closed Won', order: 7, probability: 100, color: '#10b981', isWon: true },
      { name: 'Closed Lost', order: 8, probability: 0, color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'onboarding',
    name: 'Customer Onboarding',
    description: 'Track new customers through welcome, setup, training, and go-live.',
    icon: <UserCheck size={20} />,
    color: 'bg-emerald-500/10 border-emerald-500/20',
    accentColor: 'text-emerald-500',
    stages: [
      { name: 'Welcome & Kickoff', order: 1, probability: 100, color: '#6366f1', isDefault: true },
      { name: 'Requirements Gather', order: 2, probability: 100, color: '#8b5cf6' },
      { name: 'Setup & Config', order: 3, probability: 100, color: '#0ea5e9' },
      { name: 'User Training', order: 4, probability: 100, color: '#3b82f6' },
      { name: 'UAT / Sign-off', order: 5, probability: 100, color: '#f59e0b' },
      { name: 'Go Live', order: 6, probability: 100, color: '#10b981', isWon: true },
      { name: 'Cancelled', order: 7, probability: 0, color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'support',
    name: 'Service & Support',
    description: 'Manage service tickets, support cases, and issue resolution from open to closed.',
    icon: <HeadphonesIcon size={20} />,
    color: 'bg-amber-500/10 border-amber-500/20',
    accentColor: 'text-amber-500',
    stages: [
      { name: 'Ticket Opened', order: 1, probability: 10, color: '#6366f1', isDefault: true },
      { name: 'Triaged', order: 2, probability: 25, color: '#8b5cf6' },
      { name: 'In Progress', order: 3, probability: 50, color: '#0ea5e9' },
      { name: 'Awaiting Client', order: 4, probability: 60, color: '#f59e0b' },
      { name: 'Testing / QA', order: 5, probability: 80, color: '#3b82f6' },
      { name: 'Resolved', order: 6, probability: 100, color: '#10b981', isWon: true },
      { name: 'Unresolved', order: 7, probability: 0, color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'renewal',
    name: 'Renewal & Upsell',
    description: 'Track subscription renewals, contract expansions, and upsell opportunities.',
    icon: <RefreshCw size={20} />,
    color: 'bg-purple-500/10 border-purple-500/20',
    accentColor: 'text-purple-500',
    stages: [
      { name: 'Renewal Due', order: 1, probability: 40, color: '#6366f1', isDefault: true },
      { name: 'Review Scheduled', order: 2, probability: 55, color: '#8b5cf6' },
      { name: 'Upsell Proposed', order: 3, probability: 65, color: '#0ea5e9' },
      { name: 'Negotiating Terms', order: 4, probability: 80, color: '#f59e0b' },
      { name: 'Contract Sent', order: 5, probability: 90, color: '#3b82f6' },
      { name: 'Renewed / Upsold', order: 6, probability: 100, color: '#10b981', isWon: true },
      { name: 'Churned', order: 7, probability: 0, color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'custom',
    name: 'Blank / Custom',
    description: 'Start with a clean slate and build your own stages from scratch.',
    icon: <Zap size={20} />,
    color: 'bg-slate-500/10 border-slate-500/20',
    accentColor: 'text-slate-400',
    stages: [
      { name: 'Stage 1', order: 1, probability: 10, color: '#6366f1', isDefault: true },
      { name: 'Stage 2', order: 2, probability: 50, color: '#3b82f6' },
      { name: 'Won', order: 3, probability: 100, color: '#10b981', isWon: true },
      { name: 'Lost', order: 4, probability: 0, color: '#ef4444', isLost: true },
    ],
  },
];
