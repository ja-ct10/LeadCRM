'use client';
import { SelectedRowsBar } from '@/shared/components/crm/selected-rows-bar';


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ARCHIVE_TYPES, type ArchivedRecord, type ArchiveType } from '@leadcrm/shared';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { DataGrid, type DataGridColumnDef, type SortState } from '@/shared/components/data-grid';
import { TableLoadingState } from '@/shared/components/crm/table-loading-state';
import { LeadsPagination } from '@/shared/components/crm/leads-pagination';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import { TableIconButton } from '@/shared/components/data-grid/table-icon-button';
import { ModuleTableToolbar } from '@/shared/components/crm/module-table-toolbar';
import { ModuleTabs } from '@/shared/components/crm/module-tabs';
import { Button } from '@/shared/components/ui/button';
import { archivedDataService } from '../services/archived-data.service';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';

const EMPTY_RECORDS: ArchivedRecord[] = [];
const rowId = (record: ArchivedRecord) => `${record.type}-${record.id}`;
const restoreClass = 'inline-flex min-h-11 min-w-11 sm:min-h-8 items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary dark:text-primary rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function ArchivedData(): React.ReactElement {
  const { user, tenant, userCan } = useAuth();
  const canRestore = userCan('archived_data', 'canRestore');
  const { refreshDeals, refreshOrganizations } = useData();
  const identity = `${tenant?.id}:${user?.id}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [filter, setFilter] = useState<ArchiveType | 'All'>('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortState>({ field: 'archivedAt', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<ArchivedRecord[] | null>(null);
  const [pending, setPending] = useState<{ records: ArchivedRecord[]; bulk: boolean } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const busy = useRef(false);
  const returnToVisiblePage = useRef(false);
  useEffect(() => { setSelectedIds(new Set()); setHiddenIds(new Set()); setPendingDelete(null); setPending(null); returnToVisiblePage.current = false; }, [identity]);
  const { data, error, isInitialLoad, isRefreshing, refetch } = useCachedPage({
    module: 'archived-crm', params: { filter, page, pageSize, search, sort }, disabled: false,
    intervalMs: 60_000, revalidateOnInvalidation: true,
    fetchFn: signal => archivedDataService.list(filter, page, pageSize, signal, search, sort),
  });
  const sourceRecords = data?.data ?? EMPTY_RECORDS;
  const records = useMemo(() => sourceRecords.filter(record => !hiddenIds.has(rowId(record))), [sourceRecords, hiddenIds]);
  const total = data?.meta.total ?? 0;
  useEffect(() => {
    const available = new Set(records.map(rowId));
    setSelectedIds(previous => {
      const next = new Set([...previous].filter(id => available.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [records, error]);
  useEffect(() => {
    if (data && page > Math.max(1, Math.ceil(total / pageSize))) setPage(Math.max(1, Math.ceil(total / pageSize)));
  }, [data, page, total, pageSize]);
  useEffect(() => {
    if (!returnToVisiblePage.current || isInitialLoad || isRefreshing) return;
    if (!error && sourceRecords.length > 0 && records.length === 0 && page > 1) {
      setSelectedIds(new Set());
      setPage(page - 1);
    } else returnToVisiblePage.current = false;
  }, [sourceRecords, records, page, isInitialLoad, isRefreshing, error]);
  const changePage = (next: number) => { returnToVisiblePage.current = false; setSelectedIds(new Set()); setPage(next); };
  const selected = records.filter(record => selectedIds.has(rowId(record)));
  const deleteDisabled = !selected.length || isInitialLoad || isRefreshing || restoring;
  const openDeleteConfirmation = () => setPendingDelete(selected);
  const confirmRestore = async () => {
    if (!pending || busy.current || !canRestore) return;
    busy.current = true;
    setRestoring(true);
    const succeeded = new Set<string>();
    const failures: string[] = [];
    const restoredTypes = new Set<ArchiveType>();
    const restoreIdentity = identity;
    try {
      // At most 50 visible rows; every restore independently validates ID, tenant and RBAC.
      for (const [index, record] of pending.records.entries()) {
        if (identityRef.current !== restoreIdentity) {
          failures.push(...Array<string>(pending.records.length - index).fill('Workspace changed. Reload archived records before continuing.'));
          break;
        }
        try { await archivedDataService.restore(record); succeeded.add(rowId(record)); restoredTypes.add(record.type); }
        catch (error) { failures.push(error instanceof Error ? error.message : 'Failed to restore record'); }
      }
      setSelectedIds(previous => new Set([...previous].filter(id => !succeeded.has(id))));
      if (succeeded.size) toast.success(pending.bulk ? `${succeeded.size} record${succeeded.size === 1 ? '' : 's'} restored` : `${pending.records[0].type} restored`);
      if (failures.length) toast.error(pending.bulk ? `${failures.length} record${failures.length === 1 ? '' : 's'} could not be restored. ${failures[0]}` : failures[0]);
      setPending(failures.length ? { ...pending, records: pending.records.filter(record => !succeeded.has(rowId(record))) } : null);
      if (restoredTypes.has('Product') && identityRef.current === restoreIdentity) {
        window.dispatchEvent(new CustomEvent('product-interests-changed'));
      }
      await refetch();
      if (identityRef.current === restoreIdentity) {
        const refreshes: Promise<void>[] = [];
        if (restoredTypes.has('Deal')) refreshes.push(refreshDeals());
        if (restoredTypes.has('Account')) refreshes.push(refreshOrganizations());
        const results = await Promise.allSettled(refreshes);
        if (results.some(result => result.status === 'rejected')) toast.error('Records restored, but a source module could not refresh. Reload it to see the changes.');
      }
      if (failures.length) throw new Error(failures[0]);
    } finally { busy.current = false; setRestoring(false); }
  };

  const columns: DataGridColumnDef<ArchivedRecord>[] = [
    { id: 'type', header: 'Type', accessor: row => row.type, width: 110 },
    { id: 'name', header: 'Name', accessor: row => row.name, width: 230, sortable: true },
    { id: 'detail', header: 'Details', accessor: row => row.detail || '—', width: 260 },
    ...(sourceRecords.some(row => row.archivedAt) ? [{
      id: 'archivedAt', header: 'Archived On', accessor: (row: ArchivedRecord) => row.archivedAt ? new Date(row.archivedAt).toLocaleString() : '—', width: 190, sortable: true,
    }] : []),
    { id: 'actions', header: 'Actions', accessor: () => '', width: 120,
      cell: (_value, record) => (
        <TableIconButton touchFriendly label="Restore" ariaLabel="Restore"
          disabled={!canRestore || restoring || !record.canRestore} onClick={() => setPending({ records: [record], bulk: false })}>
          <ArchiveRestore size={14} aria-hidden="true" />
        </TableIconButton>
      ),
    },
  ];
  return (
    <>
      <div className="min-w-0 w-full space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Archived Data Recovery</h3>
          <p className="text-xs text-slate-400 mt-0.5">Restore records previously archived instead of deleted.</p>
        </div>
        <ModuleTabs tabs={(['All', ...ARCHIVE_TYPES] as const).map(type => ({ id: type, label: type }))}
          activeTab={filter} disabled={restoring} ariaLabel="Archived record types"
          onTabChange={type => { setFilter(type); changePage(1); }} />
        <ModuleTableToolbar label="Archived records" search={search} onSearch={value => { setSearch(value); changePage(1); }} placeholder="Search archived records..."
          stackSearchOnMobile disabled={restoring} refreshing={isInitialLoad || isRefreshing} onRefresh={refetch}
          beforeRefresh={<TableIconButton touchFriendly label="Remove from list" ariaLabel="Remove selected archived records from view"
            className="rounded-lg disabled:opacity-50" disabled={deleteDisabled}
            onClick={openDeleteConfirmation}>
            <Trash2 size={15} className="text-destructive" aria-hidden="true" />
          </TableIconButton>} />
        {error && <div role="alert" className="text-sm text-red-600">{error} <button type="button" className="underline" onClick={() => void refetch()}>Retry</button></div>}
        {isInitialLoad ? <TableLoadingState label="Loading archived records..." /> : (
          <DataGrid<ArchivedRecord> isRefreshing={isRefreshing} columns={columns} data={records} getRowId={rowId} sort={sort} sortingMode="external" onSortChange={next => { setSort(next ?? { field: 'archivedAt', direction: 'desc' }); setPage(1); }}
            height="auto" selectable selectedIds={selectedIds}
            onSelectionChange={ids => {
              if (!restoring) setSelectedIds(ids);
            }}
            enableColumnMenu={false} emptyMessage={error ? 'Unable to load archived records.' : 'No archived records found.'}
            ariaLabel="Archived data grid" />
        )}
        {!isInitialLoad && (!error || records.length > 0) && <div inert={restoring}>
          <LeadsPagination currentPage={page} totalRecords={total} pageSize={pageSize}
            onPageChange={changePage} onPageSizeChange={size => { setPageSize(size); changePage(1); }}
            refreshing={isRefreshing} disabled={restoring || isRefreshing} />
        </div>}
        <SelectedRowsBar count={selected.length} onClear={() => setSelectedIds(new Set())} disabled={restoring}>
          <button type="button" className={restoreClass} disabled={restoring || selected.some(record => !record.canRestore)} onClick={() => setPending({ records: selected, bulk: true })}>Restore</button>
          <Button type="button" variant="destructive" size="sm" className="rounded-lg" disabled={deleteDisabled} onClick={openDeleteConfirmation}>Delete</Button>
        </SelectedRowsBar>
        <ConfirmActionDialog open={pending !== null} onOpenChange={open => { if (!open && !restoring) setPending(null); }}
          title={pending?.bulk ? 'Restore selected records?' : 'Restore record?'}
          description={pending?.bulk ? `This will restore ${pending.records.length} archived records to their original modules.` : 'This record will be restored to its original module.'}
          variant="success" confirmLabel="Restore" cancelLabel="Cancel" isLoading={restoring} onConfirm={confirmRestore} />
        <ConfirmActionDialog open={pendingDelete !== null} onOpenChange={open => { if (!open) setPendingDelete(null); }}
          title={pendingDelete?.length === 1 ? 'Delete archived record?' : 'Delete archived records?'}
          description={pendingDelete?.length === 1 ? 'Are you sure you want to delete this archived record?' : 'Are you sure you want to delete the selected archived records?'}
          variant="destructive" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => {
            if (!pendingDelete) return;
            returnToVisiblePage.current = true;
            setHiddenIds(previous => new Set([...previous, ...pendingDelete.map(rowId)]));
            setSelectedIds(new Set());
          }} />
      </div>
    </>
  );
}

