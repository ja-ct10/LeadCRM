'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { usePermissions, PERMISSION_BRIDGE } from '@/shared/hooks/use-permissions';
import { PATHNAME_TO_PATH, PATH_TO_PATHNAME } from '@/lib/route-map';
import {
  LayoutDashboard, Users, Briefcase, Workflow, Mail, Wrench,
  Package, Receipt, Building2, CreditCard, Activity, ListTodo, Layers, Shield, Settings,
} from 'lucide-react';

export const NAV_ITEMS = [
  { name: 'Dashboard',         path: 'dashboard',         icon: LayoutDashboard, permission: null,             roles: null },
  { name: 'My Jobs',           path: 'technician-jobs',   icon: Wrench,          permission: null,             roles: ['Technician'] as const },
  { name: 'Client Profiles',   path: 'contacts',          icon: Users,           permission: 'contacts.view',  roles: null },
  { name: 'Pipeline',          path: 'pipeline',          icon: Briefcase,       permission: 'deals.view',     roles: null },
  { name: 'Tasks',             path: 'tasks',             icon: ListTodo,        permission: 'contacts.view',  roles: null },
  { name: 'Service Orders',    path: 'service-orders',    icon: Wrench,          permission: 'deals.view',     roles: null, featureFlag: 'service' as const },
  { name: 'Asset Tracking',    path: 'assets',            icon: Package,         permission: 'audit.view',     roles: null, featureFlag: 'asset' as const },
  { name: 'Inventory',         path: 'inventory',         icon: Layers,          permission: 'settings.view',  roles: null, featureFlag: 'asset' as const },
  { name: 'Contract Billing',  path: 'billing',           icon: Receipt,         permission: 'billing.view',   roles: null, featureFlag: 'billing' as const },
  { name: 'Workflows',         path: 'workflows',         icon: Workflow,        permission: 'workflows.view', roles: null },
  { name: 'Campaigns',         path: 'campaigns',         icon: Mail,            permission: 'campaigns.view', roles: null },
  { name: 'Users',             path: 'users',             icon: Users,           permission: 'users.view',     roles: null },
  { name: 'Account Details',   path: 'account-details',   icon: Shield,          permission: null,             roles: ['Client Admin'] as const },
  { name: 'Settings',          path: 'settings',          icon: Settings,        permission: null,             roles: null },
  { name: 'Audit Trail',       path: 'audit-log',         icon: Activity,        permission: 'audit.view',     roles: null },
  { name: 'Dashboard',         path: 'admin-dashboard',   icon: LayoutDashboard, permission: null,             roles: ['System Admin'] as const },
  { name: 'Client Management', path: 'admin-clients',     icon: Building2,       permission: null,             roles: ['System Admin'] as const },
  { name: 'Pricing',           path: 'admin-pricing',     icon: CreditCard,      permission: null,             roles: ['System Admin'] as const },
  { name: 'Billing',           path: 'admin-billing',     icon: Receipt,         permission: null,             roles: ['System Admin'] as const },
  { name: 'Environment Health',path: 'admin-environments',icon: Activity,        permission: null,             roles: ['System Admin'] as const },
  { name: 'Audit Trail',       path: 'audit-log',         icon: Activity,        permission: null,             roles: ['System Admin'] as const },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

export function useLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { isServiceModuleEnabled, isAssetModuleEnabled, isBillingModuleEnabled } = useData();
  const userPermissions = usePermissions();

  const currentPath = PATHNAME_TO_PATH[pathname] ?? 'dashboard';

  const navigate = (path: string) => {
    const target = PATH_TO_PATHNAME[path];
    if (target) router.push(target);
  };

  const isSuper = userPermissions.includes('*');

  const featureEnabled = (flag?: 'service' | 'asset' | 'billing') => {
    if (!flag) return true;
    if (flag === 'service') return isServiceModuleEnabled;
    if (flag === 'asset') return isAssetModuleEnabled;
    if (flag === 'billing') return isBillingModuleEnabled;
    return true;
  };

  const hasAccess = (item: NavItem): boolean => {
    if (!featureEnabled((item as any).featureFlag)) return false;

    const itemRoles = (item as any).roles as string[] | null | undefined;

    if (user?.role === 'System Admin') return itemRoles?.includes('System Admin') ?? false;
    if (itemRoles?.includes('System Admin')) return false;
    if (itemRoles && !itemRoles.includes('System Admin')) {
      return itemRoles.includes(user?.role ?? '');
    }
    if (isSuper) return true;
    if (user?.role === 'Guest') {
      const guestAllowed = ['Dashboard', 'Client Profiles', 'Pipeline', 'Workflows', 'Campaigns'];
      const module = item.permission ? item.permission.split('.')[0] : 'dashboard';
      return guestAllowed.some(a => a.toLowerCase() === module.toLowerCase() || module === 'dashboard');
    }
    if (!item.permission) return true;
    const legacyIds = (PERMISSION_BRIDGE as Record<string, string[]>)[item.permission] ?? [];
    return userPermissions.includes(item.permission) || legacyIds.some(id => userPermissions.includes(id));
  };

  const filteredNav = NAV_ITEMS.filter(hasAccess);

  return { currentPath, navigate, filteredNav };
}
