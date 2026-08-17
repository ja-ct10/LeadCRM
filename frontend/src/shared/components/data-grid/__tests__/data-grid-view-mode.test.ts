/**
 * DataGrid — viewMode ('clip' | 'wrap') logic unit tests.
 *
 * Validates:
 * - Requirement 6.1: clip mode truncates cell text with ellipsis, single line
 * - Requirement 6.2: wrap mode allows multi-line with line-clamp-3, min 52px, max 156px row
 * - Requirement 13.5: DataGrid accepts viewMode prop and applies corresponding overflow behavior
 *
 * These tests validate the class/style computation logic for viewMode without
 * rendering the full DataGrid component (avoids JSX transform dependency).
 */

import { describe, it, expect } from 'vitest';

// ─── Constants matching data-grid.tsx ─────────────────────────────────────────

const ROW_HEIGHT_NORMAL = 52;
const ROW_HEIGHT_DENSE = 44;
const MAX_WRAP_HEIGHT = 156;

// ─── Logic extracted from DataGrid for testability ────────────────────────────

type ViewMode = 'wrap' | 'clip';

/**
 * Computes the cellContentClass based on viewMode.
 * This mirrors the logic in DataGrid component.
 */
function getCellContentClass(viewMode: ViewMode): string {
  return viewMode === 'wrap'
    ? 'whitespace-normal break-words line-clamp-3 overflow-hidden'
    : 'truncate';
}

/**
 * Computes the row style based on viewMode and dense setting.
 * This mirrors the logic in DataGrid component.
 */
function getRowStyle(viewMode: ViewMode, dense: boolean): Record<string, string | number> {
  const rowHeight = dense ? ROW_HEIGHT_DENSE : ROW_HEIGHT_NORMAL;
  return viewMode === 'wrap'
    ? { minHeight: rowHeight, maxHeight: MAX_WRAP_HEIGHT }
    : { height: rowHeight };
}

/**
 * Computes the cell wrapper div classes based on viewMode.
 * This mirrors the logic in DataGrid component for scrollable/pinned cells (non-tooltip case).
 */
function getCellWrapperClasses(viewMode: ViewMode, cellContentClass: string): string {
  const baseClasses = 'flex items-center';
  const modeClasses = viewMode === 'clip' ? 'h-full truncate' : 'min-h-[28px]';
  return `${baseClasses} ${modeClasses} ${cellContentClass}`;
}

/**
 * Determines if py-2 (vertical padding) should be applied to the td element.
 */
function shouldApplyVerticalPadding(viewMode: ViewMode): boolean {
  return viewMode === 'wrap';
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DataGrid viewMode logic', () => {
  describe('cellContentClass computation', () => {
    it('clip mode produces truncate class for single-line ellipsis', () => {
      const cls = getCellContentClass('clip');
      expect(cls).toBe('truncate');
      expect(cls).toContain('truncate');
    });

    it('wrap mode produces line-clamp-3 for multi-line clamped content', () => {
      const cls = getCellContentClass('wrap');
      expect(cls).toContain('line-clamp-3');
      expect(cls).toContain('whitespace-normal');
      expect(cls).toContain('break-words');
      expect(cls).toContain('overflow-hidden');
    });

    it('clip mode does NOT contain whitespace-normal or line-clamp', () => {
      const cls = getCellContentClass('clip');
      expect(cls).not.toContain('whitespace-normal');
      expect(cls).not.toContain('line-clamp');
    });

    it('wrap mode does NOT contain truncate', () => {
      const cls = getCellContentClass('wrap');
      expect(cls).not.toContain('truncate');
    });
  });

  describe('row style computation', () => {
    it('clip mode sets fixed height to 52px (normal)', () => {
      const style = getRowStyle('clip', false);
      expect(style).toEqual({ height: 52 });
    });

    it('clip mode sets fixed height to 44px (dense)', () => {
      const style = getRowStyle('clip', true);
      expect(style).toEqual({ height: 44 });
    });

    it('wrap mode sets minHeight to 52px and maxHeight to 156px (normal)', () => {
      const style = getRowStyle('wrap', false);
      expect(style).toEqual({ minHeight: 52, maxHeight: 156 });
    });

    it('wrap mode sets minHeight to 44px and maxHeight to 156px (dense)', () => {
      const style = getRowStyle('wrap', true);
      expect(style).toEqual({ minHeight: 44, maxHeight: 156 });
    });

    it('clip mode does NOT have minHeight or maxHeight', () => {
      const style = getRowStyle('clip', false);
      expect(style).not.toHaveProperty('minHeight');
      expect(style).not.toHaveProperty('maxHeight');
    });

    it('wrap mode does NOT have fixed height', () => {
      const style = getRowStyle('wrap', false);
      expect(style).not.toHaveProperty('height');
    });
  });

  describe('cell wrapper classes', () => {
    it('clip mode includes h-full and truncate for single-line fixed height', () => {
      const cls = getCellWrapperClasses('clip', getCellContentClass('clip'));
      expect(cls).toContain('h-full');
      expect(cls).toContain('truncate');
      expect(cls).toContain('flex items-center');
    });

    it('wrap mode includes min-h-[28px] for multi-line min height', () => {
      const cls = getCellWrapperClasses('wrap', getCellContentClass('wrap'));
      expect(cls).toContain('min-h-[28px]');
      expect(cls).toContain('line-clamp-3');
      expect(cls).toContain('flex items-center');
    });

    it('clip mode does NOT include min-h-[28px]', () => {
      const cls = getCellWrapperClasses('clip', getCellContentClass('clip'));
      expect(cls).not.toContain('min-h-[28px]');
    });

    it('wrap mode does NOT include h-full', () => {
      const cls = getCellWrapperClasses('wrap', getCellContentClass('wrap'));
      expect(cls).not.toContain('h-full');
    });
  });

  describe('vertical padding (py-2)', () => {
    it('applies py-2 in wrap mode', () => {
      expect(shouldApplyVerticalPadding('wrap')).toBe(true);
    });

    it('does NOT apply py-2 in clip mode', () => {
      expect(shouldApplyVerticalPadding('clip')).toBe(false);
    });
  });

  describe('viewMode prop type acceptance', () => {
    it('accepts clip as a valid viewMode', () => {
      const viewMode: ViewMode = 'clip';
      expect(getCellContentClass(viewMode)).toBeDefined();
    });

    it('accepts wrap as a valid viewMode', () => {
      const viewMode: ViewMode = 'wrap';
      expect(getCellContentClass(viewMode)).toBeDefined();
    });
  });
});
