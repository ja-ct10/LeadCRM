'use client';
import { useAuth } from '@/store/AuthContext';
import { useHasPermission } from './use-permissions';
import type { PermissionKey } from '@leadcrm/shared';

/** Keep the existing tab IDs/labels; permissions determine both rendering and fallback. */
export function useCrmTabs(module: string, tabs: Array<{ id: string; label: string }>) {
  const { user } = useAuth();
  const grantedAll = useHasPermission(`${module}.view_all` as PermissionKey);
  const grantedMy = useHasPermission(`${module}.view_my` as PermissionKey);
  const grantedActive = useHasPermission(`${module}.view_active` as PermissionKey);
  const all = user?.role === 'Client Admin' || grantedAll;
  const my = user?.role === 'Client Admin' || grantedMy;
  const active = user?.role === 'Client Admin' || grantedActive;
  const allowed = tabs.filter(tab => tab.id === 'all' ? all : tab.id === 'my' ? my && user?.role !== 'Client Admin' : active);
  return { tabs: allowed, firstId: allowed[0]?.id ?? '', permissionKey: allowed.map(tab => tab.id).join(':') };
}
