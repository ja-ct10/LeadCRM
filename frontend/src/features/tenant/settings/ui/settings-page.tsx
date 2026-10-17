'use client';
import { PageHeader } from '@/shared/components/ui/page-header';

import { ProductsPage } from './products-page';
import { ProductInterestsSettings } from './product-interests-settings';

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArchivedData } from './archived-data';
import { useAuth } from "@/store/AuthContext";
import {
  Save,
  ChevronDown,
  Moon,
  Sun,
  Monitor,
  Check,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppearanceSettings } from '@/shared/components/appearance-settings';
import { OrganizationSettingsForm } from './organization-settings-form';
import { SecuritySettings } from './security-settings';
import { ProfileForm } from './profile-form';
import { FormsTab } from './forms-tab';
import { TeamManagement } from './team-management';
import { RolesPermissions } from './roles-permissions';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useWorkspacePanel } from '@/shared/lib/overlay-state';
import { requestNavigation } from '@/shared/lib/navigation-intent';
import { NAV_GROUPS, SETTINGS_TAB_MODULES, type SettingsTab } from '../settings-navigation';

export default function SettingsPage(): React.ReactElement {
  useWorkspacePanel(208, useMediaQuery('(min-width: 1280px)'));
  const { tenant, userCan } = useAuth();

  const tabModules = SETTINGS_TAB_MODULES;
  const canAccessTab = (tab: SettingsTab) => tab === 'users' ? userCan('users', 'canView') || userCan('groups', 'canView') : !tabModules[tab] || userCan(tabModules[tab]!, 'canView');
  const visibleNavGroups = NAV_GROUPS.map(group => ({ ...group, items: group.items.filter(item => canAccessTab(item.id)) })).filter(group => group.items.length);

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isFormBuilderActive, setIsFormBuilderActive] = useState(false);
  const [isRolesViewActive, setIsRolesViewActive] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl = searchParams?.get('tab') ?? null;
  const selectTab = (tab: SettingsTab) => {
    if (tab === activeTab) return;
    requestNavigation(() => { setActiveTab(tab); setIsFormBuilderActive(false); setIsRolesViewActive(false); });
  };

  // Dispatch breadcrumb event to topbar when settings tab changes
  useEffect(() => {
    const group = visibleNavGroups.find(g => g.items.some(i => i.id === activeTab));
    const item = group?.items.find(i => i.id === activeTab);
    if (group && item) {
      window.dispatchEvent(new CustomEvent('settings-tab-change', {
        detail: { group: group.label.charAt(0) + group.label.slice(1).toLowerCase(), tab: item.label },
      }));
    }
  }, [activeTab]);

  // -- Profile Settings Tab --
  const renderProfileTab = (): React.ReactElement => (
    <div className="space-y-6 w-full max-w-6xl"><ProfileForm />
      <SecuritySettings openPassword={searchParams?.get('changePassword') === '1'} onPasswordClose={() => { if (searchParams?.has('changePassword')) { const next = new URLSearchParams(searchParams.toString()); next.delete('changePassword'); router.replace('/settings?' + next.toString()); } }} />
    </div>
  );

  // -- Appearance Tab --
  const renderAppearanceTab = (): React.ReactElement => <AppearanceSettings />;

  const renderOrgGeneralTab = (): React.ReactElement => <OrganizationSettingsForm key={tenant?.id} />;

  // Users (Team Management) Tab
  const renderUsersTab = (): React.ReactElement => <TeamManagement />;

  // â”€â”€ Archived Data Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderArchivedTab = () => <ArchivedData />;

  const renderCustomFieldsTab = () => <ProductInterestsSettings />;

  const tabContentMap: Record<Exclude<SettingsTab, 'forms' | 'roles'>, () => React.ReactElement> = {
    'profile': renderProfileTab,
    'appearance': renderAppearanceTab,
    'org-general': renderOrgGeneralTab,
    'users': renderUsersTab,
    'custom-fields': renderCustomFieldsTab,
    'products': () => <ProductsPage key={tenant?.id} />,
    'archived': renderArchivedTab,
  };

  const VALID_TABS: SettingsTab[] = ['profile', 'appearance', 'org-general', 'users', 'roles', 'custom-fields', 'products', 'archived', 'forms'];
  useEffect(() => {
    if (tabFromUrl === 'account-details') {
      setActiveTab('org-general');
      const params = new URLSearchParams(searchParams?.toString());
      params.set('tab', 'org-general');
      router.replace(`/settings?${params.toString()}`);
      return;
    }
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl as SettingsTab)) {
      setActiveTab(tabFromUrl as SettingsTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl, router]);

  const activeGroup = visibleNavGroups.find((g) => g.items.some((i) => i.id === activeTab));
  const activeItem = activeGroup?.items.find((i) => i.id === activeTab);

  return (
    <div className="flex flex-col xl:flex-row min-w-0 -m-3 sm:-m-4 lg:-m-6 h-[calc(var(--app-viewport-height)-52px)] min-h-0 overflow-hidden">
      {/* Mobile Tab Selector — visible below lg breakpoint */}
      <div className="xl:hidden shrink-0 border-b border-gray-200 dark:border-[#262A33] bg-white dark:bg-[#121418] px-4 py-3">
        <label htmlFor="settings-mobile-nav" className="sr-only">Settings section</label>
        <div className="relative">
          <select
            id="settings-mobile-nav"
            value={activeTab}
            onChange={(e) => selectTab(e.target.value as SettingsTab)}
            className="w-full bg-muted border border-border text-foreground rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium focus:outline-none focus:border-primary transition-colors appearance-none"
          >
            {visibleNavGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Left Sub-Nav (Close CRM #121418) — hidden on mobile */}
      <aside className="hidden xl:block w-52 shrink-0 border-r border-gray-200 dark:border-[#262A33] bg-white dark:bg-[#121418] overflow-y-auto custom-scrollbar py-4 transition-colors">
        {visibleNavGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {group.isTree ? (
              <div>
                <div className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-bold text-slate-700 dark:text-[#CBD5E1] uppercase tracking-wider">
                  {group.icon && React.createElement(group.icon, { className: "w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" })}
                  <span>{group.label}</span>
                </div>
                <div className="relative ml-6 pl-2.5 border-l border-slate-200 dark:border-slate-700/60 my-1 space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => selectTab(item.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer text-left',
                          isActive
                            ? 'border-l-2 -ml-[11px] border-[#2563EB] pl-2.5 text-[#2563EB] dark:text-[#3B82F6] font-semibold'
                            : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-[#1C2027]'
                        )}
                      >
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <p className="px-4 py-1.5 text-[10px] font-bold text-slate-400 dark:text-[#64748B] uppercase tracking-widest">{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => selectTab(item.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer text-left',
                        isActive
                          ? 'border-l-2 border-[var(--primary)] pl-[14px] bg-[var(--color-brand-light)] text-[var(--primary)] font-semibold'
                          : 'border-l-2 border-transparent text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-[#1C2027]'
                      )}
                    >
                      {Icon && React.createElement(Icon as any, { className: "w-3.5 h-3.5 shrink-0" })}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </aside>

      {/* Right Content */}
      {(() => {
        const isFullPane =
          (activeTab === 'forms' && isFormBuilderActive) ||
          (activeTab === 'roles' && isRolesViewActive);
        // Tabs that render their own title/header internally â€” suppress the page header
        const hasOwnHeader =
          activeTab === 'custom-fields' ||
          activeTab === 'products' ||
          activeTab === 'org-general' ||
          activeTab === 'users' ||
          activeTab === 'roles' ||
          activeTab === 'forms';

        // Contain absolute descendants (including sr-only toggle labels) within this scroller.
        return (
          <div className={`relative flex-1 min-h-0 min-w-0 overflow-y-auto custom-scrollbar ${isFullPane ? '' : 'px-4 sm:px-6 py-5'}`}>
            {!isFullPane && !hasOwnHeader && (
              <PageHeader title={activeItem?.label ?? 'Settings'} />
            )}
            {!canAccessTab(activeTab) ? <p role="alert">You do not have permission to access this settings section.</p> : activeTab === 'forms'
              ? <FormsTab onBuilderActiveChange={setIsFormBuilderActive} />
              : activeTab === 'roles'
              ? <RolesPermissions onViewActiveChange={setIsRolesViewActive} />
              : tabContentMap[activeTab as Exclude<SettingsTab, 'forms' | 'roles'>]()
            }
          </div>
        );
      })()}
    </div>
  );
}
