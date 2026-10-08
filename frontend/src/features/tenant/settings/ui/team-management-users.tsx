'use client';
import type { DeactivationImpact } from '@leadcrm/shared';
import { AssignedAgentSelect } from '@/shared/components/crm/assigned-agent-select';
import { CreateButton } from '@/shared/components/ui/button';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { compareSortValues } from '@leadcrm/shared';
import {
  Plus, X, UserCheck, UserX,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { usePagination } from '@/shared/hooks/use-pagination';
import { LeadsPagination, LEADS_PAGE_SIZES } from '@/shared/components/crm/leads-pagination';
import { FilterGroupSection } from '@/shared/components/crm/module-workspace';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import { usersService } from '@/features/tenant/administration/users/services/users.service';
import { DataGrid, type DataGridColumnDef, type SortState } from '@/shared/components/data-grid';
import { BulkSelectionBar, executeSelectedRows } from '@/shared/components/crm/bulk-selection-bar';
import { ModuleTableToolbar } from '@/shared/components/crm/module-table-toolbar';
import { FilterButton } from '@/shared/components/crm/filter-button';
import { useModuleTableColumns } from '@/shared/hooks/use-module-table-columns';
import { USERS_TABLE_COLUMNS } from '@leadcrm/shared';
import { UserPanel } from './user-panel';
import { UserAvatar as ProfileAvatar } from '@/shared/components/user-avatar';
import { DataErrorState } from '@/shared/components/crm/data-view-states';
import { TableLoadingState } from '@/shared/components/crm/table-loading-state';
import { cn } from '@/lib/utils';
import type { User } from '@/store/types';

// ── Avatar ─────────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 8 }: { user: User; size?: number }): React.ReactElement {
  const px = size * 4;
  // Private profile images are read through the tenant's users permission guard.
  const avatarUrl = user.avatarUrl?.startsWith('/api/proxy/auth/profile/avatar/')
    ? user.avatarUrl.replace('/api/proxy/auth/profile/avatar/', `/api/proxy/administration/users/${encodeURIComponent(user.id)}/avatar/`)
    : user.avatarUrl;
  return (
    <div style={{ width: px, height: px, minWidth: px }}
      className="rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0 text-[10px]">
      <ProfileAvatar user={{ ...user, avatarUrl }} />
    </div>
  );
}

// ── Role colour helper ──────────────────────────────────────────────────────

function roleColor(role: string): string {
  if (role === 'Administrator' || role === 'Client Admin') return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
  if (role === 'Sales Manager') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  if (role === 'Support Agent' || role === 'Technician') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  if (role === 'Marketing Manager') return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
  if (role === 'Viewer') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20';
}

// ── Main UsersSubTab ──────────────────────────────────────────────────────────

