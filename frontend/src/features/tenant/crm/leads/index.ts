// Leads module — barrel export
export { default as LeadsPage } from './ui/leads-page';

// UI components
export { ClientTable } from './ui/leads-table';
export { ClientFilters } from './ui/lead-filters';
export { LeadFormSheet } from './ui/lead-form';
export { UnifiedDetailView } from './ui/lead-detail-view';
export { ClientDetailSheet } from './ui/lead-detail-sheet';

// Hooks
export { useLeads } from './hooks/use-leads';

// Services
export { leadsService } from './services/leads.service';

// Constants
export * from './constants/lead.constants';
