'use client';

/**
 * useInvoicesData — route-scoped hook for the Contract Billing page.
 *
 * Integrates with the shared page cache so return navigation shows data
 * instantly without a skeleton, followed by a silent background refresh.
 *
 * Cache key: tenantId + module('invoices') + {} (no pagination — full list)
 * A request version counter prevents a stale background refresh from
 * overwriting a newer fetch result.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { invoicesApi } from '@/shared/services/invoices.api';
import { useRouteData } from '@/shared/hooks/use-route-data';
import { getPageCache, setPageCache } from '@/shared/cache/page-cache';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import type { Invoice } from '@/store/types';

export interface UseInvoicesDataReturn {
  invoices:      Invoice[];
  isInitialLoad: boolean;
  isRefreshing:  boolean;
  error:         string | null;
  refetch:       () => void;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const CACHE_PARAMS: Record<string, unknown> = {};

export function useInvoicesData(): UseInvoicesDataReturn {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  // ── Initialize from cache (synchronous) ────────────────────────────────
  const cachedResult = useMemo<Invoice[] | null>(() => {
    if (USE_MOCK_DATA || !tenantId) return null;
    const cached = getPageCache<Invoice[]>('invoices', tenantId, CACHE_PARAMS);
    return cached?.data ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only read cache on first mount

  const [invoices, setInvoices] = useState<Invoice[]>(cachedResult ?? []);

  // ── Request version counter ───────────────────────────────────────────
  const requestVersionRef = useRef(0);

  const fetchFn = useCallback(async (): Promise<void> => {
    const myVersion = ++requestVersionRef.current;
    const res = await invoicesApi.list({ limit: 100 });
    if (myVersion !== requestVersionRef.current) return;
    const result = (res?.data ?? []) as Invoice[];
    setInvoices(result);
    if (tenantId) {
      setPageCache<Invoice[]>('invoices', tenantId, CACHE_PARAMS, result);
    }
  }, [tenantId]);

  const { isFetching, hasLoadedOnce, error, refetch } = useRouteData({
    fetchFn,
    intervalMs:      REFRESH_INTERVAL_MS,
    disabled:        USE_MOCK_DATA,
    initiallyLoaded: cachedResult !== null,
  });

  return {
    invoices,
    isInitialLoad: isFetching && !hasLoadedOnce,
    isRefreshing:  isFetching && hasLoadedOnce,
    error,
    refetch,
  };
}
