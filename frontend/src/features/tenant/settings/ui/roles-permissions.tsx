'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Copy, Trash2, Users, Shield, Info, X, MoreHorizontal, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import type { RoleDefinition, Permission } from '@/store/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

// ── Permission group definitions ─────────────────────────────────────────────

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
        <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">{perm.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{perm.description}</p>
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
    <div className="bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#262A33] rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/[0.05]">
        <div className="flex items-center gap-4 min-w-0">
          <Toggle
            checked={allEnabled || someEnabled}
            onChange={(v) => onGroupToggle(group.permIds, v)}
            disabled={disabled}
            size="md"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{group.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block">{group.description}</p>
          </div>
        </div>
        <span className={cn(
          'shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full',
          allEnabled ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : someEnabled ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
        )}>
          {enabledCount}/{groupPerms.length}
        </span>
      </div>
      {/* Permission rows */}
      <div className="px-5">
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
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col h-full max-w-4xl mx-auto"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between pb-6 shrink-0 border-b border-gray-200 dark:border-white/[0.08] mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={onCancel} className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {role ? 'Edit Role' : 'Create Custom Role'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {role ? 'Modify permissions and settings for this role.' : 'Define a new set of permissions for your team.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-lg shadow-sm transition-all hover:shadow-md">
            {role ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>

      {/* Role Details */}
      <div className="pb-6 shrink-0 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regional Manager" autoFocus
              disabled={isSystemRole}
              className={cn(
                "w-full px-4 py-2.5 bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#262A33] text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm",
                isSystemRole && "bg-slate-50 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed"
              )} />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description <span className="font-normal text-slate-400">— Optional</span></label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this role"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#262A33] text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm" />
          </div>
        </div>
        
        {role && (
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md uppercase tracking-wider",
                isSystemRole 
                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              )}>
                {isSystemRole ? 'System Role' : 'Custom Role'}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <Users size={16} />
              <span className="font-medium">{userCount} user{userCount !== 1 ? 's' : ''} assigned</span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium">{totalEnabled} of {totalPerms}</span> permissions enabled
            </div>
          </div>
        )}
      </div>

      {/* Admin lock banner */}
      {isAdmin && (
        <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl mb-6 shrink-0">
          <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700 dark:text-slate-300">
            The <strong>Administrator</strong> role always has all permissions enabled and cannot be restricted. To customize access, duplicate this role and modify the copy.
          </p>
        </div>
      )}

      {/* Permission sections — scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 pb-10">
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
    </motion.div>
  );
}

// ── Dropdown Menu Component (Local) ───────────────────────────────────────────

interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isSystemRole: boolean;
}

function RoleDropdownMenu({ isOpen, onClose, onEdit, onDuplicate, onDelete, isSystemRole }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={menuRef}
      className="absolute top-10 right-3 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-10 py-1 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={() => { onEdit(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <Edit2 size={14} className="text-slate-400" /> Edit Permissions
      </button>
      <button onClick={() => { onDuplicate(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <Copy size={14} className="text-slate-400" /> Duplicate Role
      </button>
      
      <div className="h-px w-full bg-slate-100 dark:bg-slate-800 my-1" />
      
      {isSystemRole ? (
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <div className="w-full">
                <button disabled className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60">
                  <Trash2 size={14} /> Delete Role
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              System roles cannot be deleted
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <button onClick={() => { onDelete(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
          <Trash2 size={14} /> Delete Role
        </button>
      )}
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
  
  // dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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
    setOpenDropdownId(null);
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
    setOpenDropdownId(null);
  };

  const handleDeleteConfirm = (id: string) => {
    const role = roles.find((r) => r.id === id);
    deleteRole(id);
    toast.success(`Role "${role?.name}" deleted`);
    setDeleteConfirmId(null);
    if (view === 'edit' && selectedRole?.id === id) goList();
  };

  // ── Editor views ─────────────────────────────────────────────────────────────

  if (view === 'edit' && selectedRole) {
    const freshRole = roles.find((r) => r.id === selectedRole.id) ?? selectedRole;
    return (
      <AnimatePresence mode="wait">
        <RoleEditor
          role={freshRole}
          allPerms={permissions}
          allUsers={users}
          onSave={handleSave}
          onCancel={goList}
          onCopy={() => { handleCopy(freshRole); goList(); }}
        />
      </AnimatePresence>
    );
  }

  if (view === 'new') {
    return (
      <AnimatePresence mode="wait">
        <RoleEditor
          role={null}
          allPerms={permissions}
          allUsers={users}
          onSave={handleSave}
          onCancel={goList}
        />
      </AnimatePresence>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Roles &amp; Permissions</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage team access and control what users can see and do.</p>
        </div>
        {canManage && (
          <button onClick={openNew} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold rounded-xl shadow-sm transition-all hover:shadow-md hover:bg-slate-800 dark:hover:bg-slate-100 shrink-0">
            <Plus size={16} /> Create Custom Role
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
        <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm shrink-0">
          <Shield size={16} className="text-slate-700 dark:text-slate-300" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
          Roles allow you to control what users can see and do within the application. System roles provide foundational access levels and cannot be deleted, while Custom roles can be tailored specifically to your organization's unique requirements.{' '}
          <button className="text-slate-900 dark:text-white font-medium hover:underline underline-offset-4 transition-all">Learn more about RBAC</button>
        </p>
      </div>

      {/* Role cards grid */}
      <div className="pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleRoles.map((role, index) => {
            const roleUserCount = users.filter((u) => !u.isArchived && u.role === role.name).length;
            const enabledCount = role.permissions.length;
            const isDropdownOpen = openDropdownId === role.id;
            
            return (
              <motion.div
                key={role.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05, ease: [0.21, 0.47, 0.32, 0.98] }}
                className="group relative bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#262A33] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 flex flex-col h-full"
              >
                {/* Header: Name + Menu */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                      role.isSystemRole 
                        ? "bg-slate-50 border-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300" 
                        : "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
                    )}>
                      <Shield size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">{role.name}</h3>
                      <div className="mt-0.5">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                          role.isSystemRole 
                            ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                        )}>
                          {role.isSystemRole ? 'System' : 'Custom'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions Dropdown */}
                  {canManage && (
                    <div className="relative shrink-0">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(isDropdownOpen ? null : role.id);
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-colors duration-200",
                          isDropdownOpen 
                            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white" 
                            : "text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                        )}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      
                      <RoleDropdownMenu 
                        isOpen={isDropdownOpen}
                        onClose={() => setOpenDropdownId(null)}
                        onEdit={() => openEdit(role)}
                        onDuplicate={() => handleCopy(role)}
                        onDelete={() => setDeleteConfirmId(role.id)}
                        isSystemRole={role.isSystemRole}
                      />
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-6 flex-1">
                  {role.description}
                </p>

                {/* Stats Footer */}
                <div className="pt-4 mt-auto border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Users size={14} className="text-slate-400 dark:text-slate-500" />
                    {roleUserCount > 0 ? (
                      <span className="font-medium hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">{roleUserCount} user{roleUserCount !== 1 ? 's' : ''}</span>
                    ) : (
                      <span>No users</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="font-medium">{enabledCount}</span>
                    <span className="text-slate-400">perms</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirmId(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#262A33] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                    <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Role?</h3>
                </div>
                <button onClick={() => setDeleteConfirmId(null)} className="p-2 -mr-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={18} /></button>
              </div>
              <div className="px-6 py-6">
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Are you sure you want to delete this custom role? Users currently assigned to this role will lose their associated permissions. This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/[0.05]">
                <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">Cancel</button>
                <button onClick={() => handleDeleteConfirm(deleteConfirmId)} className="px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-all hover:shadow-md">Delete Role</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
