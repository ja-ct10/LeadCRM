/**
 * useColumnResize — hook for drag-to-resize column widths.
 *
 * Tracks pointer events on resize handles, computes new widths,
 * and calls the onResize callback with the new width clamped
 * between minWidth and maxWidth.
 *
 * Properly cleans up event listeners to prevent memory leaks.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseColumnResizeOptions {
  /** Callback when a column is resized */
  onResize: (columnId: string, width: number) => void;
  /** Minimum column width in pixels */
  minWidth?: number;
  /** Maximum column width in pixels */
  maxWidth?: number;
}

interface UseColumnResizeReturn {
  /** Whether a resize is currently in progress */
  isResizing: boolean;
  /** The ID of the column currently being resized */
  resizingColumnId: string | null;
  /** Start resize operation — attach to pointerdown on the handle */
  startResize: (columnId: string, startX: number, currentWidth: number) => void;
}

export function useColumnResize({
  onResize,
  minWidth = 80,
  maxWidth = 800,
}: UseColumnResizeOptions): UseColumnResizeReturn {
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);

  const stateRef = useRef({
    columnId: '',
    startX: 0,
    startWidth: 0,
  });

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const { columnId, startX, startWidth } = stateRef.current;
      if (!columnId) return;

      const delta = e.clientX - startX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
      onResize(columnId, newWidth);
    },
    [onResize, minWidth, maxWidth],
  );

  const handlePointerUp = useCallback(() => {
    setIsResizing(false);
    setResizingColumnId(null);
    stateRef.current.columnId = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing, handlePointerMove, handlePointerUp]);

  const startResize = useCallback(
    (columnId: string, startX: number, currentWidth: number) => {
      stateRef.current = { columnId, startX, startWidth: currentWidth };
      setIsResizing(true);
      setResizingColumnId(columnId);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [],
  );

  return { isResizing, resizingColumnId, startResize };
}
