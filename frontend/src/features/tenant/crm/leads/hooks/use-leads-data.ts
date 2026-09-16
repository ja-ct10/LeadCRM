'use client';

/**
 * useLeadsData — route-scoped, server-paginated hook for the Leads page.
 *
 * Wraps the shared useModuleData hook and applies the toFrontendContact adapter.
 * Integrates with the shared page cache so return navigation shows data
 * instantly without a skeleton, followed by a silent background refresh.
 *
 * Cache key: tenantId + module('leads') + { page, pageSize, sort, search, filter }
 * All parameters that affect the server response are included in the key.
 *
 * Race condition: useModuleData already handles this via AbortController —
 * previous requests are cancelled when params change or the component unmounts.
 * The cache write happens inside a useEffect that only runs when isLoading=false,
 * which only occurs after the latest (non-aborted) request resolves.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useModuleData } from '@/shared/hooks/use-module-data';
import { toFrontendContact } from '@/lib/api/adapters/contact.adapter';
import { getPageCache, setPageCache, invalidatePageCache } from '@/shared/cache/page-cache';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import type { Contact } from '@/store/types';
import type { FilterCondition } from '@leadcrm/shared';
import type { SortPreference } from '@/shared/services/table-preferences.api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseLeadsDataParams {
  page:     number;
  pageSize: number;
  sort?:    SortPreference | null;
  filter?:  FilterCondition[];
  search?:  string;
}

export interface UseLeadsDataMeta {
  page:       number;
  pageSize:   number;
  total:      number;
  totalPages: number;
}

interface LeadsCacheData {
  leads: Contact[];
  meta:  UseLeadsDataMeta;
}

export interface UseLeadsDataReturn {
  leads:         Contact[];
  meta:          UseLeadsDataMeta | null;
  isInitialLoad: boolean;
  isRefreshing:  boolean;
  error:         string | null;
  refetch:       () => void;
  /** Call after any mutation that changes the leads list (create/update/delete). */
  invalidate:    () => void;
}

const REFRESH_INTERVAL_MS = 60_000;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLeadsData(params: UseLeadsDataParams): UseLeadsDataReturn {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  // Build a stable serializable params object — all fields that affect the response.
  // The cache module owns serialization via stableStringify.
  const cacheParams = useMemo<Record<string, unknown>>(() => ({
    page:     params.page,
    pageSize: params.pageSize,
    sort:     params.sort ?? null,
    search:   params.search ?? '',
    filter:   params.filter ?? null,
  }), [params.page, params.pageSize, params.sort, params.search, params.filter]);

  // ── Initialize from cache (synchronous — no flicker) ─────────────────────
  // useMemo runs during render, so state is initialized from cache on the very
  // first render — no "flash of empty" before the first useEffect fires.
  const cachedResult = useMemo<LeadsCacheData | null>(() => {
    if (USE_MOCK_DATA || !tenantId) return null;
    const cached = getPageCache<LeadsCacheData>('leads', tenantId, cacheParams);
    return cached?.data ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only read cache on first mount

  const { data, meta, isLoading, error, refetch } = useModuleData({
    moduleId: 'leads',
    page:     params.page,
    pageSize: params.pageSize,
    sort:     params.sort ?? null,
    filter:   params.filter,
    search:   params.search,
  });

  // ── Stale-while-revalidate ────────────────────────────────────────────────
  const [displayLeads,  setDisplayLeads]  = useState<Contact[]>(cachedResult?.leads ?? []);
  const [displayMeta,   setDisplayMeta]   = useState<UseLeadsDataMeta | null>(cachedResult?.meta ?? null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(cachedResult !== null);

  // Write to cache on successful fetch.
  // AbortController in useModuleData already prevents stale responses from
  // reaching this effect — only the latest resolved request triggers it.
  useEffect(() => {
    if (!isLoading && error === null && !USE_MOCK_DATA && tenantId) {
      const mapped = data.map((raw) => toFrontendContact(raw)) as Contact[];
      setDisplayLeads(mapped);
      if (meta) {
        setDisplayMeta(meta);
        setPageCache<LeadsCacheData>('leads', tenantId, cacheParams, {
          leads: mapped,
          meta:  meta as UseLeadsDataMeta,
        });
      }
      setHasLoadedOnce(true);
    }
    // On error: keep displayLeads as-is (stale data visible, error handled separately)
  }, [data, meta, isLoading, error, tenantId, cacheParams]);

  const isInitialLoad = isLoading && !hasLoadedOnce;
  const isRefreshing  = isLoading && hasLoadedOnce;

  // ── Background refresh ────────────────────────────────────────────────────
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const interval = setInterval(() => { refetchRef.current(); }, REFRESH_INTERVAL_MS);
    const handleFocus = (): void => { refetchRef.current(); };
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // ── Mutation invalidation ─────────────────────────────────────────────────
  const invalidate = useCallback((): void => {
    if (tenantId) invalidatePageCache('leads', tenantId);
  }, [tenantId]);

  return {
    leads:         displayLeads,
    meta:          displayMeta,
    isInitialLoad,
    isRefreshing,
    error,
    refetch,
    invalidate,
  };
}
