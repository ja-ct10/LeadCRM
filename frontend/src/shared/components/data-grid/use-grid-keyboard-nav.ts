/**
 * useGridKeyboardNav — ARIA grid keyboard navigation for DataGrid.
 *
 * Implements arrow-key cell navigation within the grid:
 * - ArrowUp / ArrowDown move between rows
 * - ArrowLeft / ArrowRight move between cells
 * - Navigation stops at grid boundaries (no wrapping)
 * - Tab moves between interactive elements (browser default)
 *
 * The hook manages a focused cell coordinate [row, col] and handles
 * keydown events on the grid container.
 */

'use client';

import { useCallback, useRef, useState } from 'react';

interface UseGridKeyboardNavOptions {
  /** Total number of data rows (excluding header) */
  rowCount: number;
  /** Total number of columns (including checkbox if selectable) */
  colCount: number;
  /** Whether the grid is enabled for keyboard navigation */
  enabled?: boolean;
}

interface UseGridKeyboardNavReturn {
  /** Ref to attach to the table element for keydown handling */
  gridRef: React.RefObject<HTMLTableElement | null>;
  /** Current focused cell coordinates [rowIndex, colIndex]. Row 0 = header. */
  focusedCell: [number, number] | null;
  /** Handler to attach to the table's onKeyDown */
  handleGridKeyDown: (e: React.KeyboardEvent<HTMLTableElement>) => void;
  /** Handler for when a cell is clicked — updates focus tracking */
  handleCellFocus: (rowIndex: number, colIndex: number) => void;
}

export function useGridKeyboardNav({
  rowCount,
  colCount,
  enabled = true,
}: UseGridKeyboardNavOptions): UseGridKeyboardNavReturn {
  const gridRef = useRef<HTMLTableElement | null>(null);
  const [focusedCell, setFocusedCell] = useState<[number, number] | null>(null);

  const focusCell = useCallback(
    (row: number, col: number) => {
      if (!gridRef.current) return;

      // Find all rows in the table (thead + tbody)
      const allRows = gridRef.current.querySelectorAll('tr');
      if (!allRows[row]) return;

      // Find cells in the target row
      const cells = allRows[row].querySelectorAll('th, td');
      if (!cells[col]) return;

      // Focus the cell or the first focusable element within it
      const cell = cells[col] as HTMLElement;
      const focusable = cell.querySelector<HTMLElement>(
        'button, input, a, [tabindex]:not([tabindex="-1"])',
      );

      if (focusable) {
        focusable.focus();
      } else {
        // Make the cell itself focusable temporarily
        cell.setAttribute('tabindex', '-1');
        cell.focus();
      }

      setFocusedCell([row, col]);
    },
    [],
  );

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableElement>) => {
      if (!enabled) return;

      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!arrowKeys.includes(e.key)) return;

      // Determine current position — if no tracked cell, start from [0, 0]
      const [currentRow, currentCol] = focusedCell ?? [0, 0];

      let nextRow = currentRow;
      let nextCol = currentCol;

      // Total rows including header
      const totalRows = rowCount + 1;

      switch (e.key) {
        case 'ArrowUp':
          nextRow = Math.max(0, currentRow - 1);
          break;
        case 'ArrowDown':
          nextRow = Math.min(totalRows - 1, currentRow + 1);
          break;
        case 'ArrowLeft':
          nextCol = Math.max(0, currentCol - 1);
          break;
        case 'ArrowRight':
          nextCol = Math.min(colCount - 1, currentCol + 1);
          break;
      }

      // Only act if position changed (boundary stop — no wrapping)
      if (nextRow !== currentRow || nextCol !== currentCol) {
        e.preventDefault();
        focusCell(nextRow, nextCol);
      }
    },
    [enabled, focusedCell, rowCount, colCount, focusCell],
  );

  const handleCellFocus = useCallback(
    (rowIndex: number, colIndex: number) => {
      setFocusedCell([rowIndex, colIndex]);
    },
    [],
  );

  return {
    gridRef,
    focusedCell,
    handleGridKeyDown,
    handleCellFocus,
  };
}
