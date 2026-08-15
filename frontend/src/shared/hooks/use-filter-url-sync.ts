'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useFilterUrlSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getParam = useCallback((key: string): string => {
    return searchParams.get(key) || '';
  }, [searchParams]);

  const getArrayParam = useCallback((key: string): string[] => {
    const val = searchParams.get(key);
    return val ? val.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const updateParams = useCallback((newParams: Record<string, string | string[] | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.filter(Boolean).join(','));
      } else {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  return { getParam, getArrayParam, updateParams, searchParams };
}
