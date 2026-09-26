'use client';

import React, { useState } from 'react';
import { Archive, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/store/DataContext';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { leadsService } from '@/features/tenant/crm/leads/services/leads.service';
import { accountsService } from '@/features/tenant/crm/accounts/services/accounts.service';
import { contactsV2Api } from '@/shared/services/contacts-v2.api';
import type { PaginatedResponse } from '@leadcrm/shared';

interface ArchivedItem {
  type: string;
  id: string;
  name: string;
  detail?: string;
  canRestore?: boolean;
}

// Follow server pagination so archives remain complete beyond the first page.
async function allPages<T>(fetchPage: (page: number) => Promise<PaginatedResponse<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const response = await fetchPage(page);
    rows.push(...response.data);
    if (!response.meta.hasMore || response.data.length === 0) return rows;
  }
}

export function ArchivedData(): React.ReactElement {
  const { deals, pipelines, workflows, campaigns, templates, users, roles, restoreRecord } = useData();
  const [archivedFilter, setArchivedFilter] = useState('All');
  const [restoring, setRestoring] = useState<string | null>(null);
  const canViewContacts = useHasPermission('contacts.view');
  const canViewAccounts = useHasPermission('accounts.view');
  const canRestoreContacts = useHasPermission('contacts.edit');
  const canRestoreAccounts = useHasPermission('accounts.edit');
  const { data: crmRecords = [], error, isInitialLoad, refetch } = useCachedPage<ArchivedItem[]>({
    module: 'archived-crm',
    params: { canViewContacts, canViewAccounts, canRestoreContacts, canRestoreAccounts },
    disabled: false,
    intervalMs: 60_000,
    revalidateOnInvalidation: true,
    fetchFn: async (signal) => {
      const [leads, contacts, accounts] = await Promise.all([
        canViewContacts ? allPages(page => leadsService.getAll({ archived: true, page, limit: 100 }, signal)) : [],
        canViewContacts ? allPages(page => contactsV2Api.list({ archived: true, page, limit: 100 }, signal)) : [],
        canViewAccounts ? allPages(page => accountsService.getAll({ archived: true, page, limit: 100 }, signal)) : [],
      ]);
      return [
        ...leads.map(row => ({ type: 'Lead', id: row.id, name: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(), detail: row.email ?? '', canRestore: canRestoreContacts })),
        ...contacts.map(row => ({ type: 'Contact', id: row.id, name: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(), detail: row.email ?? '', canRestore: canRestoreContacts })),
        ...accounts.map(row => ({ type: 'Account', id: row.id, name: row.name, detail: row.city ?? '', canRestore: canRestoreAccounts })),
      ];
    },
  });

  const restore = async (item: ArchivedItem) => {
    if (restoring) return;
    setRestoring(`${item.type}-${item.id}`);
    try {
      switch (item.type) {
        case 'Lead': await leadsService.restore(item.id); break;
        case 'Contact': await contactsV2Api.restore(item.id); break;
        case 'Account': await accountsService.restore(item.id); break;
        default: await restoreRecord(item.type as Parameters<typeof restoreRecord>[0], item.id);
      }
      await refetch();
      toast.success(`${item.type} restored`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore record');
    } finally { setRestoring(null); }
  };

  const allArchived: ArchivedItem[] = [
    ...crmRecords,
    ...deals.filter((d) => d.isArchived).map((d) => ({ type: "Deal", id: d.id, name: d.title })),
    ...pipelines.filter((p) => p.isArchived).map((p) => ({ type: "Pipeline", id: p.id, name: p.name })),
    ...workflows.filter((w) => w.isArchived).map((w) => ({ type: "Workflow", id: w.id, name: w.name })),
    ...campaigns.filter((c) => c.isArchived).map((c) => ({ type: "Campaign", id: c.id, name: c.name })),
    ...templates.filter((t) => t.isArchived).map((t) => ({ type: "Template", id: t.id, name: t.name })),
    ...roles.filter((r) => r.isArchived).map((r) => ({ type: "Role", id: r.id, name: r.name })),
    ...users.filter((u) => u.isArchived).map((u) => ({ type: "User", id: u.id, name: `${u.firstName} ${u.lastName}` })),
  ];
  const filteredArchived = archivedFilter === "All" ? allArchived : allArchived.filter((x) => x.type === archivedFilter);

  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Archived Data Recovery</h3>
          <p className="text-xs text-slate-400 mt-0.5">Restore records previously archived instead of deleted.</p>
        </div>
      </div>
      <div className="flex w-full items-center gap-1.5 flex-nowrap overflow-x-auto pb-1">
        {["All", "Lead", "Contact", "Account", "Deal", "Pipeline", "User", "Role", "Workflow", "Campaign", "Template"].map((type) => (
          <button key={type} onClick={() => setArchivedFilter(type)}
            className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${archivedFilter === type ? "bg-[#3B82F6] text-white" : "bg-slate-100 dark:bg-[#1B252F] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
            {type}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {isInitialLoad && <div role="status" aria-label="Loading archived records" className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => <div key={index} aria-hidden="true" className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 animate-pulse motion-reduce:animate-none">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-2.5 w-12 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-2/5 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-3/5 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="h-7 w-20 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>)}
        </div>}
        {error && <div role="alert" className="text-sm text-red-600">{error} <button onClick={() => void refetch()}>Retry</button></div>}
        {!isInitialLoad && !error && filteredArchived.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 dark:bg-[#25313D] rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60">
            <Archive className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No archived records found.</p>
          </div>
        ) : (
          filteredArchived.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex items-center justify-between p-3 bg-white dark:bg-[#25313D] border border-gray-200 dark:border-white/[0.06] rounded-xl">
              <div>
                <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-wider">{item.type}</span>
                <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">{item.name}</p>
                {item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
              </div>
              <button disabled={!!restoring || item.canRestore === false} onClick={() => void restore(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/15 dark:bg-[#3B82F6]/10 dark:hover:bg-[#3B82F6]/20 text-[#3B82F6] dark:text-[#60A5FA] rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <RefreshCw size={12} /> Restore
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

