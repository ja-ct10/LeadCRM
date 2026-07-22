/**
 * Shared pagination type definitions for LeadCRM.
 *
 * Every module that displays paginated data must reuse these types
 * to guarantee a consistent contract across the platform.
 */

// ── Options supplied to the usePagination hook ──────────────────────────────

export interface PaginationOptions {
  /** Total number of items in the (filtered) dataset. */
  totalItems: number;

  /** Page to start on (1-indexed, default 1). */
  initialPage?: number;

  /** Default number of rows per page (default 10). */
  initialPageSize?: number;

  /** Allowed page-size choices shown in the dropdown. */
  pageSizeOptions?: number[];

  /**
   * Dependency array — whenever any value changes the hook
   * automatically resets `currentPage` back to 1.
   * Typically pass `[searchTerm, ...filterValues]`.
   */
  resetDeps?: unknown[];

  /** Optional callback fired whenever the page changes. */
  onPageChange?: (page: number) => void;

  /** Optional callback fired whenever the page size changes. */
  onPageSizeChange?: (size: number) => void;
}

// ── Return value of usePagination ───────────────────────────────────────────

export interface PaginationState {
  /** Current 1-indexed page number. */
  currentPage: number;

  /** Number of items displayed per page. */
  pageSize: number;

  /** Total number of pages (≥ 1). */
  totalPages: number;

  /** Total items in the dataset (mirrors the option). */
  totalItems: number;

  /** 0-based start index for the current slice. */
  startIndex: number;

  /** 0-based end index (exclusive) for the current slice. */
  endIndex: number;

  /** Human-readable range string, e.g. "Showing 1–10 of 248". */
  displayRange: string;

  /** Whether a next page is available. */
  hasNextPage: boolean;

  /** Whether a previous page is available. */
  hasPreviousPage: boolean;

  /** Navigate to a specific page (clamped). */
  goToPage: (page: number) => void;

  /** Go forward one page. */
  nextPage: () => void;

  /** Go back one page. */
  previousPage: () => void;

  /** Jump to the first page. */
  firstPage: () => void;

  /** Jump to the last page. */
  lastPage: () => void;

  /** Change page size and auto-reset to page 1. */
  setPageSize: (size: number) => void;

  /**
   * Client-side convenience — returns the correct slice of the
   * supplied array for the current page.
   */
  paginateItems: <T>(items: T[]) => T[];
}

// ── Props accepted by the <Pagination /> component ──────────────────────────

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
  className?: string;
}

// ── Server-side pagination meta (matches backend response shape) ────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
