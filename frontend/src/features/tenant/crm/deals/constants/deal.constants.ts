export const DEAL_PRIORITIES = ['Low', 'Medium', 'High'] as const;

export const DEAL_STATUS_LABELS: Record<string, string> = {
  stage_lead:        'Discovery',
  stage_assessment:  'Assessment',
  stage_proposal:    'Proposal',
  stage_negotiation: 'Negotiation',
  stage_won:         'Closed Won',
  stage_lost:        'Closed Lost',
};

export const DEAL_PRIORITY_COLORS: Record<string, string> = {
  Low:    'text-slate-500 bg-slate-100 dark:bg-slate-800',
  Medium: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
  High:   'text-red-600 bg-red-50 dark:bg-red-500/10',
};
