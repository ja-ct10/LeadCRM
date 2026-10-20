'use client';
import { RoleDeletionDialog } from '@/features/tenant/administration/roles/ui/role-deletion-dialog';
import { PageHeader } from '@/shared/components/ui/page-header';


import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Copy, Trash2, Users, Shield, Info, X, MoreHorizontal, Edit2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { toast } from 'sonner';
import type { RoleDefinition, Permission } from '@/store/types';
import { PERMISSION_GROUPS, PERMISSION_MODULES, PERMISSION_ACTION_LABELS, togglePermissionSelection, type PermissionAction } from '@leadcrm/shared';
import { Button, CreateButton } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { DataGrid, type DataGridColumnDef } from '@/shared/components/data-grid';
import { ModuleTabs } from '@/shared/components/crm/module-tabs';
import { ModuleSearchInput } from '@/shared/components/crm/module-search-input';
import { FilterButton } from '@/shared/components/crm/filter-button';
import { LeadsPagination } from '@/shared/components/crm/leads-pagination';
import { matchesSearch } from '@/shared/utils/search';
import { NAV_ITEMS } from '@/features/tenant/layout/use-layout';
import { NAV_GROUPS, SETTINGS_TAB_MODULES } from '../settings-navigation';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';

// ── Permission group definitions ─────────────────────────────────────────────

interface PermGroup {
  id: string;
  label: string;
  description: string;
  modules: string[];
}

const PERM_GROUPS: PermGroup[] = PERMISSION_GROUPS;
const TABLE_ACTIONS: PermissionAction[] = ['canView', 'canCreate', 'canEdit', 'canArchive', 'canImport'];
const PERMISSION_FILTERS = [
  { id: 'all', label: 'All Modules' },
  { id: 'selected', label: 'Has Permissions Selected' },
  { id: 'unselected', label: 'No Permissions Selected' },
] as const;

// ── Shared permission table ──────────────────────────────────────────────────

interface RolePermissionTableProps {
  allPerms: Permission[];
  activePermIds: string[];
  onToggle: (id: string, enabled: boolean) => void;
  onGroupToggle: (ids: string[], enabled: boolean) => void;
  disabled: boolean;
}

