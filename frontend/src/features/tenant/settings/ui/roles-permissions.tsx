'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Plus, Copy, Trash2, Users, Shield, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import type { RoleDefinition, Permission } from '@/store/types';
import { cn } from '@/lib/utils';

// ── Permission group definitions ─────────────────────────────────────────────
// Maps UI sections to permission categories from MOCK_PERMISSIONS

interface PermGroup {
  id: string;
  label: string;
  description: string;
  permIds: string[];
}

const PERM_GROUPS: PermGroup[] = [
  {
    id: 'org',
    label: 'Organization',
    description: 'Manage users, settings, roles, and organization configuration',
    permIds: ['p22', 'p23', 'p24', 'p25', 'p26', 'p27', 'p28', 'p29', 'p30'],
  },
  {
    id: 'contacts',
    label: 'Contacts & Accounts',
    description: 'View, create, edit, delete, and export contacts and accounts',
    permIds: ['p2', 'p2_own', 'p3', 'p4', 'p4_own', 'p5', 'p5_own', 'p6'],
  },
  {
    id: 'deals',
    label: 'Deals & Pipeline',
    description: 'Manage deals, pipelines, and sales operations',
    permIds: ['p7', 'p7_own', 'p8', 'p9', 'p9_own', 'p10', 'p10_own', 'p11'],
  },
  {
    id: 'workflows',
    label: 'Workflows & Automation',
    description: 'Create and manage automation workflows',
    permIds: ['p12', 'p13', 'p14', 'p15', 'p16'],
  },
  {
    id: 'campaigns',
    label: 'Marketing & Campaigns',
    description: 'Create and send marketing campaigns',
    permIds: ['p17', 'p18', 'p19', 'p20', 'p21'],
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    description: 'View and export analytics reports',
    permIds: ['p31', 'p32', 'p33'],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Access and customize the main dashboard',
    permIds: ['p1', 'p34'],
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Service orders, assets, and inventory management',
    permIds: ['p35', 'p36', 'p37', 'p38'],
  },
];

// ── Toggle component ──────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

function Toggle({ checked, onChange, disabled = false, size = 'sm' }: ToggleProps): React.ReactElement {
  const w = size === 'md' ? 44 : 36;
  const h = size === 'md' ? 24 : 20;
  const thumb = size === 'md' ? 18 : 14;
  const travel = w - h; // px travel for thumb

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{ width: w, height: h, padding: '2px' }}
      className={cn(
        'rounded-full flex items-center transition-colors duration-200 shrink-0',
        checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <div
        style={{ width: thumb, height: thumb, transform: checked ? `translateX(${travel}px)` : 'translateX(0)' }}
        className="bg-white rounded-full shadow-sm transition-transform duration-200"
      />
    </button>
  );
}

// ── Permission row ────────────────────────────────────────────────────────────

interface PermRowProps {
  perm: Permission;
  checked: boolean;
  onChange: (id: string, v: boolean) => void;
  disabled?: boolean;
}

function PermRow({ perm, checked, onChange, disabled }: PermRowProps): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">{perm.name}</p>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{perm.description}</p>
      </div>
      <Toggle checked={checked} onChange={(v) => onChange(perm.id, v)} disabled={disabled} />
    </div>
  );
}

// ── Permission section card ────────────────────────────────────────────────────

interface PermSectionProps {
  group: PermGroup;
  allPerms: Permission[];
  activePermIds: string[];
  onToggle: (id: string, v: boolean) => void;
  onGroupToggle: (ids: string[], v: boolean) => void;
  disabled?: boolean;
}

