'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Plus, X, Edit2, Trash2, MoreHorizontal, Users,
  ChevronDown, Check, Globe, ArrowLeft, Copy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { toast } from 'sonner';
import type { User } from '@/store/types';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type TeamTab = 'Users' | 'Groups' | 'Domains';

interface Group {
  id: string;
  tenantId: string;
  name: string;
  memberIds: string[];
  createdAt: string;
}

interface Domain {
  id: string;
  tenantId: string;
  domain: string;
  verifiedOn?: string;
  isVerified: boolean;
}

interface DomainSettings {
  restrictToEmailDomains: boolean;
  joinPolicy: 'instantly' | 'after_approval';
  defaultRole: string;
}

const DOMAIN_SETTINGS_KEY = 'leadcrm_domain_settings';
const GROUPS_KEY = 'leadcrm_groups';
const DOMAINS_KEY = 'leadcrm_domains';

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadGroups(tenantId: string): Group[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    const all: Group[] = raw ? JSON.parse(raw) : [];
    return all.filter((g) => g.tenantId === tenantId);
  } catch { return []; }
}

function saveGroups(tenantId: string, groups: Group[]): void {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    const all: Group[] = raw ? JSON.parse(raw) : [];
    const others = all.filter((g) => g.tenantId !== tenantId);
    localStorage.setItem(GROUPS_KEY, JSON.stringify([...others, ...groups]));
  } catch { /* noop */ }
}

function loadDomains(tenantId: string): Domain[] {
  try {
    const raw = localStorage.getItem(DOMAINS_KEY);
    const all: Domain[] = raw ? JSON.parse(raw) : [];
    return all.filter((d) => d.tenantId === tenantId);
  } catch { return []; }
}

function saveDomains(tenantId: string, domains: Domain[]): void {
  try {
    const raw = localStorage.getItem(DOMAINS_KEY);
    const all: Domain[] = raw ? JSON.parse(raw) : [];
    const others = all.filter((d) => d.tenantId !== tenantId);
    localStorage.setItem(DOMAINS_KEY, JSON.stringify([...others, ...domains]));
  } catch { /* noop */ }
}

function loadDomainSettings(tenantId: string): DomainSettings {
  try {
    const raw = localStorage.getItem(`${DOMAIN_SETTINGS_KEY}_${tenantId}`);
    return raw ? JSON.parse(raw) : { restrictToEmailDomains: false, joinPolicy: 'instantly', defaultRole: 'User' };
  } catch { return { restrictToEmailDomains: false, joinPolicy: 'instantly', defaultRole: 'User' }; }
}