function RolePermissionTable({ allPerms, activePermIds, onToggle, onGroupToggle, disabled }: RolePermissionTableProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [permissionFilter, setPermissionFilter] = useState<typeof PERMISSION_FILTERS[number]['id']>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const permissionRows = useMemo(() => {
    const available = new Map(allPerms.map(permission => [permission.id, permission]));
    return PERM_GROUPS.map(group => ({ ...group, permissions: PERMISSION_MODULES
      .filter(module => group.modules.includes(module.key))
      .flatMap(module => module.actions.flatMap(action => {
        const permission = available.get(`${module.key}.${action}`);
        return permission ? [{ ...permission, module, action }] : [];
      })),
    }));
  }, [allPerms]);

  const selected = new Set(activePermIds);
  const countEnabled = (row: typeof permissionRows[number]) => row.permissions.filter(permission => selected.has(permission.id)).length;
  const filteredRows = permissionRows.filter(row => matchesSearch(search, row.label) &&
    (permissionFilter === 'all' || (permissionFilter === 'selected' ? countEnabled(row) > 0 : countEnabled(row) === 0)));
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  useEffect(() => { setPage(current => Math.min(current, totalPages)); }, [totalPages]);

  const availableIds = permissionRows.flatMap(row => row.permissions.map(permission => permission.id));
  const enabled = availableIds.filter(id => selected.has(id)).length;
  const currentPage = Math.min(page, totalPages);
  const clearFilters = () => { setSearch(''); setPermissionFilter('all'); setPage(1); };
  const permissionControl = (permission: typeof permissionRows[number]['permissions'][number], label?: string) => <span key={permission.id} className="flex min-w-0 items-center gap-2">
    <Checkbox id={`role-permission-${permission.id}`} aria-label={permission.name} checked={selected.has(permission.id)}
      disabled={disabled} onCheckedChange={checked => onToggle(permission.id, checked)} />
    {label && <Label htmlFor={`role-permission-${permission.id}`} className="cursor-pointer text-xs font-normal leading-5">{label}</Label>}
  </span>;
  const columns: DataGridColumnDef<typeof permissionRows[number]>[] = [
    { id: 'selection', header: 'Select permissions', accessor: row => row.id, pinned: 'left', width: 44, minWidth: 44, truncate: false,
      headerCell: () => <Checkbox aria-label="Select all permissions" checked={availableIds.length > 0 && enabled === availableIds.length}
        indeterminate={enabled > 0 && enabled < availableIds.length} disabled={disabled || availableIds.length === 0}
        onCheckedChange={checked => onGroupToggle(availableIds, checked)} />,
      cell: (_, row) => <Checkbox aria-label={`Select all ${row.label} permissions`} checked={row.permissions.length > 0 && countEnabled(row) === row.permissions.length}
        indeterminate={countEnabled(row) > 0 && countEnabled(row) < row.permissions.length} disabled={disabled || row.permissions.length === 0}
        onCheckedChange={checked => onGroupToggle(row.permissions.map(permission => permission.id), checked)} /> },
    { id: 'module', header: 'Module', accessor: row => row.label, pinned: 'left', width: 180, minWidth: 160, truncate: false,
      cell: (_, row) => {
        const Icon = NAV_ITEMS.find(item => item.permission === `${row.modules[0]}.view`)?.icon ??
          NAV_GROUPS.flatMap(group => group.items).find(item => SETTINGS_TAB_MODULES[item.id] === row.modules[0])?.icon;
        return <span className="flex min-w-0 items-center gap-2 py-2 font-medium">{Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}<span>{row.label}</span></span>;
      } },
    ...TABLE_ACTIONS.map(action => ({ id: action, header: PERMISSION_ACTION_LABELS[action], accessor: (row: typeof permissionRows[number]) => row.id,
      width: 72, minWidth: 72, align: 'center' as const, truncate: false,
      headerCell: () => <span className="w-full text-center">{PERMISSION_ACTION_LABELS[action]}</span>,
      cell: (_: unknown, row: typeof permissionRows[number]) => {
        const permissions = row.permissions.filter(permission => permission.action === action);
        return <div className="flex w-full flex-col items-center gap-2 py-2">{permissions.length
          ? permissions.map(permission => permissionControl(permission, row.modules.length > 1 ? permission.module.label : undefined))
          : <span className="text-slate-400">—</span>}</div>;
      },
    })),
    { id: 'additional', header: 'Additional Permissions', accessor: row => row.id, width: 280, minWidth: 240, truncate: false,
      cell: (_, row) => {
        const permissions = row.permissions.filter(permission => !TABLE_ACTIONS.includes(permission.action));
        const crm = ['leads', 'contacts', 'accounts', 'deals'].includes(row.id);
        return <div className={cn('w-full gap-x-3 gap-y-1 py-2', crm ? 'grid grid-cols-2' : 'flex flex-col gap-1')}>{permissions.length ? permissions.map(permission =>
          <div key={permission.id} className={crm && permission.action === 'canManageStages' ? 'col-span-2' : undefined}>{permissionControl(permission, permission.name)}</div>) : <span className="text-center text-slate-400">—</span>}</div>;
      } },
    { id: 'enabled', header: 'Enabled', accessor: countEnabled, width: 80, minWidth: 80, truncate: false,
      cell: (_, row) => <div className="flex w-full justify-center"><Badge variant="secondary">{countEnabled(row)}/{row.permissions.length}</Badge></div> },
  ];

  return <>
    <div className="flex min-w-0 flex-wrap items-end justify-between gap-2 border-b border-[#E4E9F0] dark:border-slate-700">
      <ModuleTabs tabs={[{ id: 'all', label: `All Modules ${permissionRows.length}` }]} activeTab="all" ariaLabel="Permission modules" className="w-auto border-b-0" />
      <span aria-live="polite" className="pb-2 text-xs text-slate-500 dark:text-slate-400">{enabled} / {availableIds.length} permissions enabled</span>
    </div>
    <div role="toolbar" aria-label="Module permission controls" className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1 sm:flex-none"><ModuleSearchInput value={search} onChange={value => { setSearch(value); setPage(1); }} placeholder="Search modules..." label="Search modules" disabled={disabled} /></div>
      <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
        <DropdownMenuTrigger asChild><FilterButton title="modules" open={filterOpen} active={permissionFilter !== 'all'} disabled={disabled} /></DropdownMenuTrigger>
        <DropdownMenuContent align="start">{PERMISSION_FILTERS.map(filter => <DropdownMenuItem key={filter.id} role="menuitemradio" aria-checked={permissionFilter === filter.id}
          onSelect={() => { setPermissionFilter(filter.id); setPage(1); }}>{filter.label}{permissionFilter === filter.id && <Check aria-hidden="true" className="ml-auto h-4 w-4" />}</DropdownMenuItem>)}</DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div className="min-w-0">
      <DataGrid columns={columns} data={filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)} getRowId={row => row.id}
        height="auto" enableColumnMenu={false} ariaLabel="Module permissions" summaryLabel={`${filteredRows.length} of ${permissionRows.length} modules`}
        summaryColumns={[{ columnId: 'enabled', content: `${enabled} permissions selected` }]}
        emptyState={{ variant: 'filtered', title: 'No modules found', description: 'Try another search or permission filter.', onClearFilters: clearFilters }} />
      <LeadsPagination currentPage={currentPage} totalRecords={filteredRows.length} pageSize={pageSize} onPageChange={setPage}
        onPageSizeChange={size => { setPageSize(size); setPage(1); }} disabled={disabled} />
    </div>
  </>;
}

