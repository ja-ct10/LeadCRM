/**
 * Bidirectional route map — App Router pathname ↔ legacy path string.
 * Single source of truth used by CrmLayout, auth pages, and route guards.
 */

export const PATHNAME_TO_PATH: Record<string, string> = {
  '/dashboard':                    'dashboard',
  '/crm/contacts':                 'contacts',
  '/crm/pipeline':                 'pipeline',
  '/automation/workflows':         'workflows',
  '/marketing/campaigns':          'campaigns',
  '/reporting':                    'reports',
  '/administration/users':         'users',
  '/settings':                     'settings',
  '/settings/account':             'account-details',
  '/settings/profile':             'profile-settings',
  '/operations/service-orders':    'service-orders',
  '/operations/tasks':             'technician-jobs',
  '/operations/assets':            'assets',
  '/operations/inventory':         'inventory',
  '/billing':                      'billing',
  '/billing/client':               'client-billing',
  '/administration/audit':         'audit-log',
  '/operations/taskboard':         'tasks',
  '/admin/dashboard':              'admin-dashboard',
  '/admin/clients':                'admin-clients',
  '/admin/pricing':                'admin-pricing',
  '/admin/billing':                'admin-billing',
  '/admin/environments':           'admin-environments',
};

export const PATH_TO_PATHNAME: Record<string, string> = Object.fromEntries(
  Object.entries(PATHNAME_TO_PATH).map(([k, v]) => [v, k])
);
