/**
 * Unit tests for useColumnDragReorder hook.
 *
 * Validates:
 * - Sequential 0-based order reassignment after drag-and-drop (Requirement 4.2)
 * - Locked columns cannot be dragged or dropped onto (Requirement 4.3)
 * - onReorder callback is called with updated column array (Requirement 4.2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnDragReorder } from '../use-column-drag-reorder';
import type { ColumnConfigItem } from '@leadcrm/shared';
import type { DragEndEvent } from '@dnd-kit/core';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createColumns(count: number): ColumnConfigItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `col-${i}`,
    visible: true,
    order: i,
  }));
}

function makeDragEndEvent(activeId: string, overId: string): DragEndEvent {
  return {
    active: { id: activeId, data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
    over: { id: overId, data: { current: undefined }, rect: null as unknown as DragEndEvent['over'] extends infer O ? O extends null ? never : O extends { rect: infer R } ? R : never : never },
    collisions: null,
    delta: { x: 0, y: 0 },
    activatorEvent: new Event('pointerdown'),
  } as unknown as DragEndEvent;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useColumnDragReorder', () => {
  let onReorder: ReturnType<typeof vi.fn<(columns: ColumnConfigItem[]) => void>>;

  beforeEach(() => {
    onReorder = vi.fn<(columns: ColumnConfigItem[]) => void>();
  });

  describe('sequential order reassignment', () => {
    it('assigns 0-based sequential order values after reorder', () => {
      const columns = createColumns(5);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
        }),
      );

      // Move col-0 to position of col-2
      act(() => {
        result.current.handleDragEnd(makeDragEndEvent('col-0', 'col-2'));
      });

      expect(onReorder).toHaveBeenCalledTimes(1);
      const updated = onReorder.mock.calls[0][0] as ColumnConfigItem[];

      // Verify sequential 0-based order values
      updated.forEach((col, idx) => {
        expect(col.order).toBe(idx);
      });

      // Verify the set is {0, 1, 2, 3, 4}
      const orderValues = updated.map((c) => c.order).sort((a, b) => a - b);
      expect(orderValues).toEqual([0, 1, 2, 3, 4]);
    });

    it('preserves all column IDs after reorder (no data loss)', () => {
      const columns = createColumns(4);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
        }),
      );

      act(() => {
        result.current.handleDragEnd(makeDragEndEvent('col-3', 'col-0'));
      });

      const updated = onReorder.mock.calls[0][0] as ColumnConfigItem[];
      const ids = updated.map((c) => c.id).sort();
      expect(ids).toEqual(['col-0', 'col-1', 'col-2', 'col-3']);
    });

    it('moves the active column to the position of the over column', () => {
      const columns = createColumns(4);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
        }),
      );

      // Move col-0 to col-2 position
      act(() => {
        result.current.handleDragEnd(makeDragEndEvent('col-0', 'col-2'));
      });

      const updated = onReorder.mock.calls[0][0] as ColumnConfigItem[];
      // After moving col-0 past col-1 and col-2: order becomes [col-1, col-2, col-0, col-3]
      expect(updated[0].id).toBe('col-1');
      expect(updated[1].id).toBe('col-2');
      expect(updated[2].id).toBe('col-0');
      expect(updated[3].id).toBe('col-3');
    });
  });

  describe('locked columns', () => {
    it('does not allow dropping onto a locked column', () => {
      const columns = createColumns(4);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
          lockedColumns: ['col-0'],
        }),
      );

      // Try to drop col-1 onto locked col-0
      act(() => {
        result.current.handleDragEnd(makeDragEndEvent('col-1', 'col-0'));
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('does not allow dragging a locked column', () => {
      const columns = createColumns(4);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
          lockedColumns: ['col-0'],
        }),
      );

      // Try to drag locked col-0 to col-2
      act(() => {
        result.current.handleDragEnd(makeDragEndEvent('col-0', 'col-2'));
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('isDraggable returns false for locked columns', () => {
      const columns = createColumns(3);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
          lockedColumns: ['col-0', 'col-2'],
        }),
      );

      expect(result.current.isDraggable('col-0')).toBe(false);
      expect(result.current.isDraggable('col-1')).toBe(true);
      expect(result.current.isDraggable('col-2')).toBe(false);
    });

    it('allows reorder between non-locked columns', () => {
      const columns = createColumns(4);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
          lockedColumns: ['col-0'],
        }),
      );

      // Move col-1 to col-3 (both non-locked)
      act(() => {
        result.current.handleDragEnd(makeDragEndEvent('col-1', 'col-3'));
      });

      expect(onReorder).toHaveBeenCalledTimes(1);
      const updated = onReorder.mock.calls[0][0] as ColumnConfigItem[];
      // Sequential order values
      updated.forEach((col, idx) => {
        expect(col.order).toBe(idx);
      });
    });
  });

  describe('onReorder callback', () => {
    it('is not called when active equals over (no-op)', () => {
      const columns = createColumns(3);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
        }),
      );

      act(() => {
        result.current.handleDragEnd(makeDragEndEvent('col-1', 'col-1'));
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('is not called when over is null (dropped outside)', () => {
      const columns = createColumns(3);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
        }),
      );

      const event = {
        active: { id: 'col-0' },
        over: null,
        collisions: null,
        delta: { x: 0, y: 0 },
        activatorEvent: new Event('pointerdown'),
      } as unknown as DragEndEvent;

      act(() => {
        result.current.handleDragEnd(event);
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('is not called when column IDs are not found in effectiveColumns', () => {
      const columns = createColumns(3);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
        }),
      );

      act(() => {
        result.current.handleDragEnd(makeDragEndEvent('unknown-col', 'col-1'));
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('receives the full column array with updated order values', () => {
      const columns: ColumnConfigItem[] = [
        { id: 'name', visible: true, order: 0, width: 240 },
        { id: 'email', visible: true, order: 1, width: 220 },
        { id: 'status', visible: true, order: 2, width: 120 },
      ];

      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
        }),
      );

      // Move email before name
      act(() => {
        result.current.handleDragEnd(makeDragEndEvent('email', 'name'));
      });

      const updated = onReorder.mock.calls[0][0] as ColumnConfigItem[];
      expect(updated).toHaveLength(3);
      // email moved to front
      expect(updated[0].id).toBe('email');
      expect(updated[0].order).toBe(0);
      expect(updated[0].width).toBe(220); // preserves width
      expect(updated[1].id).toBe('name');
      expect(updated[1].order).toBe(1);
      expect(updated[2].id).toBe('status');
      expect(updated[2].order).toBe(2);
    });
  });

  describe('disabled state', () => {
    it('isDraggable returns false for all columns when disabled', () => {
      const columns = createColumns(3);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
          disabled: true,
        }),
      );

      expect(result.current.isDraggable('col-0')).toBe(false);
      expect(result.current.isDraggable('col-1')).toBe(false);
      expect(result.current.isDraggable('col-2')).toBe(false);
    });
  });

  describe('sortableColumnIds', () => {
    it('returns all column IDs from effectiveColumns', () => {
      const columns = createColumns(4);
      const { result } = renderHook(() =>
        useColumnDragReorder({
          effectiveColumns: columns,
          onReorder,
          lockedColumns: ['col-0'],
        }),
      );

      // sortableColumnIds includes all columns (dnd-kit needs them for SortableContext)
      expect(result.current.sortableColumnIds).toEqual([
        'col-0',
        'col-1',
        'col-2',
        'col-3',
      ]);
    });
  });
});
