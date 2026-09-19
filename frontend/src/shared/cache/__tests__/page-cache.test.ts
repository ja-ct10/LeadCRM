import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getPageCache,
  setPageCache,
  invalidatePageCache,
  clearPageCache,
  buildCacheKey,
  getPageCacheSize,
  createPageCacheGuard,
} from '../page-cache';

/**
 * Tests for the shared page-cache module.
 *
 * The cache is a plain TypeScript module (NOT a React hook).
 * It stores server fetch results keyed by tenantId + module + params,
 * survives React mount/unmount cycles, and is cleared on logout.
 *
 * 12 focused behavioral tests covering every guarantee the cache makes.
 */

const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';

beforeEach(() => {
  clearPageCache();
  vi.useFakeTimers();
});

describe('bounded storage and invalidation races', () => {
  it('caps the number of retained search results', () => {
    for (let page = 0; page < 150; page++) setPageCache('leads', TENANT_A, { page }, [page]);
    expect(getPageCacheSize()).toBe(100);
    expect(getPageCache('leads', TENANT_A, { page: 0 })).toBeNull();
    expect(getPageCache('leads', TENANT_A, { page: 149 })?.data).toEqual([149]);
  });

  it('prunes expired entries without requiring each old query to be read', () => {
    setPageCache('leads', TENANT_A, { search: 'old' }, ['old']);
    vi.advanceTimersByTime(5 * 60_000);
    setPageCache('accounts', TENANT_A, {}, ['new']);
    expect(getPageCacheSize()).toBe(1);
  });

  it('blocks pending responses after clear or invalidation', () => {
    const oldSession = createPageCacheGuard('leads');
    clearPageCache();
    expect(oldSession()).toBe(false);
    const oldList = createPageCacheGuard('leads');
    const unrelated = createPageCacheGuard('accounts');
    invalidatePageCache('leads', TENANT_A);
    expect(oldList()).toBe(false);
    expect(unrelated()).toBe(true);
  });

  it('does not collapse empty and null nested filter values', () => {
    expect(buildCacheKey('leads', TENANT_A, { filter: { value: '' } }))
      .not.toBe(buildCacheKey('leads', TENANT_A, { filter: { value: null } }));
  });
});

afterEach(() => {
  clearPageCache();
  vi.useRealTimers();
});

// ─── 1. Basic store and retrieve ────────────────────────────────────────────

describe('1. Basic store and retrieve', () => {
  it('returns the stored data with isStale=false immediately after write', () => {
    setPageCache('leads', TENANT_A, { page: 1, pageSize: 25 }, ['lead-1', 'lead-2']);
    const result = getPageCache<string[]>('leads', TENANT_A, { page: 1, pageSize: 25 });

    expect(result).not.toBeNull();
    expect(result!.data).toEqual(['lead-1', 'lead-2']);
    expect(result!.isStale).toBe(false);
  });

  it('returns null before any data is set', () => {
    expect(getPageCache('leads', TENANT_A, { page: 1 })).toBeNull();
  });
});

// ─── 3. TTL eviction ─────────────────────────────────────────────────────────

describe('3. TTL eviction', () => {
  it('returns null after ttlMs elapses (5 minutes for leads)', () => {
    setPageCache('leads', TENANT_A, { page: 1 }, ['lead-1']);

    // Advance past 5 minutes
    vi.advanceTimersByTime(5 * 60_000 + 1);

    expect(getPageCache('leads', TENANT_A, { page: 1 })).toBeNull();
  });

  it('still returns data just before TTL expires', () => {
    setPageCache('leads', TENANT_A, { page: 1 }, ['lead-1']);

    // Just under 5 minutes
    vi.advanceTimersByTime(5 * 60_000 - 1);

    const result = getPageCache<string[]>('leads', TENANT_A, { page: 1 });
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(['lead-1']);
  });
});

// ─── 4. Tenant isolation ─────────────────────────────────────────────────────

describe('4. Tenant isolation', () => {
  it('entry written for tenant-A is invisible to tenant-B', () => {
    setPageCache('leads', TENANT_A, { page: 1 }, ['lead-a']);

    expect(getPageCache('leads', TENANT_B, { page: 1 })).toBeNull();
  });

  it('tenant-A and tenant-B store independent values under the same params', () => {
    setPageCache('leads', TENANT_A, { page: 1 }, ['lead-a']);
    setPageCache('leads', TENANT_B, { page: 1 }, ['lead-b']);

    expect(getPageCache<string[]>('leads', TENANT_A, { page: 1 })!.data).toEqual(['lead-a']);
    expect(getPageCache<string[]>('leads', TENANT_B, { page: 1 })!.data).toEqual(['lead-b']);
  });
});

// ─── 5. Param uniqueness ─────────────────────────────────────────────────────

describe('5. Param uniqueness', () => {
  it('{ page: 1 } and { page: 2 } are different cache entries', () => {
    setPageCache('leads', TENANT_A, { page: 1 }, ['page1']);
    setPageCache('leads', TENANT_A, { page: 2 }, ['page2']);

    expect(getPageCache<string[]>('leads', TENANT_A, { page: 1 })!.data).toEqual(['page1']);
    expect(getPageCache<string[]>('leads', TENANT_A, { page: 2 })!.data).toEqual(['page2']);
  });
});

