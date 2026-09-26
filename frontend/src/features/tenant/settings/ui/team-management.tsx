'use client';

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

  const [activeTab, setActiveTab] = useState<TeamTab>('Users');
  const [loadedUsers, setLoadedUsers] = useState<User[] | null>(null);
  useEffect(() => { setLoadedUsers(null); }, [tenantId]);

  // These are computed here and passed down to sub-tabs that need them
  const tenantUsers = useMemo(
    () => (loadedUsers ?? users).filter((u) => !u.isArchived && u.tenantId === tenantId),
    [loadedUsers, users, tenantId],
  );

  const tabCounts: Record<TeamTab, number | null> = {
    Users: loadedUsers === null ? null : tenantUsers.length,
    Groups: null,  // loaded inside GroupsSubTab
  };

  return (
    <div className="min-w-0 w-full space-y-4">
      {/* Tab strip */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-white/[0.07]">
        {(['Users', 'Groups'] as TeamTab[]).map((tab) => {
          const count = tabCounts[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5',
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
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'Users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <UsersSubTab onUsersLoaded={setLoadedUsers} />
          </motion.div>
        )}
        {activeTab === 'Groups' && (
          <motion.div key="groups" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GroupsSubTab tenantUsers={tenantUsers} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