// ── Role editor view (full pane) ──────────────────────────────────────────────

interface RoleEditorProps {
  role: RoleDefinition | null; // null = new role
  allPerms: Permission[];
  allUsers: ReturnType<typeof useData>['users'];
  onSave: (name: string, description: string, permIds: string[]) => Promise<void>;
  onCancel: () => void;
}

function RoleEditor({ role, allPerms, allUsers, onSave, onCancel }: RoleEditorProps): React.ReactElement {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [activePermIds, setActivePermIds] = useState<string[]>(role?.permissions ?? []);

  const [nameError, setNameError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const isAdmin = !!role?.isSystemRole && role.name === 'Client Admin';
  const isSystemRole = role?.isSystemRole ?? false;
  const effectivePermIds = isAdmin ? allPerms.map(permission => permission.id) : activePermIds;
  const userCount = allUsers.filter((u) => !u.isArchived && u.role === role?.name).length;

  const handleToggle = useCallback((id: string, v: boolean) => {
    setActivePermIds(prev => togglePermissionSelection(prev, [id], v));
  }, []);

  const handleGroupToggle = useCallback((ids: string[], v: boolean) => {
    setActivePermIds(prev => togglePermissionSelection(prev, ids, v));
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || isSystemRole) return;
    if (!name.trim()) { setNameError('Role name is required.'); return; }
    if (name.trim().length < 2) { setNameError('Name must be at least 2 characters'); return; }
    setNameError(''); setSaveError(''); setSaving(true); submitting.current = true;
    try { await onSave(name.trim(), description.trim(), activePermIds); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to save role. Please try again.'); }
    finally { setSaving(false); submitting.current = false; }
  };

  const totalEnabled = effectivePermIds.length;
  const totalPerms = allPerms.length;
  if (!role) {
    return <motion.form onSubmit={handleSave} noValidate initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="flex w-full min-w-0 flex-col gap-5 p-3 sm:p-6">
      <div className="flex min-w-0 items-start gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Back to roles" disabled={saving} onClick={onCancel} className="shrink-0"><ArrowLeft size={18} /></Button>
        <PageHeader title="Create Custom Role" subtitle="Define a new set of permissions for your team." actionsInlineWithTitle={false} className="mb-0 flex-1"
          actions={<><Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}><Plus aria-hidden="true" />{saving ? 'Saving…' : 'Create Role'}</Button></>} />
      </div>
      {saveError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="role-name">Role Name <span className="text-red-500">*</span></Label>
          <Input id="role-name" required aria-invalid={!!nameError} aria-describedby={nameError ? 'role-name-error' : undefined} maxLength={50} type="text"
            value={name} onChange={event => { setName(event.target.value); if (event.target.value.trim()) setNameError(''); }} placeholder="e.g. Regional Manager" autoFocus disabled={saving} />
          {nameError && <p id="role-name-error" role="alert" className="text-sm text-red-600 dark:text-red-400">{nameError}</p>}
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="role-description">Description <span className="font-normal text-slate-400">— Optional</span></Label>
          <Input id="role-description" maxLength={200} disabled={saving} type="text" value={description} onChange={event => setDescription(event.target.value)} placeholder="Brief description of this role" />
        </div>
      </div>
      <RolePermissionTable allPerms={allPerms} activePermIds={activePermIds} onToggle={handleToggle} onGroupToggle={handleGroupToggle} disabled={saving} />
    </motion.form>;
  }

  return (
    <motion.form onSubmit={handleSave} noValidate
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col min-w-0 w-full p-3 sm:p-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-4 pb-6 border-b border-gray-200 dark:border-white/[0.08] mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" aria-label="Back to roles" disabled={saving} onClick={onCancel} className="shrink-0"><ArrowLeft size={18} /></Button>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{role ? 'Edit Role' : 'Create Custom Role'}</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {role ? 'Modify permissions and settings for this role.' : 'Define a new set of permissions for your team.'}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 order-last sm:order-none">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={isSystemRole || saving}>{saving ? 'Saving…' : role ? 'Save Changes' : 'Create Role'}</Button>
        </div>
      </div>
      {saveError && <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{saveError}</p>}

      {/* Role Details */}
      <div className="pb-6 shrink-0 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <label htmlFor="role-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role Name <span className="text-red-500">*</span></label>
            <input id="role-name" required aria-invalid={!!nameError} aria-describedby={nameError ? "role-name-error" : undefined} maxLength={50} type="text" value={name} onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(''); }} placeholder="e.g. Regional Manager" autoFocus
              disabled={isSystemRole || saving}
              className={cn(
                "w-full px-4 py-2.5 bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#262A33] text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm",
                isSystemRole && "bg-slate-50 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed"
              )} />
            {nameError && <p id="role-name-error" role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>}
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="role-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description <span className="font-normal text-slate-400">— Optional</span></label>
            <input id="role-description" maxLength={200} disabled={isSystemRole || saving} type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this role"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#262A33] text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
          </div>
        </div>
        
        {role && (
          <div className="flex flex-wrap items-center gap-4 pt-2">
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
            The <strong>Client Admin</strong> role always has all permissions enabled and cannot be restricted. To customize access, duplicate this role and modify the copy.
          </p>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-5 pb-6">
        <RolePermissionTable allPerms={allPerms} activePermIds={effectivePermIds} onToggle={handleToggle} onGroupToggle={handleGroupToggle} disabled={isSystemRole || saving} />
      </div>
    </motion.form>
  );
}

// ── Main RolesPermissions component ──────────────────────────────────────────

interface RolesPermissionsProps {
  onViewActiveChange?: (isActive: boolean) => void;
}

export function RolesPermissions({ onViewActiveChange }: RolesPermissionsProps): React.ReactElement {
  const { tenant, userCan } = useAuth();
  const { roles, permissions, rolesLoading, rolesError, refreshRoles, users, addRole, updateRole, deleteRole } = useData();

  // view state
  const [view, setView] = useState<'list' | 'edit' | 'new'>('list');
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const canView = userCan('roles', 'canView');
  const canCreate = userCan('roles', 'canCreate');
  const canEdit = userCan('roles', 'canEdit');
  const canArchive = userCan('roles', 'canArchive');
  const canManage = canCreate || canEdit || canArchive;

  const visibleRoles = useMemo(
    () => roles.filter((r) => !r.isArchived),
    [roles],
  );

  const notify = (isActive: boolean) => onViewActiveChange?.(isActive);

  const openEdit = (role: RoleDefinition) => {
    if (role.isSystemRole || !canEdit) return;
    setSelectedRole(role);
    setView('edit');
    notify(true);
    setOpenDropdownId(null);
  };

  const openNew = () => {
    if (!canCreate) return;
    setSelectedRole(null);
    setView('new');
    notify(true);
  };

  const goList = () => {
    setView('list');
    setSelectedRole(null);
    notify(false);
  };

  const handleSave = async (name: string, description: string, permIds: string[]) => {
    if (!canView || (view === 'new' ? !canCreate : view !== 'edit' || !canEdit)) {
      throw new Error('You do not have permission to save this role.');
    }
    if (view === 'new') {
      await addRole({ name, description, permissions: permIds, isSystemRole: false, userCount: 0 });
      toast.success(`Role "${name}" created`);
    } else if (selectedRole) {
      await updateRole(selectedRole.id, { name, description, permissions: permIds });
      toast.success('Role updated');
    }
    goList();
  };

  const handleCopy = async (role: RoleDefinition) => {
    if (!canView || !canCreate) return;
    try {
      await addRole({ name: `${role.name} (Copy)`, description: role.description, permissions: [...role.permissions], isSystemRole: false, userCount: 0 });
      toast.success(`"${role.name}" duplicated`); setOpenDropdownId(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to duplicate role.'); }
  };

  const handleDeleteConfirm = async (id: string) => {
    if (!canView || !canArchive) throw new Error('You do not have permission to delete roles.');
    try {
      await deleteRole(id); toast.success('Role deleted'); setDeleteConfirmId(null);
      if (view === 'edit' && selectedRole?.id === id) goList();
    } catch (error) { throw new Error(error instanceof Error ? error.message : 'Unable to delete role.'); }
  };

  useEffect(() => { setView('list'); setSelectedRole(null); setDeleteConfirmId(null); onViewActiveChange?.(false); }, [tenant?.id]);
  useEffect(() => {
    if (!canView || view === 'edit' && !canEdit || view === 'new' && !canCreate) {
      setView('list'); setSelectedRole(null); onViewActiveChange?.(false);
    }
    if (!canView || !canArchive) setDeleteConfirmId(null);
    if (!canView || !canManage) setOpenDropdownId(null);
  }, [canView, canEdit, canCreate, canArchive, canManage, view, onViewActiveChange]);

  if (!canView) return <p role="alert">You do not have permission to access this settings section.</p>;

  // ── Editor views ─────────────────────────────────────────────────────────────

  if (view === 'edit' && selectedRole && canEdit) {
    const freshRole = roles.find((r) => r.id === selectedRole.id) ?? selectedRole;
    return (
      <AnimatePresence mode="wait">
        <RoleEditor
          role={freshRole}
          allPerms={permissions}
          allUsers={users}
          onSave={handleSave}
          onCancel={goList}
        />
      </AnimatePresence>
    );
  }

  if (view === 'new' && canCreate) {
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
      <PageHeader title="Roles & Permissions" subtitle="Manage team access and control what users can see and do."
        actions={canCreate && <CreateButton label="Create Custom Role" onClick={openNew} disabled={rolesLoading} />} />

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
        <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm shrink-0">
          <Shield size={16} className="text-slate-700 dark:text-slate-300" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
          Roles allow you to control what users can see and do within the application. System roles provide foundational access levels and cannot be deleted, while Custom roles can be tailored specifically to your organization's unique requirements.{' '}
          A user's effective permissions combine all active assigned custom roles. Disabling a permission here does not remove a grant from another assigned custom role.{' '}
          <Link href="/help/category/roles" className="text-slate-900 dark:text-white font-medium hover:underline underline-offset-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Learn more about RBAC</Link>
        </p>
      </div>

      {/* Role cards grid */}
      {rolesError && <div role="alert" className="p-4 space-y-3 text-sm text-red-600 dark:text-red-400"><p>{rolesError}</p><Button variant="outline" disabled={rolesLoading} onClick={() => void refreshRoles()}>Retry</Button></div>}
      <div className="pt-2" aria-busy={rolesLoading}>
        {rolesLoading && !visibleRoles.length ? <div role="status" aria-label="Loading roles and permissions" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }, (_, index) => <div key={index} aria-hidden="true" className="rounded-2xl border border-gray-200 dark:border-[#262A33] bg-white dark:bg-[#16191E] p-5 shadow-sm">
            <div className="flex gap-3 mb-3"><div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /><div className="min-w-0 flex-1 space-y-2"><div className="h-5 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><div className="h-4 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></div><div className="h-7 w-7 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></div>
            <div className="mb-6 space-y-2"><div className="h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><div className="h-4 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></div>
            <div className="flex justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-4"><div className="h-5 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><div className="h-5 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></div>
          </div>)}
        </div> : <>
        {!rolesError && !visibleRoles.length && <p className="py-8 text-center text-sm text-slate-500">No roles yet.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleRoles.map((role, index) => {
            const roleUserCount = role.userCount;
            const enabledCount = role.isSystemRole && role.name === 'Client Admin' ? permissions.length : role.permissions?.length ?? 0;
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
                    <DropdownMenu open={isDropdownOpen} onOpenChange={open => setOpenDropdownId(current => open ? role.id : current === role.id ? null : current)}>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label={`Actions for ${role.name}`}
                          className={cn(
                            "p-2 rounded-lg transition-colors duration-200",
                            isDropdownOpen
                              ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                              : "text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                          )}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-48" aria-label={`Actions for ${role.name}`}>
                        <DropdownMenuItem disabled={role.isSystemRole || !canEdit} onSelect={() => openEdit(role)}>
                          <Edit2 size={14} className="text-slate-400" /> Edit Permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!canCreate} onSelect={() => handleCopy(role)}>
                          <Copy size={14} className="text-slate-400" /> Duplicate Role
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={role.isSystemRole || !canArchive} destructive onSelect={() => setDeleteConfirmId(role.id)}>
                          <Trash2 size={14} /> Delete Role
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-6 flex-1">
                  {role.description}
                </p>

                {/* Stats Footer */}
                <div className="pt-4 mt-auto border-t border-slate-100 dark:border-white/[0.04] flex flex-wrap gap-2 items-center justify-between text-sm">
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
                    <span className="text-slate-400">permissions</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        </>}
      </div>

      <RoleDeletionDialog
        role={visibleRoles.find(role => role.id === deleteConfirmId) ?? null}
        canDelete={canView && canArchive}
        onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}
        onDelete={handleDeleteConfirm}
      />
    </div>
  );
}
