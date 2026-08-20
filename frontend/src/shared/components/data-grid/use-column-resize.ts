/**
 * useColumnResize — hook for drag-to-resize column widths.
 *
 * Tracks pointer events on resize handles, computes new widths,
 * and calls the onResize callback with the new width clamped
 * between minWidth and maxWidth.
 *
 * Performance: pointer-move events are throttled via requestAnimationFrame
 * so the resize callback fires at most once per animation frame (~60fps).
 *
 * Persistence: on pointer-up, fires onResizeEnd with the final columnId + width
 * so the consumer can persist the new width without saving on every frame.
 *
 * Properly cleans up event listeners to prevent memory leaks.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseColumnResizeOptions {
  /** Callback when a column is resized (fires per animation frame during drag) */
  onResize: (columnId: string, width: number) => void;
  /** Callback when resize completes (pointer-up) — use for persistence */
  onResizeEnd?: (columnId: string, width: number) => void;
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
  onResizeEnd,
  minWidth = 80,
  maxWidth = 800,
}: UseColumnResizeOptions): UseColumnResizeReturn {
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);

  const stateRef = useRef({
    columnId: '',
    startX: 0,
    startWidth: 0,
    lastWidth: 0,
  });

  // rAF handle ref for throttling pointer-move
  const rafRef = useRef<number | null>(null);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const { columnId, startX, startWidth } = stateRef.current;
      if (!columnId) return;

      const delta = e.clientX - startX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));

      // Throttle via requestAnimationFrame — at most one update per frame
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        stateRef.current.lastWidth = newWidth;
        onResize(columnId, newWidth);
        rafRef.current = null;
      });
    },
    [onResize, minWidth, maxWidth],
  );

  const handlePointerUp = useCallback(() => {
    // Cancel any pending rAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const { columnId, startX, startWidth, lastWidth } = stateRef.current;

    // Compute final clamped width (in case last rAF was cancelled)
    const finalWidth = lastWidth || startWidth;

    // Fire persistence callback with final width
    if (columnId && onResizeEnd) {
      onResizeEnd(columnId, finalWidth);
    }

    setIsResizing(false);
    setResizingColumnId(null);
    stateRef.current.columnId = '';
    stateRef.current.lastWidth = 0;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onResizeEnd]);

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      // Clean up any pending rAF on unmount
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isResizing, handlePointerMove, handlePointerUp]);

  const startResize = useCallback(
    (columnId: string, startX: number, currentWidth: number) => {
      stateRef.current = { columnId, startX, startWidth: currentWidth, lastWidth: currentWidth };
      setIsResizing(true);
      setResizingColumnId(columnId);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [],
  );

  return { isResizing, resizingColumnId, startResize };
}