export function UsersSubTab({ onUsersLoaded, renderHeader }: { renderHeader?: (action: React.ReactNode) => React.ReactNode; onUsersLoaded?: (users: User[]) => void }): React.ReactElement {
  const { user: currentUser, userCan } = useAuth();
  const { roles, rolesLoading, rolesError, refreshRoles } = useData();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const tenantId = currentUser?.tenantId ?? '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError(null);
    const load = async () => {
      try {
        const result: User[] = [];
        let page = 1;
        while (!cancelled) {
          const response = await usersService.getAll({ page, limit: 100 });
          result.push(...(response.data ?? []));
          if (!response.meta?.hasMore) break;
          page++;
        }
        if (!cancelled) {
          setAllUsers(result);
          onUsersLoaded?.(result);
        }
      } catch (error) { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load users.'); }
      finally { if (!cancelled) setLoading(false); }
    };
    if (tenantId) void load();
    return () => { cancelled = true; };
  }, [tenantId, reload, onUsersLoaded]);

  const tenantUsers = useMemo(
    () => allUsers.filter((u) => u.tenantId === tenantId),
    [allUsers, tenantId],
  );
  const roleNames = useMemo(() => roles.filter((r) => !r.isArchived).map((r) => r.name), [roles]);
  const roleObjs = useMemo(() => roles.filter((r) => !r.isArchived && !r.isSystemRole).map((r) => ({ id: r.id, name: r.name })), [roles]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>({ field: 'createdAt', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(false);
  const departments = useMemo(() => [...new Set(tenantUsers.map(u => u.department).filter((value): value is string => !!value?.trim()))].sort(), [tenantUsers]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [initiallyEditing, setInitiallyEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<User | null>(null);
  useEffect(() => { setEditingUser(null); setIsAddOpen(false); }, [tenantId]);
  const [confirmArchive, setConfirmArchive] = useState<User | null>(null);
  const [statusChangeUser, setStatusChangeUser] = useState<User | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [impact, setImpact] = useState<DeactivationImpact | null>(null);
  const [replacement, setReplacement] = useState('');
  const [reassignUser, setReassignUser] = useState<User | null>(null);
  const [preflighting, setPreflighting] = useState(false);
  const beginStatusChange = async (target: User) => {
    if (preflighting) return;
    setReplacement(''); setImpact(null);
    if (target.status !== 'active') { setStatusChangeUser(target); return; }
    setPreflighting(true);
    try {
      const result = await usersService.deactivationImpact(target.id);
      if (!result.data) throw new Error('Unable to check CRM ownership.');
      setImpact(result.data); setReassignUser(target);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to check CRM ownership.'); }
    finally { setPreflighting(false); }
  };

  const filtered = useMemo(() => {
    return tenantUsers.filter((u) => {
      const matchSearch = !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter.length === 0 || roleFilter.includes(u.role);
      const matchStatus = statusFilter.length === 0 || statusFilter.some((s) => s.toLowerCase() === (u.status ?? '').toLowerCase());
      return matchSearch && matchRole && matchStatus && (departmentFilter.length === 0 || departmentFilter.includes(u.department ?? ''));
    }).sort((a, b) => {
      const value = (u: User) => sort.field === 'name' ? `${u.firstName} ${u.lastName}` : sort.field === 'createdAt' ? u.createdAt ? new Date(u.createdAt) : null : u[sort.field as keyof User];
      return compareSortValues(value(a), value(b), sort.direction) || a.id.localeCompare(b.id);
    });
  }, [tenantUsers, search, roleFilter, statusFilter, departmentFilter, sort]);

  const { currentPage, pageSize, totalItems, paginateItems, goToPage, setPageSize } = usePagination({
    totalItems: filtered.length,
    initialPageSize: 25,
    pageSizeOptions: LEADS_PAGE_SIZES,
    resetDeps: [search, roleFilter, statusFilter, departmentFilter, sort],
  });
  const paginated = paginateItems(filtered);
  useEffect(() => { setSelected(new Set()); }, [tenantId, currentPage, pageSize, search, roleFilter, statusFilter, departmentFilter]);
  const openUser = (user: User, edit = false) => { setInitiallyEditing(edit); setEditingUser(user); };

  const handleSavedUser = (saved: User, refresh = true) => {
    setAllUsers(previous => previous.some(user => user.id === saved.id) ? previous.map(user => user.id === saved.id ? saved : user) : [saved, ...previous]);
    if (refresh) setReload(value => value + 1);
  };
  const [archiving, setArchiving] = useState(false);
  const handleArchive = async () => {
    if (!confirmArchive || archiving) return;
    setArchiving(true);
    try {
      await usersService.archive(confirmArchive.id);
      setConfirmArchive(null); setSelected(new Set()); setReload(value => value + 1);
      toast.success('User archived');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to archive user.'); }
    finally { setArchiving(false); }
  };

  const handleStatusChange = async () => {
    if (!statusChangeUser || changingStatus) return;
    const nextStatus = statusChangeUser.status === 'active' ? 'inactive' : 'active';
    setChangingStatus(true);
    try {
      if (nextStatus === 'inactive') {
        const result = await usersService.deactivate(statusChangeUser.id, replacement || null);
        handleSavedUser(result.user, false);
        toast.success(result.impact.total ? 'CRM records transferred successfully and user deactivated.' : 'User deactivated successfully.');
      } else {
        const result = await usersService.update(statusChangeUser.id, { status: nextStatus });
        if (!result.data) throw new Error('Unable to update user status.');
        handleSavedUser(result.data, false);
        window.dispatchEvent(new Event('leadcrm:users-changed'));
        toast.success('User activated.');
      }
      setStatusChangeUser(null); setReassignUser(null); setImpact(null); setReplacement('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reassign CRM records. The user was not deactivated.');
      if (nextStatus === 'inactive') {
        setStatusChangeUser(null); setReplacement(''); setReload(value => value + 1);
        try {
          const refreshed = await usersService.deactivationImpact(statusChangeUser.id);
          if (!refreshed.data) throw new Error('Ownership counts unavailable.');
          setImpact(refreshed.data); setReassignUser(statusChangeUser);
        } catch { setReassignUser(null); setImpact(null); }
      }
    } finally {
      setChangingStatus(false);
    }
  };

  const canAssignRoles = userCan('roles', 'canAssign');
  const canManageUsers = userCan('users', 'canEdit'), canCreateUsers = userCan('users', 'canCreate') && userCan('roles', 'canAssign'), canActivateUsers = userCan('users', 'canActivate'), canArchiveUsers = userCan('users', 'canArchive');
  const columns: DataGridColumnDef<User>[] = [
    { id: 'name', sortable: true, header: 'User', accessor: u => `${u.firstName} ${u.lastName}`, width: 240, cell: (_, u) => <button aria-label={`View ${u.firstName} ${u.lastName}`} onClick={() => openUser(u)} className="flex items-center gap-2 text-left"><UserAvatar user={u} /><span>{u.firstName} {u.lastName}</span></button> },
    { id: 'role', sortable: true, header: 'Role', accessor: u => u.role, width: 180, cell: (_, u) => <span className={cn('rounded-full border px-2 py-0.5 text-xs', roleColor(u.role))}>{u.role}</span> },
    { id: 'email', sortable: true, header: 'Contact', accessor: u => u.email, width: 250, cell: (_, u) => <div><p>{u.email}</p><p className="text-xs text-muted-foreground">{u.phone}</p></div> },
    { id: 'status', sortable: true, header: 'Status', accessor: u => u.status ?? 'active', width: 110, cell: (_, u) => <span className={cn('rounded-full px-2 py-1 text-xs', u.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500')}>{u.status ?? 'active'}</span> },
    { id: 'department', sortable: true, header: 'Department', accessor: u => u.department || '—', width: 150 },
    { id: 'activity', header: 'Actions', accessor: () => '', width: 90, cell: (_, u) => {
      const active = u.status === 'active';
      const label = active ? `Deactivate ${u.firstName} ${u.lastName}` : `Activate ${u.firstName} ${u.lastName}`;
      return <button type="button" aria-label={label} title={active ? 'Deactivate user' : 'Activate user'} disabled={!canActivateUsers || preflighting} className="min-h-11 min-w-11 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void beginStatusChange(u)}>{active ? <UserX size={16} /> : <UserCheck size={16} />}</button>;
    } },
  ];

  const tableColumns = useModuleTableColumns('users', USERS_TABLE_COLUMNS, columns);
  const createAction = canCreateUsers && <CreateButton label="New User" disabled={rolesLoading || !!rolesError} onClick={() => setIsAddOpen(true)} />;

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {renderHeader ? renderHeader(createAction) : <div className="flex justify-end">{createAction}</div>}
      {tableColumns.drawer}
      {rolesError && <div role="alert" className="text-sm text-red-500">{rolesError} <button onClick={() => void refreshRoles()} className="underline">Retry roles</button></div>}
      <ModuleTableToolbar label="Users" search={search} onSearch={setSearch} placeholder="Search users..."
        filter={<FilterButton title="users" open={showFilters} active={!!(roleFilter.length || statusFilter.length || departmentFilter.length)} onClick={() => setShowFilters(value => !value)} />}
        refreshing={loading} onRefresh={() => setReload(value => value + 1)} onManageColumns={tableColumns.openColumns} />

      <div className="flex min-w-0 gap-3 items-stretch">
        {showFilters && <div className="fixed inset-0 z-30 bg-black/30 sm:hidden" aria-hidden="true" onClick={() => setShowFilters(false)} />}
        {showFilters && <motion.aside initial={{ x: -260, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          id="user-filters" aria-label="User filters" onKeyDown={event => { if (event.key === 'Escape') setShowFilters(false); }}
          className="fixed inset-y-0 left-0 z-40 w-[260px] max-w-full flex flex-col shadow-2xl sm:static sm:z-auto sm:shadow-none sm:max-h-[calc(100dvh-12rem)] shrink-0 sm:self-start sm:rounded-xl border border-[#E4E9F0] dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#E4E9F0] dark:border-slate-700">
            <span className="text-[13px] font-semibold text-slate-900 dark:text-white">Filter by</span>
            <button aria-label="Close filters" onClick={() => setShowFilters(false)} className="p-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-slate-500"><X size={14} /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 custom-scrollbar">
            <FilterGroupSection group={{ id: 'status', label: 'Status', items: ['active', 'inactive'].map(id => ({ id, label: id === 'active' ? 'Active' : 'Inactive', isChecked: statusFilter.includes(id) })) }} onToggle={(_, id) => setStatusFilter(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])} />
            <FilterGroupSection group={{ id: 'department', label: 'Department', items: departments.map(id => ({ id, label: id, isChecked: departmentFilter.includes(id) })) }} onToggle={(_, id) => setDepartmentFilter(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])} />
            <FilterGroupSection group={{ id: 'role', label: 'Role', items: roleNames.map(id => ({ id, label: id, isChecked: roleFilter.includes(id) })) }} onToggle={(_, id) => setRoleFilter(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])} />
          </div>
          <div className="shrink-0 border-t border-[#E4E9F0] dark:border-slate-700 px-4 py-2.5 text-xs text-slate-500">{filtered.length} users in this module</div>
        </motion.aside>}
        <div className="min-w-0 flex-1 space-y-4">
          {loading ? <TableLoadingState label="Loading users..." /> : loadError ? <DataErrorState message={loadError} onRetry={() => setReload(value => value + 1)} /> :
            <DataGrid<User> sort={sort} sortingMode="external" onSortChange={next => setSort(next ?? { field: 'createdAt', direction: 'desc' })} columns={tableColumns.columns} data={paginated} getRowId={row => row.id} height="auto" selectable={canArchiveUsers} selectedIds={selected} onSelectionChange={setSelected} enableColumnMenu={false} ariaLabel="Team Management table" emptyMessage="No users found"
              onRowClick={u => openUser(u)} rowActions={u => [
                { id: 'view', label: 'View', onClick: () => openUser(u) },
                ...((canManageUsers || canAssignRoles || canActivateUsers || canArchiveUsers) ? [
                  { id: 'edit', label: canManageUsers ? 'Edit' : 'Change access', disabled: !canManageUsers && !canAssignRoles && !canActivateUsers, onClick: () => openUser(u, true) },
                  { id: 'status', label: u.status === 'active' ? 'Deactivate' : 'Activate', disabled: !canActivateUsers, onClick: () => void beginStatusChange(u) },
                  { id: 'archive', label: 'Archive', disabled: !!u.isArchived || !canArchiveUsers, onClick: () => setConfirmArchive(u) },
                ] : []),
              ]} />}
          <BulkSelectionBar selectedCount={selected.size} selectedIds={selected} onClearSelection={() => setSelected(new Set())} onRemoveIds={ids => setSelected(previous => new Set([...previous].filter(id => !ids.includes(id))))}
            actions={canArchiveUsers ? [{ id: 'archive', label: 'Archive', entityName: 'user', destructive: true, onExecute: async ids => { const result = await executeSelectedRows(ids, usersService.archive); setReload(value => value + 1); return result; } }] : []} />

          {/* Pagination */}
          {!loading && !loadError && (
            <LeadsPagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalRecords={totalItems}
              onPageChange={goToPage}
              onPageSizeChange={setPageSize}
            />
          )}

        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddOpen && (
          <UserPanel roles={roleObjs} canEdit={canCreateUsers} onSaved={handleSavedUser} onClose={() => setIsAddOpen(false)} />
        )}
        {editingUser && (
          <UserPanel key={`${editingUser.id}:${initiallyEditing}`} initiallyEditing={initiallyEditing} user={editingUser} roles={roleObjs} canEdit={canManageUsers} onSaved={handleSavedUser} onClose={() => setEditingUser(null)} />
        )}
        {confirmArchive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmArchive(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.07]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Archive User</h3>
                <button onClick={() => setConfirmArchive(null)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"><X size={16} /></button>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Archive <span className="font-semibold text-slate-900 dark:text-white">{confirmArchive.firstName} {confirmArchive.lastName}</span>? They will lose access until restored.
                </p>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.07]">
                <button onClick={() => setConfirmArchive(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">Cancel</button>
                <button disabled={archiving} onClick={handleArchive} className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg cursor-pointer">Archive</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmActionDialog
        open={!!reassignUser && !statusChangeUser}
        onOpenChange={open => { if (!open) { setReassignUser(null); setImpact(null); setReplacement(''); } }}
        title="Reassign CRM Records"
        description={impact?.total ? `${reassignUser?.firstName} ${reassignUser?.lastName} currently owns CRM records that must be reassigned before the account can be deactivated.` : 'No active CRM records are assigned to this user.'}
        confirmLabel="Continue"
        confirmDisabled={!!impact?.total && !replacement}
        onConfirm={() => setStatusChangeUser(reassignUser)}
      >
        <dl className="grid grid-cols-2 gap-2 text-sm">{Object.entries(impact?.counts ?? {}).map(([label, count]) => <React.Fragment key={label}><dt className="capitalize">{label}</dt><dd className="text-right">{count}</dd></React.Fragment>)}</dl>
        {!!impact?.total && <div className="space-y-2"><label htmlFor="deactivation-agent" className="text-sm font-medium">Assigned Agent <span className="text-red-500">*</span></label>
          <AssignedAgentSelect id="deactivation-agent" value={replacement} onChange={setReplacement} users={allUsers.filter(user => user.id !== reassignUser?.id)} placeholder="Select agent" className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 pr-8 text-sm" />
        </div>}
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={!!statusChangeUser}
        onOpenChange={(open) => { if (!open && !changingStatus) { setStatusChangeUser(null); setReassignUser(null); setReplacement(''); setImpact(null); } }}
        title={statusChangeUser?.status === 'active' ? 'Deactivate this user?' : 'Activate this user?'}
        description={statusChangeUser?.status === 'active'
          ? `Deactivate ${statusChangeUser.firstName} ${statusChangeUser.lastName}? ${impact?.total ? `${impact.counts.leads} Leads, ${impact.counts.contacts} Contacts, ${impact.counts.accounts} Accounts, and ${impact.counts.deals} Deals will be reassigned to ${allUsers.find(user => user.id === replacement)?.firstName ?? ''} ${allUsers.find(user => user.id === replacement)?.lastName ?? ''}. ` : ''}They will lose access to this workspace.`
          : `Activate ${statusChangeUser?.firstName ?? ''} ${statusChangeUser?.lastName ?? ''}? They will regain access to this workspace.`}
        confirmLabel={statusChangeUser?.status === 'active' ? 'Deactivate' : 'Activate'}
        variant={statusChangeUser?.status === 'active' ? 'destructive' : 'default'}
        isLoading={changingStatus}
        onConfirm={handleStatusChange}
      />
    </div>
  );
}
