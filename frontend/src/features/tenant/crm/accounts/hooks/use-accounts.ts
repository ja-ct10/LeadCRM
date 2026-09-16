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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useModuleData } from '@/shared/hooks/use-module-data';
import { toFrontendOrg } from '@/lib/api/adapters/organization.adapter';
import { getPageCache, setPageCache, invalidatePageCache } from '@/shared/cache/page-cache';
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
  filter?: FilterCondition[];
}

const EMPTY_FILTERS: AccountFilters = {
  search: '',
  industries: [],
  sizes: [],
};

const REFRESH_INTERVAL_MS = 60_000;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAccounts(params?: UseAccountsParams) {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  // All parameters that affect the server response — used as cache key.
  const cacheParams = useMemo<Record<string, unknown>>(() => ({
    page:     params?.page     ?? 1,
    pageSize: params?.pageSize ?? 100,
    sort:     params?.sort     ?? null,
    search:   params?.search   ?? '',
    filter:   params?.filter   ?? null,
  }), [params?.page, params?.pageSize, params?.sort, params?.search, params?.filter]);

  // ── Initialize from cache (synchronous — no flicker on return navigation) ─
  const cachedResult = useMemo<Account[] | null>(() => {
    if (USE_MOCK_DATA || !tenantId) return null;
    const cached = getPageCache<Account[]>('accounts', tenantId, cacheParams);
    return cached?.data ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only read cache on first mount

  // ── Server fetch (real-API mode) ─────────────────────────────────────────
  const { data, meta, isLoading: isFetching, error, refetch } = useModuleData({
    moduleId: 'accounts',
    page:     params?.page     ?? 1,
    pageSize: params?.pageSize ?? 100,
    sort:     params?.sort     ?? null,
    search:   params?.search,
    filter:   params?.filter,
  });

  // ── Stale-while-revalidate ───────────────────────────────────────────────
  const [displayAccounts, setDisplayAccounts] = useState<Account[]>(cachedResult ?? []);
  const [hasLoadedOnce,   setHasLoadedOnce]   = useState(cachedResult !== null);

  useEffect(() => {
    if (!isFetching && error === null && !USE_MOCK_DATA && tenantId) {
      const mapped = data.map((raw) => toFrontendOrg(raw)) as Account[];
      const filtered = mapped.filter((a) => !a.isArchived);
      setDisplayAccounts(filtered);
      setPageCache<Account[]>('accounts', tenantId, cacheParams, filtered);
      setHasLoadedOnce(true);
    }
  }, [data, isFetching, error, tenantId, cacheParams]);

  // ── Mock mode (localStorage) ─────────────────────────────────────────────
  useEffect(() => {
    if (!USE_MOCK_DATA || !tenant) return;
    const raw = localStorage.getItem('leadcrm_accounts');
    const all: Account[] = raw ? JSON.parse(raw) : [];
    setDisplayAccounts(all.filter((c) => c.tenantId === tenant.id && !c.isArchived));
    setHasLoadedOnce(true);
  }, [tenant]);

  const isInitialLoad = isFetching && !hasLoadedOnce && !USE_MOCK_DATA;
  const isLoading = isInitialLoad;

  // ── Background refresh ───────────────────────────────────────────────────
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (USE_MOCK_DATA) return;
    const interval   = setInterval(() => { refetchRef.current(); }, REFRESH_INTERVAL_MS);
    const handleFocus = (): void => { refetchRef.current(); };
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

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

  const handleDelete = useCallback(async (id: string) => {
    try {
      if (USE_MOCK_DATA) {
        const raw = localStorage.getItem('leadcrm_accounts');
        const all: Account[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem('leadcrm_accounts', JSON.stringify(
          all.map((c) => c.id === id ? { ...c, isArchived: true } : c),
        ));
        setDisplayAccounts((prev) => prev.filter((c) => c.id !== id));
      } else {
        await accountsService.archive(id);
        invalidatePageCache('accounts', tenant?.id ?? '');
        refetch();
      }
    } catch (err) {
      console.error('[useAccounts] Failed to delete account:', err);
    }
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
    isRefreshing: isFetching && hasLoadedOnce && !USE_MOCK_DATA,
    error,
    refetch: loadAccounts,
    isFormOpen,
    editTarget,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseForm,
  };
}
