/**
 * useColumnResize — Unit tests for column resize hook.
 *
 * Validates:
 * - Requirement 2.1: Column resize clamped between min 80px and max 800px
 * - Requirement 2.6: Blue highlight + col-resize cursor during drag
 * - Requirement 2.7: onResizeEnd fires on pointer-up for persistence
 * - Requirement 15.6: Resize throttled via requestAnimationFrame
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnResize } from '../use-column-resize';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createPointerEvent(type: string, clientX: number): PointerEvent {
  return new PointerEvent(type, { clientX, bubbles: true });
}

describe('useColumnResize', () => {
  let rafCallback: FrameRequestCallback | null = null;
  let originalRaf: typeof requestAnimationFrame;
  let originalCancelRaf: typeof cancelAnimationFrame;

  beforeEach(() => {
    rafCallback = null;
    originalRaf = globalThis.requestAnimationFrame;
    originalCancelRaf = globalThis.cancelAnimationFrame;

    // Mock requestAnimationFrame to capture callback and execute synchronously when flushed
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    }) as unknown as typeof requestAnimationFrame;

    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  function flushRaf(): void {
    if (rafCallback) {
      rafCallback(performance.now());
      rafCallback = null;
    }
  }

  describe('width clamping', () => {
    it('clamps width at minimum 80px when dragged below', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize, minWidth: 80, maxWidth: 800 }),
      );

      act(() => {
        result.current.startResize('col1', 200, 120);
      });

      // Drag far to the left (delta = -200, startWidth 120 → 120-200 = -80 → clamped to 80)
      act(() => {
        document.dispatchEvent(createPointerEvent('pointermove', 0));
        flushRaf();
      });

      expect(onResize).toHaveBeenCalledWith('col1', 80);
    });

    it('clamps width at maximum 800px when dragged above', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize, minWidth: 80, maxWidth: 800 }),
      );

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      // Drag far to the right (delta = 900, startWidth 200 → 200+900 = 1100 → clamped to 800)
      act(() => {
        document.dispatchEvent(createPointerEvent('pointermove', 1000));
        flushRaf();
      });

      expect(onResize).toHaveBeenCalledWith('col1', 800);
    });

    it('allows width between min and max without clamping', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize, minWidth: 80, maxWidth: 800 }),
      );

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      // Drag right 50px (delta = 50, startWidth 200 → 250)
      act(() => {
        document.dispatchEvent(createPointerEvent('pointermove', 150));
        flushRaf();
      });

      expect(onResize).toHaveBeenCalledWith('col1', 250);
    });

    it('uses default min 80px and max 800px when not specified', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize }),
      );

      act(() => {
        result.current.startResize('col1', 100, 100);
      });

      // Drag left 50px (delta = -50, startWidth 100 → 50 → clamped to 80)
      act(() => {
        document.dispatchEvent(createPointerEvent('pointermove', 50));
        flushRaf();
      });

      expect(onResize).toHaveBeenCalledWith('col1', 80);
    });
  });

  describe('rAF throttling', () => {
    it('does not fire onResize until rAF executes', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize }),
      );

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      act(() => {
        document.dispatchEvent(createPointerEvent('pointermove', 150));
      });

      // rAF not flushed yet — onResize should NOT have been called
      expect(onResize).not.toHaveBeenCalled();

      // Now flush rAF
      act(() => {
        flushRaf();
      });

      expect(onResize).toHaveBeenCalledWith('col1', 250);
    });

    it('cancels previous rAF when a new pointermove arrives before frame', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize }),
      );

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      // Two rapid moves before rAF fires
      act(() => {
        document.dispatchEvent(createPointerEvent('pointermove', 120));
        document.dispatchEvent(createPointerEvent('pointermove', 160));
        flushRaf();
      });

      // cancelAnimationFrame should have been called (first rAF cancelled)
      expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
      // Only the latest value should be reported (delta=60, startWidth=200 → 260)
      expect(onResize).toHaveBeenCalledWith('col1', 260);
    });
  });

  describe('onResizeEnd (pointer-up persistence)', () => {
    it('fires onResizeEnd with final width on pointer-up', () => {
      const onResize = vi.fn();
      const onResizeEnd = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize, onResizeEnd }),
      );

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      // Move and flush so lastWidth gets set
      act(() => {
        document.dispatchEvent(createPointerEvent('pointermove', 180));
        flushRaf();
      });

      // pointer-up
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      expect(onResizeEnd).toHaveBeenCalledWith('col1', 280);
    });

    it('fires onResizeEnd with startWidth if no pointer-move occurred', () => {
      const onResize = vi.fn();
      const onResizeEnd = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize, onResizeEnd }),
      );

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      // pointer-up without any move
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      // Should fire with startWidth (200) since lastWidth is initialized to startWidth
      expect(onResizeEnd).toHaveBeenCalledWith('col1', 200);
    });

    it('does not fire onResizeEnd when not provided', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize }),
      );

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      // Should not throw
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      expect(result.current.isResizing).toBe(false);
    });
  });

  describe('resize state management', () => {
    it('sets isResizing=true and resizingColumnId on startResize', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize }),
      );

      expect(result.current.isResizing).toBe(false);
      expect(result.current.resizingColumnId).toBeNull();

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      expect(result.current.isResizing).toBe(true);
      expect(result.current.resizingColumnId).toBe('col1');
    });

    it('resets state on pointer-up', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize }),
      );

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      expect(result.current.isResizing).toBe(false);
      expect(result.current.resizingColumnId).toBeNull();
    });

    it('sets col-resize cursor on body during resize', () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useColumnResize({ onResize }),
      );

      act(() => {
        result.current.startResize('col1', 100, 200);
      });

      expect(document.body.style.cursor).toBe('col-resize');
      expect(document.body.style.userSelect).toBe('none');

      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      });

      expect(document.body.style.cursor).toBe('');
      expect(document.body.style.userSelect).toBe('');
    });
  });
});
