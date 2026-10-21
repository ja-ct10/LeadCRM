'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { subscribePageCacheInvalidation, buildCacheKey, createPageCacheGuard, getPageCache, getPageCacheGeneration, requestPageCache, invalidatePageCache, setPageCache } from '@/shared/cache/page-cache';

interface CachedPageOptions<T> {
  module: string;
  params: Record<string, unknown>;
  fetchFn: (signal: AbortSignal) => Promise<T>;
  intervalMs?: number;
  disabled?: boolean;
  revalidateOnInvalidation?: boolean;
  pauseWhenHidden?: boolean;
}

/** Cache successful results together with their exact request key; always revalidate on mount. */
export function useCachedPage<T>({ module, params, fetchFn, intervalMs, pauseWhenHidden = false, revalidateOnInvalidation = false, disabled = USE_MOCK_DATA }: CachedPageOptions<T>) {
  const { tenant, user, isLoading, authError } = useAuth();
  const tenantId = tenant?.id ?? '';
  // Responses (especially notifications) can depend on the user and their role.
  const scopedParams = { query: params, userId: user?.id, role: user?.role };
  const key = buildCacheKey(module, tenantId, scopedParams);
  const enabled = !disabled && !isLoading && !authError && !!tenantId && !!user?.id;
  const cached = enabled ? getPageCache<T>(module, tenantId, scopedParams) : null;
  const generation = getPageCacheGeneration();
  const evictionVersion = useRef(0);
  const currentEvictionVersion = evictionVersion.current;
  const [state, setState] = useState<{
    key: string; data?: T; fetching: boolean; manual?: boolean; error: string | null; errorStatus?: number;
  }>(() => ({ key, data: cached?.data, fetching: enabled, error: null }));
  const latest = useRef({ key, fetchFn, scopedParams, enabled });
  latest.current = { key, fetchFn, scopedParams, enabled };
  const activeRequest = useRef<AbortController | null>(null);
  const pending = useRef<{ key: string; valid: () => boolean; promise: Promise<void> } | null>(null);
  const mounted = useRef(false);

  const fetchPage = useCallback((silent: boolean): Promise<void> => {
    if (!enabled || !mounted.current || latest.current.key !== key) return Promise.resolve();
    // Manual and background readers await the same current request. Invalidation
    // makes its guard obsolete, so a post-mutation read still supersedes it.
    if (pending.current?.key === key && pending.current.valid() && !activeRequest.current?.signal.aborted) {
      if (!silent) setState(previous => previous.key === key ? { ...previous, manual: true } : previous);
      return pending.current.promise;
    }
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const validCache = createPageCacheGuard(module);
    const request = latest.current;
    const current = () => mounted.current && !controller.signal.aborted && latest.current.key === key && validCache();
    const initial = getPageCache<T>(module, tenantId, request.scopedParams);
    setState((prev) => ({ key, data: prev.key === key ? prev.data : initial?.data, fetching: true,
      manual: !silent || prev.key === key && prev.fetching && prev.manual, error: null }));
    const run = async () => { try {
      const data = await requestPageCache(module, tenantId, request.scopedParams, request.fetchFn, controller.signal);
      if (!current()) return;
      setPageCache(module, tenantId, request.scopedParams, data);
      setState({ key, data, fetching: false, error: null });
    } catch (error) {
      const status = (error as { status?: number })?.status;
      const unavailable = status === 401 || status === 403 || status === 404;
      // Every shared reader must clear an authoritative denial. The first reader's
      // eviction invalidates guards belonging to the other readers of this request.
      if (!mounted.current || controller.signal.aborted || latest.current.key !== key || (!unavailable && !validCache())) return;
      if (unavailable) { evictionVersion.current++; invalidatePageCache(module, tenantId, false); }
      setState((prev) => ({
        ...prev,
        // Do not keep showing previously authorized data after access is revoked.
        data: unavailable ? undefined : prev.data,
        fetching: false,
        error: error instanceof Error ? error.message : 'Failed to load data',
        errorStatus: status,
      }));
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; pending.current = null; }
      if (mounted.current && !controller.signal.aborted && latest.current.key === key) {
        setState((prev) => prev.key === key ? { ...prev, fetching: false } : prev);
      }
    } };
    const promise = run();
    pending.current = { key, valid: validCache, promise };
    return promise;
  }, [key, enabled, module, tenantId]);
  const refetch = useCallback(() => fetchPage(false), [fetchPage]);
  const refetchSilently = useCallback(() => fetchPage(true), [fetchPage]);

  useEffect(() => {
    mounted.current = true;
    void refetchSilently();
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
    };
  }, [refetchSilently]);

  useEffect(() => {
    if (!enabled || !intervalMs) return;
    const refresh = () => {
      if ((pauseWhenHidden && document.hidden) || (activeRequest.current && !activeRequest.current.signal.aborted)) return;
      void refetchSilently();
    };
    const interval = setInterval(refresh, intervalMs);
    window.addEventListener('focus', refresh);
    if (pauseWhenHidden) document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      if (pauseWhenHidden) document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, intervalMs, pauseWhenHidden, refetchSilently]);

  useEffect(() => {
    if (!enabled) return;
    let queued: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribePageCacheInvalidation((changedModule, changedTenant, evict) => {
      if (changedModule === '*' || evict && changedModule === module && (!changedTenant || changedTenant === tenantId)) {
        evictionVersion.current++;
        setState({ key, data: undefined, fetching: true, error: null });
        clearTimeout(queued); void refetchSilently(); return;
      }
      if (changedModule === '*' || revalidateOnInvalidation && changedModule === module && (!changedTenant || changedTenant === tenantId)) {
        clearTimeout(queued); queued = setTimeout(() => void refetchSilently(), 0);
      }
    });
    return () => { unsubscribe(); clearTimeout(queued); };
  }, [enabled, revalidateOnInvalidation, module, tenantId, key, refetchSilently]);

  const data = enabled ? (state.key === key ? state.data : cached?.data) : undefined;
  const fetching = enabled && (state.key === key ? state.fetching : true);
  return {
    data,
    isInitialLoad: fetching && data === undefined,
    isRefreshing: fetching && data !== undefined,
    isManualRefreshing: fetching && state.key === key && !!state.manual,
    error: enabled && state.key === key ? state.error : null,
    errorStatus: enabled && state.key === key ? state.errorStatus : undefined,
    refetch,
    refetchSilently,
    setData: (data: T) => {
      // Mutation responses can outlive their record, session or access scope.
      // Ordinary content invalidations still allow the server's canonical result.
      if (!enabled || !latest.current.enabled || !mounted.current || latest.current.key !== key
        || generation !== getPageCacheGeneration() || currentEvictionVersion !== evictionVersion.current) return;
      setPageCache(module, tenantId, latest.current.scopedParams, data);
      setState({ key, data, fetching: false, error: null });
    },
  };
}
