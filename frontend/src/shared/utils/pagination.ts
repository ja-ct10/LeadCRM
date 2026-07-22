/**
 * Pagination utility functions.
 *
 * Pure helpers with no React dependency so they can be reused
 * in hooks, tests, or server-side code.
 */

/**
 * Compute the total number of pages given total items and page size.
 * Always returns at least 1.
 */
export function getTotalPages(totalItems: number, pageSize: number): number {
  if (totalItems <= 0 || pageSize <= 0) return 1;
  return Math.ceil(totalItems / pageSize);
}

/**
 * Clamp a page number between 1 and totalPages (inclusive).
 */
export function clampPage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages));
}

/**
 * Build the human-readable range string.
 * Returns "No results" when totalItems is 0.
 */
export function getDisplayRange(
  currentPage: number,
  pageSize: number,
  totalItems: number,
): string {
  if (totalItems === 0) return 'No results';
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  return `Showing ${start}–${end} of ${totalItems}`;
}

/**
 * Generate the array of page numbers to render in the pagination bar.
 * Uses a "windowed" approach with ellipsis:
 *   [1] [2] [3] … [8] [9] [10]
 *
 * Returns numbers for page buttons and `null` for ellipsis placeholders.
 *
 * @param currentPage  Active page (1-indexed).
 * @param totalPages   Total number of pages.
 * @param siblings     How many pages to show on each side of currentPage.
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  siblings: number = 1,
): (number | null)[] {
  // Fewer pages than the window — show all
  const totalSlots = siblings * 2 + 5; // first + last + 2 ellipsis + 2*siblings + current
  if (totalPages <= totalSlots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(currentPage - siblings, 1);
  const rightSibling = Math.min(currentPage + siblings, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    // Near the start
    const leftCount = 3 + 2 * siblings;
    const leftRange = Array.from({ length: leftCount }, (_, i) => i + 1);
    return [...leftRange, null, totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    // Near the end
    const rightCount = 3 + 2 * siblings;
    const rightRange = Array.from(
      { length: rightCount },
      (_, i) => totalPages - rightCount + 1 + i,
    );
    return [1, null, ...rightRange];
  }

  // Middle — both ellipses
  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i,
  );
  return [1, null, ...middleRange, null, totalPages];
}
