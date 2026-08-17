/**
 * Unit tests for useResponsiveColumns hook.
 *
 * Tests the responsive column hiding algorithm that uses ResizeObserver
 * to measure container width and hides columns by priority order.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponsiveColumns } from '../use-responsive-columns';
import type { DataGridColumnDef } from '../types';

// ─── Mock ResizeObserver ─────────────────────────────────────────────────────

type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

let resizeCallback: ResizeCallback | null = null;
let observedElements: Element[] = [];

class MockResizeObserver {
  constructor(callback: ResizeCallback) {
    resizeCallback = callback;
  }
  observe(element: Element): void {
    observedElements.push(element);
  }
  unobserve(): void {}
  disconnect(): void {
    observedElements = [];
    resizeCallback = null;
  }
}

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createColumn<T = Record<string, unknown>>(
  id: string,
  width: number,
  responsivePriority: 'required' | 'high' | 'medium' | 'low',
): DataGridColumnDef<T> {
  return {
    id,
    header: id.charAt(0).toUpperCase() + id.slice(1),
    accessor: (row: T) => (row as Record<string, unknown>)[id],
    width,
    responsivePriority,
    required: responsivePriority === 'required',
  };
}

function triggerResize(width: number): void {
  if (resizeCallback) {
    resizeCallback([
      { contentRect: { width } } as unknown as ResizeObserverEntry,
    ]);
  }
}

function createContainerRef(width = 1200): { current: HTMLDivElement } {
  const el = document.createElement('div');
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return { current: el };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  observedElements = [];
  resizeCallback = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useResponsiveColumns', () => {
  const fixedWidths = { checkbox: 44, actions: 100, scrollbar: 17 };

  describe('when disabled', () => {
    it('returns all columns with hiddenCount 0', () => {
      const columns = [
        createColumn('name', 200, 'required'),
        createColumn('email', 180, 'high'),
        createColumn('phone', 150, 'low'),
      ];

      const containerRef = createContainerRef(400);

      const { result } = renderHook(() =>
        useResponsiveColumns({
          columns,
          containerRef,
          fixedWidths,
          enabled: false,
        }),
      );

      expect(result.current.visibleColumns).toHaveLength(3);
      expect(result.current.hiddenCount).toBe(0);
    });
  });

  describe('when enabled with sufficient width', () => {
    it('shows all columns when container is wide enough', () => {
      const columns = [
        createColumn('name', 200, 'required'),
        createColumn('email', 180, 'high'),
        createColumn('phone', 150, 'medium'),
        createColumn('notes', 120, 'low'),
      ];

      // Available = 1200 - 44 - 100 - 17 - 36 = 1003px
      // Total columns = 200 + 180 + 150 + 120 = 650px — fits
      const containerRef = createContainerRef(1200);

      const { result } = renderHook(() =>
        useResponsiveColumns({
          columns,
          containerRef,
          fixedWidths,
          enabled: true,
        }),
      );

      // After initial measurement
      act(() => {
        triggerResize(1200);
        vi.advanceTimersByTime(200);
      });

      expect(result.current.visibleColumns).toHaveLength(4);
      expect(result.current.hiddenCount).toBe(0);
    });
  });

  describe('when container is narrow', () => {
    it('hides low priority columns first', () => {
      const columns = [
        createColumn('name', 200, 'required'),
        createColumn('email', 180, 'high'),
        createColumn('phone', 150, 'medium'),
        createColumn('notes', 120, 'low'),
      ];

      // Available = 500 - 44 - 100 - 17 - 36 = 303px
      // Required: 200 (fits)
      // Remaining: 303 - 200 = 103px
      // high (180) — doesn't fit
      // medium (150) — doesn't fit
      // low (120) — doesn't fit
      // Result: only required
      const containerRef = createContainerRef(500);

      const { result } = renderHook(() =>
        useResponsiveColumns({
          columns,
          containerRef,
          fixedWidths,
          enabled: true,
        }),
      );

      act(() => {
        triggerResize(500);
        vi.advanceTimersByTime(200);
      });

      expect(result.current.visibleColumns).toHaveLength(1);
      expect(result.current.visibleColumns[0].id).toBe('name');
      expect(result.current.hiddenCount).toBe(3);
    });

    it('hides columns in priority order: low first, then medium, then high', () => {
      const columns = [
        createColumn('name', 150, 'required'),
        createColumn('email', 150, 'high'),
        createColumn('phone', 150, 'medium'),
        createColumn('notes', 150, 'low'),
      ];

      // Available = 700 - 44 - 100 - 17 - 36 = 503px
      // Required: 150 (fits)
      // Remaining: 503 - 150 = 353px
      // high (150) — fits, remaining 203
      // medium (150) — fits, remaining 53
      // low (150) — doesn't fit
      const containerRef = createContainerRef(700);

      const { result } = renderHook(() =>
        useResponsiveColumns({
          columns,
          containerRef,
          fixedWidths,
          enabled: true,
        }),
      );

      act(() => {
        triggerResize(700);
        vi.advanceTimersByTime(200);
      });

      expect(result.current.visibleColumns).toHaveLength(3);
      expect(result.current.visibleColumns.map((c) => c.id)).toEqual([
        'name',
        'email',
        'phone',
      ]);
      expect(result.current.hiddenCount).toBe(1);
    });
  });

  describe('required columns always visible', () => {
    it('never hides required columns regardless of width', () => {
      const columns = [
        createColumn('name', 200, 'required'),
        createColumn('status', 150, 'required'),
        createColumn('email', 180, 'low'),
      ];

      // Available = 300 - 44 - 100 - 17 - 36 = 103px
      // Required columns total 350px (exceeds available)
      // Should still show both required columns + enable scroll
      const containerRef = createContainerRef(300);

      const { result } = renderHook(() =>
        useResponsiveColumns({
          columns,
          containerRef,
          fixedWidths,
          enabled: true,
        }),
      );

      act(() => {
        triggerResize(300);
        vi.advanceTimersByTime(200);
      });

      // Required columns always shown
      expect(result.current.visibleColumns.map((c) => c.id)).toContain('name');
      expect(result.current.visibleColumns.map((c) => c.id)).toContain('status');
      // Optional column hidden
      expect(result.current.visibleColumns.map((c) => c.id)).not.toContain('email');
      expect(result.current.hiddenCount).toBe(1);
    });
  });

  describe('horizontal scroll when required exceed width', () => {
    it('enables horizontal scroll (shows only required) when required columns exceed available width', () => {
      const columns = [
        createColumn('name', 300, 'required'),
        createColumn('status', 300, 'required'),
        createColumn('email', 180, 'high'),
      ];

      // Available = 400 - 44 - 100 - 17 - 36 = 203px
      // Required total: 600px (exceeds 203px)
      // Should show required only, all optional hidden
      const containerRef = createContainerRef(400);

      const { result } = renderHook(() =>
        useResponsiveColumns({
          columns,
          containerRef,
          fixedWidths,
          enabled: true,
        }),
      );

      act(() => {
        triggerResize(400);
        vi.advanceTimersByTime(200);
      });

      expect(result.current.visibleColumns).toHaveLength(2);
      expect(result.current.visibleColumns.map((c) => c.id)).toEqual(['name', 'status']);
      expect(result.current.hiddenCount).toBe(1);
    });
  });

  describe('preserves original column order', () => {
    it('returns visible columns in the same order as the input', () => {
      const columns = [
        createColumn('name', 150, 'required'),
        createColumn('phone', 150, 'medium'),
        createColumn('email', 150, 'high'),
        createColumn('notes', 150, 'low'),
      ];

      // Available = 800 - 44 - 100 - 17 - 36 = 603px
      // Required: 150 (name)
      // Remaining: 453
      // high (email, 150) — fits, remaining 303
      // medium (phone, 150) — fits, remaining 153
      // low (notes, 150) — fits, remaining 3
      const containerRef = createContainerRef(800);

      const { result } = renderHook(() =>
        useResponsiveColumns({
          columns,
          containerRef,
          fixedWidths,
          enabled: true,
        }),
      );

      act(() => {
        triggerResize(800);
        vi.advanceTimersByTime(200);
      });

      // All fit, and order is preserved from original input
      expect(result.current.visibleColumns.map((c) => c.id)).toEqual([
        'name',
        'phone',
        'email',
        'notes',
      ]);
    });
  });

  describe('debounce behavior', () => {
    it('debounces resize events at 200ms', () => {
      const columns = [
        createColumn('name', 200, 'required'),
        createColumn('email', 180, 'high'),
      ];

      const containerRef = createContainerRef(1200);

      const { result } = renderHook(() =>
        useResponsiveColumns({
          columns,
          containerRef,
          fixedWidths,
          enabled: true,
        }),
      );

      // Trigger resize but don't advance timer fully
      act(() => {
        triggerResize(300);
        vi.advanceTimersByTime(100); // only 100ms — shouldn't update yet
      });

      // At this point, state should still reflect initial width (1200)
      // which means all columns visible
      expect(result.current.visibleColumns).toHaveLength(2);

      // Advance remaining time
      act(() => {
        vi.advanceTimersByTime(100); // now 200ms total
      });

      // Now width is 300
      // Available = 300 - 44 - 100 - 17 - 36 = 103px
      // Required: 200 — exceeds available, so show required only
      expect(result.current.visibleColumns).toHaveLength(1);
      expect(result.current.visibleColumns[0].id).toBe('name');
    });
  });

  describe('uses default width (180) for columns without explicit width', () => {
    it('falls back to 180px for columns without width property', () => {
      const columns: DataGridColumnDef[] = [
        {
          id: 'name',
          header: 'Name',
          accessor: (row) => (row as Record<string, unknown>)['name'],
          responsivePriority: 'required',
          required: true,
          // no width specified → should use 180
        },
        {
          id: 'email',
          header: 'Email',
          accessor: (row) => (row as Record<string, unknown>)['email'],
          responsivePriority: 'high',
          // no width specified → should use 180
        },
      ];

      // Available = 500 - 44 - 100 - 17 - 36 = 303px
      // Required: 180 (name, default)
      // Remaining: 303 - 180 = 123px
      // high (email, 180) — doesn't fit
      const containerRef = createContainerRef(500);

      const { result } = renderHook(() =>
        useResponsiveColumns({
          columns,
          containerRef,
          fixedWidths,
          enabled: true,
        }),
      );

      act(() => {
        triggerResize(500);
        vi.advanceTimersByTime(200);
      });

      expect(result.current.visibleColumns).toHaveLength(1);
      expect(result.current.visibleColumns[0].id).toBe('name');
      expect(result.current.hiddenCount).toBe(1);
    });
  });
});
