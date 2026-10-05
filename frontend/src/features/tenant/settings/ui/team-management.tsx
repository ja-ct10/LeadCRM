'use client';
import { PageHeader } from '@/shared/components/ui/page-header';


import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { cn } from '@/lib/utils';
import { UsersSubTab } from './team-management-users';
import { GroupsSubTab } from './team-management-groups';
import type { User } from '@/store/types';

type TeamTab = 'Users' | 'Groups';

// ── TeamManagement ─────────────────────────────────────────────────────────

export function TeamManagement(): React.ReactElement {
  const { user: currentUser } = useAuth();
  const { users } = useData();
  const tenantId = currentUser?.tenantId ?? '';

  const isClientAdmin = currentUser?.role?.trim().toLowerCase() === 'client admin';
  const visibleTabs: TeamTab[] = isClientAdmin ? ['Users', 'Groups'] : ['Groups'];
  const [activeTab, setActiveTab] = useState<TeamTab>('Groups');
  const [loadedUsers, setLoadedUsers] = useState<User[] | null>(null);
  useEffect(() => { setLoadedUsers(null); }, [tenantId]);
  useEffect(() => { setActiveTab(isClientAdmin ? 'Users' : 'Groups'); }, [isClientAdmin, tenantId]);

  // These are computed here and passed down to sub-tabs that need them
  const tenantUsers = useMemo(
    () => (loadedUsers ?? users).filter((u) => !u.isArchived && u.tenantId === tenantId),
    [loadedUsers, users, tenantId],
  );

  const tabCounts: Record<TeamTab, number | null> = {
    Users: loadedUsers === null ? null : tenantUsers.length,
    Groups: null,  // loaded inside GroupsSubTab
  };

  const renderHeader = (action: React.ReactNode) => (
      <div className="flex min-w-0 items-center gap-0 border-b border-gray-200 dark:border-white/[0.07]">
        {visibleTabs.map((tab) => {
          const count = tabCounts[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative px-2 sm:px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5',
                activeTab === tab
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              {tab}
              {count !== null && (
                <span className={cn('text-[10px] font-bold', activeTab === tab ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>
                  {count}
                </span>
              )}
              {activeTab === tab && (
                <motion.div layoutId="team-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          );
        })}
        <div className="ml-auto shrink-0 pl-2 pb-1">{action}</div>
      </div>

  );

  return (
    <div className="min-w-0 w-full space-y-4">
      <PageHeader title="Team Management" subtitle="Manage users and groups within Camxian Technologies." />
      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'Users' && isClientAdmin && (
          <motion.div key="users" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <UsersSubTab renderHeader={renderHeader} onUsersLoaded={setLoadedUsers} />
          </motion.div>
        )}
        {activeTab === 'Groups' && currentUser && (
          <motion.div key="groups" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GroupsSubTab renderHeader={renderHeader} tenantUsers={tenantUsers} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
