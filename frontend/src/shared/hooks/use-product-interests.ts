'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ProductInterest } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/store/AuthContext';

export const PRODUCT_INTEREST_ENDPOINT = '/administration/product-interests';
export type ProductInterestResponse = { data: ProductInterest[]; meta: { enabled: boolean } };
export function useProductInterests() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductInterest[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    apiClient.get<ProductInterestResponse>(PRODUCT_INTEREST_ENDPOINT, { signal: controller.signal })
      .then(result => { setProducts(result.data); setEnabled(result.meta?.enabled !== false); })
      .catch(e => { if (!controller.signal.aborted) { setProducts([]); setError(e.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.tenantId, revision]);
  useEffect(() => {
    window.addEventListener('product-interests-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('product-interests-changed', refresh); window.removeEventListener('focus', refresh); };
  }, [refresh]);
  return { products, enabled, loading, error, refresh };
}
