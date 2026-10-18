'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductInterest } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/store/AuthContext';

export const PRODUCT_INTEREST_ENDPOINT = '/administration/product-interests';
export type ProductInterestResponse = { data: ProductInterest[]; meta: { enabled: boolean; categories?: string[] } };
export function useProductInterests() {
  const { user, isLoading: authLoading, authError } = useAuth();
  const [products, setProducts] = useState<ProductInterest[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const pendingPromise = useRef<Promise<void> | null>(null);
  const refresh = useCallback((): Promise<void> => {
    if (authLoading || authError || !user?.tenantId) {
      setProducts([]); setCategories([]); setLoading(false);
      return Promise.resolve();
    }
    if (pending.current && !pending.current.signal.aborted && pendingPromise.current) return pendingPromise.current;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError('');
    const promise = apiClient.get<ProductInterestResponse>(PRODUCT_INTEREST_ENDPOINT, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setProducts(result.data); setCategories(result.meta?.categories ?? [...new Set(result.data.map(row => row.category).filter((category): category is string => !!category))]); setEnabled(result.meta?.enabled !== false); } })
      .catch(e => { if (!controller.signal.aborted) {
        if ([401, 403, 404].includes(e.status)) setProducts([]); setCategories([]);
        setError(e instanceof Error ? e.message : 'Unable to load products.');
      } })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); setHasLoaded(true); }
        if (pending.current === controller) { pending.current = null; pendingPromise.current = null; }
      });
    pendingPromise.current = promise;
    return promise;
  }, [user?.id, user?.tenantId, authLoading, authError]);
  useEffect(() => {
    setProducts([]); setCategories([]); setHasLoaded(false);
    void refresh();
    return () => { pending.current?.abort(); };
  }, [refresh]);
  useEffect(() => {
    const onChanged = (event: Event) => {
      pending.current?.abort();
      const result = (event as CustomEvent<ProductInterestResponse>).detail;
      if (result) { setProducts(result.data); setCategories(result.meta?.categories ?? [...new Set(result.data.map(row => row.category).filter((category): category is string => !!category))]); setEnabled(result.meta.enabled); setError(''); }
      void refresh();
    };
    window.addEventListener('product-interests-changed', onChanged);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('product-interests-changed', onChanged); window.removeEventListener('focus', onFocus); };
  }, [refresh]);
  return { products, categories, enabled, loading, error, refresh, hasLoaded };
}