// ─── 6. Param key order stability ────────────────────────────────────────────

describe('6. Param key order stability', () => {
  it('same params in different key order hit the same cache entry', () => {
    setPageCache('leads', TENANT_A, { page: 1, pageSize: 25 }, ['data-1']);

    // Different key insertion order — must resolve to the same key
    const result = getPageCache<string[]>('leads', TENANT_A, { pageSize: 25, page: 1 });
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(['data-1']);
  });
});

// ─── 7. Nested param stability (recursive serializer) ────────────────────────

describe('7. Nested param stability (recursive serializer)', () => {
  it('nested filter objects with different key order produce the same cache key', () => {
    const params1 = { filter: { field: 'status', operator: 'in' } };
    const params2 = { filter: { operator: 'in', field: 'status' } };

    expect(buildCacheKey('leads', TENANT_A, params1))
      .toBe(buildCacheKey('leads', TENANT_A, params2));
  });

  it('different filter values produce different cache keys', () => {
    const params1 = { filter: { field: 'status', operator: 'in', value: 'Hot' } };
    const params2 = { filter: { field: 'status', operator: 'in', value: 'Cold' } };

    expect(buildCacheKey('leads', TENANT_A, params1))
      .not.toBe(buildCacheKey('leads', TENANT_A, params2));
  });
});

// ─── 8. invalidatePageCache removes one module ───────────────────────────────

describe('8. invalidatePageCache removes targeted module only', () => {
  it('invalidates all leads entries for the given tenant', () => {
    setPageCache('leads', TENANT_A, { page: 1 }, ['p1']);
    setPageCache('leads', TENANT_A, { page: 2 }, ['p2']);

    invalidatePageCache('leads', TENANT_A);

    expect(getPageCache('leads', TENANT_A, { page: 1 })).toBeNull();
    expect(getPageCache('leads', TENANT_A, { page: 2 })).toBeNull();
  });
});

// ─── 9. invalidatePageCache does NOT touch other modules ─────────────────────

describe('9. invalidatePageCache does not remove other modules', () => {
  it('invalidating leads does not evict accounts entries', () => {
    setPageCache('leads',    TENANT_A, { page: 1 }, ['lead-1']);
    setPageCache('accounts', TENANT_A, { page: 1 }, ['acct-1']);

    invalidatePageCache('leads', TENANT_A);

    expect(getPageCache('leads',    TENANT_A, { page: 1 })).toBeNull();
    expect(getPageCache<string[]>('accounts', TENANT_A, { page: 1 })!.data).toEqual(['acct-1']);
  });
});

// ─── 10. invalidatePageCache does NOT touch other tenants ────────────────────

describe('10. invalidatePageCache does not remove other tenants', () => {
  it("invalidating tenant-A leads does not remove tenant-B leads", () => {
    setPageCache('leads', TENANT_A, { page: 1 }, ['a-lead']);
    setPageCache('leads', TENANT_B, { page: 1 }, ['b-lead']);

    invalidatePageCache('leads', TENANT_A);

    expect(getPageCache('leads', TENANT_A, { page: 1 })).toBeNull();
    expect(getPageCache<string[]>('leads', TENANT_B, { page: 1 })!.data).toEqual(['b-lead']);
  });
});

// ─── 11. clearPageCache removes everything ───────────────────────────────────

describe('11. clearPageCache removes everything', () => {
  it('empties all entries across all modules and tenants', () => {
    setPageCache('leads',    TENANT_A, {}, ['a']);
    setPageCache('accounts', TENANT_A, {}, ['b']);
    setPageCache('leads',    TENANT_B, {}, ['c']);

    expect(getPageCacheSize()).toBe(3);

    clearPageCache();

    expect(getPageCacheSize()).toBe(0);
    expect(getPageCache('leads',    TENANT_A, {})).toBeNull();
    expect(getPageCache('accounts', TENANT_A, {})).toBeNull();
    expect(getPageCache('leads',    TENANT_B, {})).toBeNull();
  });
});

// ─── 12. isStale flag ────────────────────────────────────────────────────────

describe('12. isStale flag', () => {
  it('isStale=false immediately after write (before staleMs)', () => {
    // leads staleMs = 60_000 (1 minute)
    setPageCache('leads', TENANT_A, {}, ['data']);
    const result = getPageCache<string[]>('leads', TENANT_A, {});
    expect(result!.isStale).toBe(false);
  });

  it('isStale=true after staleMs elapses but before ttlMs', () => {
    setPageCache('leads', TENANT_A, {}, ['data']);

    // Advance past 1 minute (staleMs) but under 5 minutes (ttlMs)
    vi.advanceTimersByTime(60_000 + 1);

    const result = getPageCache<string[]>('leads', TENANT_A, {});
    expect(result).not.toBeNull(); // data still available
    expect(result!.isStale).toBe(true); // but background refresh should fire
  });
});
