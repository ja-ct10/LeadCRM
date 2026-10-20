'use client';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import type { PermissionAction } from '@leadcrm/shared';
import { DataErrorState, DataLoadingSpinner } from '@/shared/components/crm/data-view-states';

export function requiredRoutePermission(path: string): [string, PermissionAction] | null {
  if (path.startsWith('/settings') || path.startsWith('/help') || path === '/inbox' || path === '/notifications') return null;
  const mappings = [
    ['/dashboard','dashboard'], ['/reporting','dashboard'], ['/crm/leads','leads'], ['/crm/contacts','contacts'],
    ['/crm/accounts','accounts'], ['/crm/companies','accounts'], ['/crm/deals','deals'], ['/crm/pipeline','deals'],
    ['/operations/taskboard','tasks'], ['/marketing/campaigns','campaigns'], ['/campaigns','campaigns'],
    ['/automation/workflows','workflows'], ['/marketing/forms','forms'],
    ['/administration/users','users'], ['/administration/roles','roles'],
  ];
  const match = mappings.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'));
  if (!match) return null;
  const module = match[1];
  if (/\/imports?(\/|$)/.test(path)) return [module, module === 'deals' ? 'canCreate' : 'canImport'];
  if (path.endsWith('/new') || path.endsWith('/create')) return [module, 'canCreate'];
  return [module, 'canView'];
}
export function ModuleAccessGuard({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { userCan, isLoading, isPermissionsLoaded, permissionsError, refreshPermissions, user } = useAuth();
  const required = requiredRoutePermission(path);
  if (required && (isLoading || !user)) return <DataLoadingSpinner label="Loading" hideLabel />;
  if (required && !isPermissionsLoaded && user?.role !== 'Client Admin') {
    if (permissionsError) return <DataErrorState message={permissionsError} onRetry={() => void refreshPermissions()} />;
    return <DataLoadingSpinner label="Loading" hideLabel />;
  }
  if (required && !userCan(...required)) return <p role="alert" className="p-4">You do not have permission to access this module.</p>;
  if (required?.[1] === 'canView' && ['leads', 'contacts', 'accounts', 'deals'].includes(required[0]) &&
      !(['canViewAll', 'canViewMy', 'canViewActive'] as const).some(action => userCan(required[0], action))) {
    return <p role="alert" className="p-4">You do not have permission to access this module.</p>;
  }
  return <>{children}</>;
}