function saveDomainSettings(tenantId: string, settings: DomainSettings): void {
  try {
    localStorage.setItem(`${DOMAIN_SETTINGS_KEY}_${tenantId}`, JSON.stringify(settings));
  } catch { /* noop */ }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 8 }: { user: User; size?: number }): React.ReactElement {
  const initials = `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`;
  const px = size * 4; // Tailwind size unit = 4px
  return (
    <div
      style={{ width: px, height: px, minWidth: px }}
      className="rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0 text-xs"
    >
      {initials}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeamManagement(): React.ReactElement {
  const { user: currentUser, tenant } = useAuth();
  const { users, roles, addUser, updateUser, deleteUser } = useData();
  const tenantId = tenant?.id ?? '';

  // Tab state
  const [activeTab, setActiveTab] = useState<TeamTab>('Users');

  // Group & domain state loaded from localStorage
  const [groups, setGroups] = useState<Group[]>(() => loadGroups(tenantId));
  const [domains, setDomains] = useState<Domain[]>(() => loadDomains(tenantId));
  const [domainSettings, setDomainSettings] = useState<DomainSettings>(() => loadDomainSettings(tenantId));

  // Re-load if tenantId changes
  useEffect(() => {
    if (tenantId) {
      setGroups(loadGroups(tenantId));
      setDomains(loadDomains(tenantId));
      setDomainSettings(loadDomainSettings(tenantId));
    }
  }, [tenantId]);

  // Active users for this tenant
  const tenantUsers = useMemo(
    () => users.filter((u) => !u.isArchived && u.tenantId === tenantId),
    [users, tenantId],
  );

  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);

  // Persist helpers
  const persistGroups = (updated: Group[]) => { setGroups(updated); saveGroups(tenantId, updated); };
  const persistDomains = (updated: Domain[]) => { setDomains(updated); saveDomains(tenantId, updated); };
  const persistDomainSettings = (updated: DomainSettings) => { setDomainSettings(updated); saveDomainSettings(tenantId, updated); };

  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Team Management</h2>
      </div>

      {/* Tab strip */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-white/[0.07]">
        {(['Users', 'Groups', 'Domains'] as TeamTab[]).map((tab) => {
          const count = tab === 'Users' ? tenantUsers.length : tab === 'Groups' ? groups.length : null;
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
                <span className={cn('text-[10px] font-bold', activeTab === tab ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>{count}</span>
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
            <UsersTab
              currentUser={currentUser}
              tenantUsers={tenantUsers}
              allUsers={users}
              roleNames={roleNames}
              addUser={addUser}
              updateUser={updateUser}
              deleteUser={deleteUser}
            />
          </motion.div>
        )}
        {activeTab === 'Groups' && (
          <motion.div key="groups" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GroupsTab
              tenantId={tenantId}
              tenantUsers={tenantUsers}
              groups={groups}
              onGroupsChange={persistGroups}
            />
          </motion.div>
        )}
        {activeTab === 'Domains' && (
          <motion.div key="domains" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <DomainsTab
              tenantId={tenantId}
              domains={domains}
              settings={domainSettings}
              roleNames={roleNames}
              onDomainsChange={persistDomains}
              onSettingsChange={persistDomainSettings}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

interface UsersTabProps {
  currentUser: User | null;
  tenantUsers: User[];
  allUsers: User[];
  roleNames: string[];
  addUser: (data: any) => void;
  updateUser: (id: string, updates: Partial<any>) => void;
  deleteUser: (id: string) => void;
}

function UsersTab({ currentUser, tenantUsers, allUsers, roleNames, addUser, updateUser, deleteUser }: UsersTabProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(roleNames[0] ?? 'User');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editError, setEditError] = useState('');
  const [removeUser, setRemoveUser] = useState<User | null>(null);
  const [removeError, setRemoveError] = useState('');

  const filtered = useMemo(
    () => tenantUsers.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
    ),
    [tenantUsers, search],
  );

  const adminCount = useMemo(
    () => tenantUsers.filter((u) => u.role === 'Client Admin' || u.role === 'Administrator').length,
    [tenantUsers],
  );

  const handleInvite = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) { toast.error('Enter a valid email'); return; }
    addUser({ email: inviteEmail.trim(), role: inviteRole, status: 'pending', firstName: inviteEmail.split('@')[0], lastName: '' });
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail(''); setIsInviteOpen(false);
  };

  const openEdit = (u: User) => { setEditUser(u); setEditRole(u.role); setEditError(''); };

  const handleEditSave = () => {
    if (!editUser) return;
    const isSelf = editUser.id === currentUser?.id;
    const isChangingFromAdmin = (editUser.role === 'Client Admin' || editUser.role === 'Administrator') && editRole !== editUser.role;
    if (isSelf && isChangingFromAdmin && adminCount <= 1) {
      setEditError('unable_to_change_role');
      return;
    }
    updateUser(editUser.id, { role: editRole });
    toast.success('Role updated');
    setEditUser(null);
  };

  const openRemove = (u: User) => { setRemoveUser(u); setRemoveError(''); };

  const handleRemove = () => {
    if (!removeUser) return;
    const isSelf = removeUser.id === currentUser?.id;
    if (isSelf && adminCount <= 1) { setRemoveError('cannot_remove_self'); return; }
    deleteUser(removeUser.id);
    toast.success('User removed');
    setRemoveUser(null);
  };

  return (
    <div className="space-y-4">
      {/* Search + invite */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Filter Users..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-400" />
        </div>
        <button onClick={() => setIsInviteOpen(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer">
          <Plus size={13} /> New User
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-[minmax(140px,2fr)_minmax(80px,1fr)_minmax(160px,2fr)_80px_minmax(120px,1.5fr)_minmax(100px,1.5fr)_36px] gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-white/[0.05] min-w-[700px]">
          {['User', 'Role', 'Email & Phone', '2FA', 'Auto-Record Calls', 'Send As', ''].map((h, i) => (
            <div key={i} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              {h === 'Send As' && <span>⚡</span>}{h}
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 min-w-[700px]">No users found</div>
        ) : (
          filtered.map((u) => (
            <div key={u.id} className="grid grid-cols-[minmax(140px,2fr)_minmax(80px,1fr)_minmax(160px,2fr)_80px_minmax(120px,1.5fr)_minmax(100px,1.5fr)_36px] gap-3 px-4 py-3 items-center border-b border-gray-100 dark:border-white/[0.04] last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group min-w-[700px]">
              {/* User */}
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar user={u} size={8} />
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">{u.firstName} {u.lastName}</span>
              </div>
              {/* Role */}
              <span className="text-xs text-slate-700 dark:text-slate-300">{u.role}</span>
              {/* Email & Phone */}
              <div className="min-w-0">
                <p className="text-xs text-blue-500 truncate">{u.email}</p>
                {u.phone && <p className="text-[10px] text-slate-400">{u.phone}</p>}
              </div>
              {/* 2FA */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                2FA <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-slate-400" /></div>
              </div>
              {/* Auto-Record */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                Auto-Record Calls <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-slate-400" /></div>
              </div>
              {/* Send As */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                Send as <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-slate-400" /></div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded cursor-pointer transition-colors"><Edit2 size={12} /></button>
                <button onClick={() => openRemove(u)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded cursor-pointer transition-colors"><Trash2 size={12} /></button>
              </div>
            </div>
          ))
        )}
        </div>
      </div>

      {/* Invite modal */}
      <AnimatePresence>
        {isInviteOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsInviteOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.07]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">New User</h3>
                <button onClick={() => setIsInviteOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"><X size={16} /></button>
              </div>
              <div className="px-6 py-5 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                    autoFocus
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Role</label>
                  <RoleDropdown value={inviteRole} options={roleNames} onChange={setInviteRole} />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.07]">
                <button onClick={() => setIsInviteOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleInvite} className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md shadow-blue-500/20 transition-colors cursor-pointer">Invite</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit role modal */}
      <AnimatePresence>
        {editUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditUser(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.07]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit User &quot;{editUser.firstName} {editUser.lastName}&quot;</h3>
                <button onClick={() => setEditUser(null)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"><X size={16} /></button>
              </div>
              {editError === 'unable_to_change_role' && (
                <div className="mx-6 mt-5 p-4 bg-red-950/60 border border-red-800/40 rounded-xl">
                  <p className="text-xs font-bold text-white mb-1">Unable to change your role.</p>
                  <p className="text-xs text-red-200/80">There must be at least one user with the &quot;Admin&quot; role in your organization. To change your role, assign the &quot;Admin&quot; role to another user first.</p>
                </div>
              )}
              <div className="px-6 py-5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Role</label>
                <RoleDropdown value={editRole} options={roleNames} onChange={setEditRole} />
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.07]">
                <button onClick={() => setEditUser(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleEditSave} className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md shadow-blue-500/20 transition-colors cursor-pointer">Done</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove user modal */}
      <AnimatePresence>
        {removeUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setRemoveUser(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.07]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Remove User / {removeUser.firstName} {removeUser.lastName}</h3>
                <button onClick={() => setRemoveUser(null)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"><X size={16} /></button>
              </div>
              {removeError === 'cannot_remove_self' ? (
                <div className="mx-6 mt-5 p-4 bg-red-950/60 border border-red-800/40 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-white">You can&apos;t remove yourself</p>
                  <p className="text-xs text-red-200/80">There are no other users with the &quot;Manage Organization&quot; permission in your organization. Assign these permissions to another user and try again.</p>
                  <p className="text-xs text-red-200/80">If you&apos;re trying to cancel your account, you can do so from the <button className="text-blue-400 underline cursor-pointer" onClick={() => setRemoveUser(null)}>Plans page</button>.</p>
                </div>
              ) : (
                <div className="px-6 py-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Are you sure you want to remove <span className="font-semibold text-slate-900 dark:text-white">{removeUser.firstName} {removeUser.lastName}</span> from this organization? This cannot be undone.</p>
                </div>
              )}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.07]">
                <button onClick={() => setRemoveUser(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleRemove} className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md shadow-blue-500/20 transition-colors cursor-pointer">Done</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Groups Tab ────────────────────────────────────────────────────────────────

interface GroupsTabProps {
  tenantId: string;
  tenantUsers: User[];
  groups: Group[];
  onGroupsChange: (groups: Group[]) => void;
}

function GroupsTab({ tenantId, tenantUsers, groups, onGroupsChange }: GroupsTabProps): React.ReactElement {
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [addMemberSelected, setAddMemberSelected] = useState<string[]>([]);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const toggleMember = (id: string) =>
    setSelectedMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const availableForNew = tenantUsers.filter((u) =>
    !selectedMemberIds.includes(u.id) &&
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(memberSearch.toLowerCase()),
  );

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) { toast.error('Group name is required'); return; }
    const group: Group = { id: `grp_${Date.now()}`, tenantId, name: newGroupName.trim(), memberIds: selectedMemberIds, createdAt: new Date().toISOString() };
    const updated = [...groups, group];
    onGroupsChange(updated);
    setSuccessMsg(`The group ${group.name} was successfully created.`);
    setIsNewGroupOpen(false); setNewGroupName(''); setSelectedMemberIds([]); setMemberSearch('');
    setActiveGroup(group);
  };

  const handleDeleteGroup = (id: string) => {
    onGroupsChange(groups.filter((g) => g.id !== id));
    if (activeGroup?.id === id) setActiveGroup(null);
    toast.success('Group deleted');
  };

  const handleDuplicateGroup = (group: Group) => {
    const dup: Group = { ...group, id: `grp_${Date.now()}`, name: `${group.name} (Copy)`, createdAt: new Date().toISOString() };
    onGroupsChange([...groups, dup]);
    toast.success('Group duplicated');
  };

  const handleRemoveMember = (groupId: string, userId: string) => {
    const updated = groups.map((g) => g.id === groupId ? { ...g, memberIds: g.memberIds.filter((id) => id !== userId) } : g);
    onGroupsChange(updated);
    setActiveGroup((prev) => prev ? { ...prev, memberIds: prev.memberIds.filter((id) => id !== userId) } : null);
  };

  const handleAddMembers = () => {
    if (!activeGroup) return;
    const updated = groups.map((g) => g.id === activeGroup.id ? { ...g, memberIds: [...g.memberIds, ...addMemberSelected] } : g);
    onGroupsChange(updated);
    setActiveGroup((prev) => prev ? { ...prev, memberIds: [...prev.memberIds, ...addMemberSelected] } : null);
    setAddMemberSelected([]); setIsAddMembersOpen(false);
    toast.success('Members added');
  };

  const handleSaveGroupName = () => {
    if (!activeGroup || !editGroupName.trim()) return;
    const updated = groups.map((g) => g.id === activeGroup.id ? { ...g, name: editGroupName.trim() } : g);
    onGroupsChange(updated);
    setActiveGroup((prev) => prev ? { ...prev, name: editGroupName.trim() } : null);
    setIsEditNameOpen(false); toast.success('Group name updated');
  };

  // Group detail view
  if (activeGroup) {
    const groupData = groups.find((g) => g.id === activeGroup.id) ?? activeGroup;
    const members = tenantUsers.filter((u) => groupData.memberIds.includes(u.id));
    const filteredMembers = members.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(groupMemberSearch.toLowerCase()),
    );
    const available = tenantUsers.filter((u) =>
      !groupData.memberIds.includes(u.id) &&
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()),
    );

    return (
      <div className="space-y-4">
        {/* Back + title */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => { setActiveGroup(null); setSuccessMsg(''); }} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer mb-1">
              <ArrowLeft size={13} /> Groups
            </button>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{groupData.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditGroupName(groupData.name); setIsEditNameOpen(true); }} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"><Edit2 size={15} /></button>
            <div className="relative">
              <button onClick={() => setIsMoreMenuOpen((v) => !v)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"><MoreHorizontal size={15} /></button>
              <AnimatePresence>
                {isMoreMenuOpen && (
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg z-20 py-1 overflow-hidden"
                    onMouseLeave={() => setIsMoreMenuOpen(false)}>
                    <button onClick={() => { handleDuplicateGroup(groupData); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"><Copy size={12} /> Duplicate</button>
                    <button onClick={() => { handleDeleteGroup(groupData.id); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"><Trash2 size={12} /> Delete</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Success banner */}
        <AnimatePresence>
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{successMsg}</p>
              <button onClick={() => setSuccessMsg('')} className="text-amber-500 cursor-pointer"><X size={13} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter + add members */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Filter group members..." value={groupMemberSearch} onChange={(e) => setGroupMemberSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-400" />
          </div>
          <div className="relative ml-auto">
            <button onClick={() => { setIsAddMembersOpen((v) => !v); setAddMemberSelected([]); setMemberSearch(''); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer">
              <Plus size={13} /> Add Members
            </button>
            <AnimatePresence>
              {isAddMembersOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg z-20 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}>
                  <div className="p-2 border-b border-gray-100 dark:border-white/[0.05]">
                    <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded">
                      <input type="checkbox" checked={addMemberSelected.length === available.length && available.length > 0}
                        onChange={(e) => setAddMemberSelected(e.target.checked ? available.map((u) => u.id) : [])}
                        className="w-3.5 h-3.5 accent-blue-500" />
                      Select all
                    </label>
                    {available.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded">
                        <input type="checkbox" checked={addMemberSelected.includes(u.id)}
                          onChange={() => setAddMemberSelected((prev) => prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id])}
                          className="w-3.5 h-3.5 accent-blue-500" />
                        <UserAvatar user={u} size={6} />
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{u.firstName} {u.lastName}</span>
                      </label>
                    ))}
                    {available.length === 0 && <p className="px-2 py-2 text-xs text-slate-400">No users to add</p>}
                  </div>
                  <div className="flex gap-2 justify-end p-2">
                    <button onClick={() => setIsAddMembersOpen(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">Cancel</button>
                    <button onClick={handleAddMembers} className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer">Add Members</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Members table */}
        <div className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-white/[0.07] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <div className="grid grid-cols-[minmax(140px,2fr)_minmax(80px,1fr)_minmax(160px,2fr)_36px] gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-white/[0.05] min-w-[440px]">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{members.length} Member{members.length !== 1 ? 's' : ''}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email & Phone</span>
            <span />
          </div>
          {filteredMembers.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 min-w-[440px]">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Users size={24} className="text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No Members Yet</p>
              <p className="text-xs text-slate-400">Use the button above to add members.</p>
            </div>
          ) : (
            filteredMembers.map((u) => (
              <div key={u.id} className="grid grid-cols-[minmax(140px,2fr)_minmax(80px,1fr)_minmax(160px,2fr)_36px] gap-3 px-4 py-3 items-center border-b border-gray-100 dark:border-white/[0.04] last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors min-w-[440px]">
                <div className="flex items-center gap-2.5"><UserAvatar user={u} size={8} /><span className="text-xs font-semibold text-slate-900 dark:text-white">{u.firstName} {u.lastName}</span></div>
                <span className="text-xs text-slate-600 dark:text-slate-300">{u.role}</span>
                <span className="text-xs text-blue-500 truncate">{u.email}</span>
                <button onClick={() => handleRemoveMember(groupData.id, u.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded cursor-pointer transition-colors"><X size={12} /></button>
              </div>
            ))
          )}
          </div>
        </div>

        {/* Edit name modal */}
        <AnimatePresence>
          {isEditNameOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setIsEditNameOpen(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.07]">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Group Name</h3>
                  <button onClick={() => setIsEditNameOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"><X size={16} /></button>
                </div>
                <div className="px-6 py-5">
                  <input type="text" value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveGroupName()}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.07]">
                  <button onClick={() => setIsEditNameOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">Cancel</button>
                  <button onClick={handleSaveGroupName} className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer">Save</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Groups list
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setIsNewGroupOpen(true); setNewGroupName(''); setSelectedMemberIds([]); setMemberSearch(''); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer">
          <Plus size={13} /> New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Users size={36} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">No groups yet</p>
          <p className="text-xs text-slate-400 mb-4">Create groups to organize your team members</p>
          <button onClick={() => setIsNewGroupOpen(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer mx-auto">
            <Plus size={13} /> Create Group
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-white/[0.07] rounded-xl overflow-hidden">
          {groups.map((g, idx) => (
            <div key={g.id} className={cn('flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer', idx !== 0 && 'border-t border-gray-100 dark:border-white/[0.04]')}
              onClick={() => setActiveGroup(g)}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center"><Users size={14} className="text-blue-500" /></div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{g.name}</p>
                  <p className="text-[10px] text-slate-400">{g.memberIds.length} member{g.memberIds.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* New group modal */}
      <AnimatePresence>
        {isNewGroupOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsNewGroupOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.07]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">New Group</h3>
                <button onClick={() => setIsNewGroupOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"><X size={16} /></button>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Name</label>
                  <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} autoFocus
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Add Members</label>
                  {selectedMemberIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {selectedMemberIds.map((id) => {
                        const u = tenantUsers.find((x) => x.id === id);
                        if (!u) return null;
                        return (
                          <span key={id} className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium">
                            <UserAvatar user={u} size={4} />{u.firstName} {u.lastName}
                            <button onClick={() => toggleMember(id)} className="cursor-pointer hover:text-rose-500"><X size={10} /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className={cn('border rounded-xl overflow-hidden', selectedMemberIds.length > 0 ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700')}>
                    <input type="text" placeholder="Search..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none" />
                  </div>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {availableForNew.length === 0 ? (
                      <div className="py-8 text-center">
                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                          <Users size={20} className="text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-400">There&apos;s no one left to add</p>
                      </div>
                    ) : (
                      availableForNew.map((u) => (
                        <button key={u.id} onClick={() => toggleMember(u.id)}
                          className="w-full flex items-center gap-3 px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors text-left">
                          <UserAvatar user={u} size={8} />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{u.firstName} {u.lastName}</p>
                            <p className="text-[10px] text-slate-400">{u.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.07]">
                <button onClick={() => setIsNewGroupOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleCreateGroup} className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md shadow-blue-500/20 transition-colors cursor-pointer">Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Domains Tab ───────────────────────────────────────────────────────────────

interface DomainsTabProps {
  tenantId: string;
  domains: Domain[];
  settings: DomainSettings;
  roleNames: string[];
  onDomainsChange: (d: Domain[]) => void;
  onSettingsChange: (s: DomainSettings) => void;
}

function DomainsTab({ tenantId, domains, settings, roleNames, onDomainsChange, onSettingsChange }: DomainsTabProps): React.ReactElement {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const filteredRoles = roleNames.filter((r) => r.toLowerCase().includes(roleSearch.toLowerCase()));

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) setIsRoleDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAddDomain = () => {
    if (!domainInput.trim() || !domainInput.includes('.')) { toast.error('Enter a valid domain'); return; }
    const domain: Domain = { id: `dom_${Date.now()}`, tenantId, domain: domainInput.trim().toLowerCase(), verifiedOn: undefined, isVerified: false };
    onDomainsChange([...domains, domain]);
    setDomainInput(''); setVerifyEmail(''); setIsAddOpen(false);
    toast.success(`Domain ${domain.domain} added (pending verification)`);
  };

  const handleRemoveDomain = (id: string) => {
    onDomainsChange(domains.filter((d) => d.id !== id));
    toast.success('Domain removed');
  };

  return (
    <div className="max-w-2xl space-y-5">
      {/* Domain table */}
      <div className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-white/[0.07] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-white/[0.05]">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Domain</span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Verified On</span>
          <span />
        </div>

        {domains.map((d) => (
          <div key={d.id} className="grid grid-cols-[2fr_1fr_auto] gap-3 px-4 py-3 items-center border-b border-gray-100 dark:border-white/[0.04] last:border-0">
            <div className="flex items-center gap-2">
              <Globe size={13} className="text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-900 dark:text-white">{d.domain}</span>
              {d.isVerified
                ? <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/20">Verified</span>
                : <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded border border-amber-500/20">Pending</span>
              }
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{d.verifiedOn ?? '—'}</span>
            <button onClick={() => handleRemoveDomain(d.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"><X size={12} /></button>
          </div>
        ))}

        {/* Add domain row */}
        <div className="px-4 py-3">
          <button onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/[0.08] rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <Plus size={13} /> Add domain
          </button>
        </div>
      </div>

      {/* Restrict toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSettingsChange({ ...settings, restrictToEmailDomains: !settings.restrictToEmailDomains })}
          className={cn('w-10 h-6 rounded-full transition-colors cursor-pointer flex items-center px-0.5 shrink-0', settings.restrictToEmailDomains ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600')}
          role="switch" aria-checked={settings.restrictToEmailDomains}>
          <div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', settings.restrictToEmailDomains ? 'translate-x-[18px]' : 'translate-x-0')} />
        </button>
        <span className="text-xs text-slate-600 dark:text-slate-300">Restrict new users to emails from these domains.</span>
      </div>

      {/* Join policy */}
      <div className="space-y-2">
        <p className="text-xs text-slate-600 dark:text-slate-400">Anyone with an email address at these domains can join this organization...</p>
        {(['instantly', 'after_approval'] as const).map((policy) => (
          <label key={policy} className="flex items-center gap-2.5 cursor-pointer">
            <div onClick={() => onSettingsChange({ ...settings, joinPolicy: policy })}
              className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors shrink-0',
                settings.joinPolicy === policy ? 'border-blue-500' : 'border-slate-400 dark:border-slate-600')}>
              {settings.joinPolicy === policy && <div className="w-2 h-2 rounded-full bg-blue-500" />}
            </div>
            <span className="text-xs text-slate-700 dark:text-slate-300 capitalize">{policy === 'after_approval' ? 'After approval' : 'Instantly'}</span>
          </label>
        ))}
      </div>

      {/* Default member role */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Default member role</label>
        <div ref={roleDropdownRef} className="relative max-w-xs">
          <button onClick={() => setIsRoleDropdownOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500 cursor-pointer">
            {settings.defaultRole}
            <ChevronDown size={13} className={cn('transition-transform', isRoleDropdownOpen && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {isRoleDropdownOpen && (
              <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
                className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-white/[0.05]">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} placeholder="Search..."
                      className="w-full pl-7 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs rounded-lg focus:outline-none border border-slate-200 dark:border-slate-700" />
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredRoles.map((r) => (
                    <button key={r} onClick={() => { onSettingsChange({ ...settings, defaultRole: r }); setIsRoleDropdownOpen(false); setRoleSearch(''); }}
                      className={cn('w-full flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors', r === settings.defaultRole ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]')}>
                      {r}
                      {r === settings.defaultRole && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={() => toast.info('Role permissions page — navigate to Roles & Permissions tab')}
          className="text-[11px] text-blue-500 hover:text-blue-400 cursor-pointer transition-colors">
          See role permissions here
        </button>
      </div>

      {/* Add domain modal */}
      <AnimatePresence>
        {isAddOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsAddOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.07]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add domain</h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"><X size={16} /></button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Domain</label>
                  <input type="text" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="example.com" autoFocus
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-blue-500 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Email for domain verification</label>
                  <input type="email" value={verifyEmail} onChange={(e) => setVerifyEmail(e.target.value)} placeholder="user@example.com"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.07]">
                <button onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleAddDomain} className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md shadow-blue-500/20 transition-colors cursor-pointer">Add domain</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function RoleDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500 cursor-pointer">
        {value} <ChevronDown size={13} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
            className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg z-20 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
            {options.map((o) => (
              <button key={o} onClick={() => { onChange(o); setIsOpen(false); }}
                className={cn('w-full flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors', o === value ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]')}>
                {o}{o === value && <Check size={12} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