function PermSection({ group, allPerms, activePermIds, onToggle, onGroupToggle, disabled }: PermSectionProps): React.ReactElement {
  const groupPerms = useMemo(
    () => allPerms.filter((p) => group.permIds.includes(p.id)),
    [allPerms, group.permIds],
  );

  const enabledCount = groupPerms.filter((p) => activePermIds.includes(p.id)).length;
  const allEnabled = enabledCount === groupPerms.length;
  const someEnabled = enabledCount > 0 && !allEnabled;

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-gray-100 dark:border-white/[0.05]">
        <div className="flex items-center gap-3 min-w-0">
          <Toggle
            checked={allEnabled || someEnabled}
            onChange={(v) => onGroupToggle(group.permIds, v)}
            disabled={disabled}
            size="md"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{group.label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">{group.description}</p>
          </div>
        </div>
        <span className={cn(
          'shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full',
          allEnabled ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : someEnabled ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
        )}>
          {enabledCount}/{groupPerms.length}
        </span>
      </div>
      {/* Permission rows */}
      <div className="px-4">
        {groupPerms.map((perm) => (
          <PermRow key={perm.id} perm={perm} checked={activePermIds.includes(perm.id)} onChange={onToggle} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

// ── Role editor view (full pane) ──────────────────────────────────────────────

interface RoleEditorProps {
  role: RoleDefinition | null; // null = new role
  allPerms: Permission[];
  allUsers: ReturnType<typeof useData>['users'];
  onSave: (name: string, description: string, permIds: string[]) => void;
  onCancel: () => void;
  onCopy?: () => void;
}

function RoleEditor({ role, allPerms, allUsers, onSave, onCancel, onCopy }: RoleEditorProps): React.ReactElement {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [activePermIds, setActivePermIds] = useState<string[]>(role?.permissions ?? []);

  const isAdmin = role?.name === 'Administrator' || role?.name === 'Client Admin';
  const isSystemRole = role?.isSystemRole ?? false;
  const userCount = allUsers.filter((u) => !u.isArchived && u.role === role?.name).length;

  const handleToggle = useCallback((id: string, v: boolean) => {
    setActivePermIds((prev) => v ? [...prev, id] : prev.filter((x) => x !== id));
  }, []);

  const handleGroupToggle = useCallback((ids: string[], v: boolean) => {
    setActivePermIds((prev) => {
      const without = prev.filter((x) => !ids.includes(x));
      return v ? [...without, ...ids] : without;
    });
  }, []);

  const handleSave = () => {
    if (!name.trim()) { toast.error('Role name is required'); return; }
    onSave(name.trim(), description.trim(), activePermIds);
  };

  const totalEnabled = activePermIds.length;
  const totalPerms = allPerms.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1 pb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onCancel} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0 transition-colors">
            <ArrowLeft size={14} /> Roles &amp; Permissions
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {role && (
            <div className="flex items-center gap-2 mr-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Users size={13} />
                <span className="font-semibold text-slate-700 dark:text-slate-300 underline underline-offset-2 cursor-pointer">{userCount} user{userCount !== 1 ? 's' : ''}</span>
              </div>
              {onCopy && (
                <button onClick={onCopy} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer" title="Duplicate role">
                  <Copy size={15} />
                </button>
              )}
            </div>
          )}
          <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleSave} className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md shadow-blue-500/20 transition-colors cursor-pointer">
            {role ? 'Done' : 'Save'}
          </button>
        </div>
      </div>

      {/* Role name (editable) */}
      {role ? (
        <div className="pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{role.name}</h2>
            {isSystemRole && (
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded uppercase tracking-wider">System</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">{totalEnabled} of {totalPerms} permissions enabled</p>
        </div>
      ) : (
        <div className="pb-5 shrink-0 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Role Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Super User" autoFocus
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-blue-500 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description <span className="font-normal text-slate-400">Optional</span></label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this role"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors" />
          </div>
        </div>
      )}

      {/* Admin lock banner */}
      {isAdmin && (
        <div className="flex items-start gap-3 p-3.5 bg-blue-500/8 dark:bg-blue-500/10 border border-blue-500/20 rounded-xl mb-5 shrink-0">
          <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            The <strong>Administrator</strong> role always has all permissions enabled and cannot be restricted. To customize access, duplicate this role and modify the copy.
          </p>
        </div>
      )}

      {/* Permission sections — scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-0.5">
        {PERM_GROUPS.map((group) => (
          <PermSection
            key={group.id}
            group={group}
            allPerms={allPerms}
            activePermIds={activePermIds}
            onToggle={handleToggle}
            onGroupToggle={handleGroupToggle}
            disabled={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main RolesPermissions component ──────────────────────────────────────────

interface RolesPermissionsProps {
  onViewActiveChange?: (isActive: boolean) => void;
}

export function RolesPermissions({ onViewActiveChange }: RolesPermissionsProps): React.ReactElement {
  const { user } = useAuth();
  const { roles, permissions, users, addRole, updateRole, deleteRole } = useData();

  // view state
  const [view, setView] = useState<'list' | 'edit' | 'new'>('list');
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const userRoleDef = roles.find((r) => r.name === user?.role);
  const userPerms = userRoleDef?.permissions ?? [];
  const isClientAdmin = user?.role === 'Client Admin';
  const canManage = isClientAdmin || userPerms.includes('p26');

  const visibleRoles = useMemo(
    () => roles.filter((r) => !r.isArchived),
    [roles],
  );

  const notify = (isActive: boolean) => onViewActiveChange?.(isActive);

  const openEdit = (role: RoleDefinition) => {
    setSelectedRole(role);
    setView('edit');
    notify(true);
  };

  const openNew = () => {
    setSelectedRole(null);
    setView('new');
    notify(true);
  };

  const goList = () => {
    setView('list');
    setSelectedRole(null);
    notify(false);
  };

  const handleSave = (name: string, description: string, permIds: string[]) => {
    if (view === 'new') {
      addRole({ name, description, permissions: permIds, isSystemRole: false, userCount: 0 });
      toast.success(`Role "${name}" created`);
    } else if (selectedRole) {
      updateRole(selectedRole.id, { name, description, permissions: permIds });
      toast.success('Role updated');
    }
    goList();
  };

  const handleCopy = (role: RoleDefinition) => {
    addRole({
      name: `${role.name} (Copy)`,
      description: role.description,
      permissions: [...role.permissions],
      isSystemRole: false,
      userCount: 0,
    });
    toast.success(`"${role.name}" duplicated`);
  };

  const handleDeleteConfirm = (id: string) => {
    const role = roles.find((r) => r.id === id);
    deleteRole(id);
    toast.success(`Role "${role?.name}" archived`);
    setDeleteConfirmId(null);
    if (view === 'edit' && selectedRole?.id === id) goList();
  };

  // ── Editor views ─────────────────────────────────────────────────────────────

  if (view === 'edit' && selectedRole) {
    const freshRole = roles.find((r) => r.id === selectedRole.id) ?? selectedRole;
    return (
      <RoleEditor
        role={freshRole}
        allPerms={permissions}
        allUsers={users}
        onSave={handleSave}
        onCancel={goList}
        onCopy={() => { handleCopy(freshRole); goList(); }}
      />
    );
  }

  if (view === 'new') {
    return (
      <RoleEditor
        role={null}
        allPerms={permissions}
        allUsers={users}
        onSave={handleSave}
        onCancel={goList}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Roles &amp; Permissions</h2>
        </div>
        {canManage && (
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-colors cursor-pointer shrink-0">
            <Plus size={14} /> New Role
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/8 dark:bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Roles let you control which actions team members can perform within LeadCRM. Each role defines a set of permissions that apply to every user assigned that role.{' '}
          <button className="underline underline-offset-2 font-semibold cursor-pointer hover:text-blue-600 dark:hover:text-blue-200 transition-colors">Learn more</button>
        </p>
      </div>

      {/* Role cards grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">User Roles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleRoles.map((role) => {
            const roleUserCount = users.filter((u) => !u.isArchived && u.role === role.name).length;
            const enabledCount = role.permissions.length;
            return (
              <motion.div
                key={role.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-white/[0.07] rounded-xl p-4 hover:border-blue-500/40 dark:hover:border-blue-500/30 transition-all cursor-pointer"
                onClick={() => openEdit(role)}
              >
                {/* Role name + badges */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
                      <Shield size={13} className="text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{role.name}</p>
                    </div>
                  </div>
                  {role.isSystemRole && (
                    <span className="shrink-0 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold rounded uppercase tracking-wider">System</span>
                  )}
                </div>

                {/* Description */}
                <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 leading-relaxed min-h-[28px]">{role.description}</p>

                {/* Stats */}
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users size={11} className="shrink-0" />
                    {roleUserCount > 0 ? (
                      <span className="underline underline-offset-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">{roleUserCount} user{roleUserCount !== 1 ? 's' : ''}</span>
                    ) : (
                      <span>No users</span>
                    )}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span>{enabledCount} permission{enabledCount !== 1 ? 's' : ''}</span>
                </div>

                {/* Action buttons — visible on hover */}
                {canManage && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleCopy(role)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer" title="Duplicate">
                      <Copy size={12} />
                    </button>
                    {!role.isSystemRole && (
                      <button onClick={() => setDeleteConfirmId(role.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer" title="Archive role">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* New role card */}
          {canManage && (
            <button onClick={openNew}
              className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all cursor-pointer min-h-[108px]">
              <Plus size={15} /> New role
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirmId(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.07]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Archive role?</h3>
                <button onClick={() => setDeleteConfirmId(null)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"><X size={16} /></button>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  This role will be archived and hidden. Users currently assigned this role will retain their access until reassigned. You can restore it from the Archived Data section.
                </p>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.07]">
                <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">Cancel</button>
                <button onClick={() => handleDeleteConfirm(deleteConfirmId)} className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors cursor-pointer">Archive</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
