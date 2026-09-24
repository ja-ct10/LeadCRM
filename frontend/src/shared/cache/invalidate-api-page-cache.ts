import { clearPageCache, invalidatePageCache } from './page-cache';

/** Successful writes invalidate every cached view of the affected data, including imports and drawers. */
export function invalidateApiPageCache(path: string): void {
  const [area, resource] = path.split('?')[0].split('/').filter(Boolean);
  if (area === 'auth' && resource === 'environment') return; // AuthContext commits cache + preference atomically
  if (area === 'auth') {
    clearPageCache();
    return;
  }
  const modules = new Set<string>();
  if (area === 'crm') {
    if (resource === 'leads' || resource === 'contacts') modules.add(`counts-${resource}`);
    if (resource === 'accounts' || resource === 'organizations') modules.add('counts-accounts');
    if (resource === 'deals' || resource === 'pipelines') modules.add('counts-deals');
    if (resource === 'leads' && path.split('?')[0].endsWith('/convert')) {
      ['counts-leads', 'counts-contacts', 'counts-accounts', 'counts-deals'].forEach(module => modules.add(module));
    }
    modules.add('activities');
    modules.add('reports');
    if (resource === 'leads' || resource === 'contacts') {
      // Conversion can update all three entity lists.
      ['leads', 'contacts', 'accounts'].forEach((module) => modules.add(module));
    }
    if (resource === 'accounts' || resource === 'organizations') modules.add('accounts');
    if (resource === 'deals' || resource === 'pipelines') modules.add('pipeline');
  }
  if (area === 'marketing') modules.add('campaigns');
  if (area === 'billing') {
    modules.add('invoices');
    modules.add('activities');
    modules.add('reports');
  }
  if (area === 'notifications') modules.add('notifications');
  if (area === 'operations') {
    modules.add('activities');
    modules.add('reports');
  }
  if (area === 'administration' && (resource === 'roles' || resource === 'users')) {
    clearPageCache();
    return;
  }
  modules.forEach((module) => invalidatePageCache(module));
}
