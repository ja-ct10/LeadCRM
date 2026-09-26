'use client';

/**
 * useAccounts — route-scoped, server-paginated hook for the Accounts page.
 *
 * Integrates with the shared page cache so return navigation shows data
 * instantly without a skeleton, followed by a silent background refresh.
 *
 * Cache key: tenantId + module('accounts') + { page, pageSize, sort, search, filter }
 * Mutations call invalidatePageCache('accounts', tenantId) to evict stale entries.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useModuleData } from '@/shared/hooks/use-module-data';
import { toFrontendOrg } from '@/lib/api/adapters/organization.adapter';
import { invalidatePageCache } from '@/shared/cache/page-cache';
import { accountsService } from '../services/accounts.service';
import { USE_MOCK_DATA } from '@/lib/config';
import { useAuth } from '@/store/AuthContext';
import { uuid } from '@/lib/utils';
import type { Account, AccountFilters } from '../types/account.types';
import type { AccountFormValues } from '../schemas/account.schema';
import type { SortPreference } from '@/shared/services/table-preferences.api';
import type { FilterCondition } from '@leadcrm/shared';

export interface UseAccountsParams {
  page?: number;
  pageSize?: number;
  sort?: SortPreference | null;
  search?: string;
  recordId?: string;
  filter?: FilterCondition[];
}

const EMPTY_FILTERS: AccountFilters = {
  search: '',
  industries: [],
  sizes: [],
};


// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAccounts(params?: UseAccountsParams) {
  const { tenant } = useAuth();

  const { data, meta, isInitialLoad, isRefreshing, error, refetch } = useModuleData({
    moduleId: 'accounts',
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 100,
    sort: params?.sort ?? null,
    search: params?.search,
    recordId: params?.recordId,
    filter: params?.filter,
  });
  const serverAccounts = useMemo(
    () => (data.map(toFrontendOrg) as Account[]).filter((account) => !account.isArchived),
    [data],
  );
  const [mockAccounts, setDisplayAccounts] = useState<Account[]>([]);
  const displayAccounts = USE_MOCK_DATA ? mockAccounts : serverAccounts;

  // ── Mock mode (localStorage) ─────────────────────────────────────────────
  useEffect(() => {
    if (!USE_MOCK_DATA || !tenant) return;
    const raw = localStorage.getItem('leadcrm_accounts');
    const all: Account[] = raw ? JSON.parse(raw) : [];
    setDisplayAccounts(all.filter((c) => c.tenantId === tenant.id && !c.isArchived));
  }, [tenant]);

  const isLoading = isInitialLoad;

  // ── Client-side filter state (drives filter rail UI in accounts-page) ──
  const [filters, setFilters] = useState<AccountFilters>(EMPTY_FILTERS);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);

  // ── Mutations ────────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    if (USE_MOCK_DATA) return; // mock state is set by the useEffect above
    refetch();
  }, [refetch]);

  const handleCreate = useCallback(async (formData: AccountFormValues) => {
    if (!tenant) return;
    try {
      if (USE_MOCK_DATA) {
        const raw = localStorage.getItem('leadcrm_accounts');
        const all: Account[] = raw ? JSON.parse(raw) : [];
        const newAccount: Account = {
          ...formData,
          id: uuid(),
          tenantId: tenant.id,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem('leadcrm_accounts', JSON.stringify([...all, newAccount]));
        setDisplayAccounts((prev) => [...prev, newAccount]);
      } else {
        await accountsService.create({ ...formData, tenantId: tenant.id });
        invalidatePageCache('accounts', tenant.id);
        refetch();
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error('[useAccounts] Failed to create account:', err);
    }
  }, [tenant, refetch]);

  const handleUpdate = useCallback(async (id: string, formData: AccountFormValues) => {
    try {
      if (USE_MOCK_DATA) {
        const raw = localStorage.getItem('leadcrm_accounts');
        const all: Account[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem('leadcrm_accounts', JSON.stringify(
          all.map((c) => c.id === id ? { ...c, ...formData } : c),
        ));
        setDisplayAccounts((prev) => prev.map((c) => c.id === id ? { ...c, ...formData } : c));
      } else {
        await accountsService.update(id, formData as unknown as Record<string, unknown>);
        invalidatePageCache('accounts', tenant?.id ?? '');
        refetch();
      }
      setIsFormOpen(false);
      setEditTarget(null);
    } catch (err) {
      console.error('[useAccounts] Failed to update account:', err);
    }
  }, [tenant, refetch]);

  const handleArchive = useCallback(async (id: string) => {
    await accountsService.archive(id);
    invalidatePageCache('accounts', tenant?.id ?? '');
    refetch();
  }, [tenant, refetch]);

  const handleOpenCreate = useCallback(() => { setEditTarget(null); setIsFormOpen(true); }, []);
  const handleOpenEdit   = useCallback((account: Account) => { setEditTarget(account); setIsFormOpen(true); }, []);
  const handleCloseForm  = useCallback(() => { setIsFormOpen(false); setEditTarget(null); }, []);

  // ── Expose same public API shape as before ────────────────────────────────
  return {
    /** Current page of accounts (server-paginated in real mode, full list in mock). */
    accounts: displayAccounts,
    /** Total record count from server metadata. */
    totalCount: meta?.total ?? displayAccounts.length,
    meta,
    filters,
    setFilters,
    isLoading,
    /** True during background refresh (existing data remains visible). */
    isRefreshing,
    error,
    refetch: loadAccounts,
    isFormOpen,
    editTarget,
    handleCreate,
    handleUpdate,
    handleArchive,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseForm,
  };
}
