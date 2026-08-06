'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { PaginationOptions, PaginationState } from '@/shared/types/pagination';
import {
  getTotalPages,
  clampPage,
  getDisplayRange,
} from '@/shared/utils/pagination';

/**
 * usePagination
 *
 * Encapsulates all pagination state and logic.
 * Works for both client-side slicing and server-side fetching.
 *
 * @example
 * ```ts
 * const pagination = usePagination({
 *   totalItems: filteredContacts.length,
 *   initialPageSize: 25,
 *   resetDeps: [searchTerm, statusFilter],
 * });
 *
 * const pageData = pagination.paginateItems(filteredContacts);
 * ```
 */
export function usePagination(options: PaginationOptions): PaginationState {
  const {
    totalItems,
    initialPage = 1,
    initialPageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
    resetDeps = [],
    onPageChange,
    onPageSizeChange,
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeInternal] = useState(initialPageSize);

  // ── Derived values ──────────────────────────────────────────────────────
  const totalPages = useMemo(
    () => getTotalPages(totalItems, pageSize),
    [totalItems, pageSize],
  );

  // Clamp page when totalPages shrinks (e.g. after filter narrows results)
  useEffect(() => {
    setCurrentPage((prev) => clampPage(prev, totalPages));
  }, [totalPages]);

  // ── Auto-reset to page 1 when dependencies change ─────────────────────
  const resetRef = useRef(resetDeps);
  useEffect(() => {
    // Skip the initial mount
    const changed = resetDeps.some(
      (dep, i) => dep !== resetRef.current[i],
    );
    if (changed) {
      setCurrentPage(1);
    }
    resetRef.current = resetDeps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  // ── Computed indices ────────────────────────────────────────────────────
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const displayRange = useMemo(
    () => getDisplayRange(currentPage, pageSize, totalItems),
    [currentPage, pageSize, totalItems],
  );

  // ── Navigation helpers ────────────────────────────────────────────────
  const goToPage = useCallback(
    (page: number) => {
      const clamped = clampPage(page, totalPages);
      setCurrentPage(clamped);
      onPageChange?.(clamped);
    },
    [totalPages, onPageChange],
  );

  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const previousPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const firstPage = useCallback(() => goToPage(1), [goToPage]);
  const lastPage = useCallback(() => goToPage(totalPages), [totalPages, goToPage]);

  const setPageSize = useCallback(
    (size: number) => {
      if (!pageSizeOptions.includes(size)) return;
      setPageSizeInternal(size);
      setCurrentPage(1);
      onPageSizeChange?.(size);
    },
    [pageSizeOptions, onPageSizeChange],
  );

  // ── Client-side slice helper ──────────────────────────────────────────
  const paginateItems = useCallback(
    <T,>(items: T[]): T[] => items.slice(startIndex, endIndex),
    [startIndex, endIndex],
  );

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    displayRange,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    setPageSize,
    paginateItems,
  };
}
