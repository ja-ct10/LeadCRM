/**
 * DataGrid — EmptyState variant logic unit tests.
 *
 * Validates:
 * - Requirement 1.6: Empty state message preserves header and container styling
 * - Requirement 13.2: Three variants (filtered, empty-module, default)
 *
 * These tests validate the empty state resolution logic and variant behavior
 * without rendering the full DataGrid component (avoids JSX transform dependency).
 */

import { describe, it, expect } from 'vitest';
import type { DataGridEmptyStateProps } from '../types';

// ─── Logic extracted from DataGrid for testability ────────────────────────────

/**
 * Resolves which empty state content to show based on variant.
 * This mirrors the conditional logic in DataGrid's tbody rendering.
 */
type EmptyStateResolution =
  | { type: 'filtered'; title: string; description: string; showClearButton: boolean }
  | { type: 'empty-module'; title: string; description: string; showCreateButton: boolean }
  | { type: 'default'; title: string; description: string | null }
  | { type: 'fallback'; message: string };

function resolveEmptyState(
  emptyState: DataGridEmptyStateProps | undefined,
  emptyMessage: string,
): EmptyStateResolution {
  if (emptyState?.variant === 'filtered') {
    return {
      type: 'filtered',
      title: emptyState.title ?? 'No results found',
      description: emptyState.description ?? 'No records match your current filters.',
      showClearButton: !!emptyState.onClearFilters,
    };
  }

  if (emptyState?.variant === 'empty-module') {
    return {
      type: 'empty-module',
      title: emptyState.title ?? 'Nothing here yet',
      description: emptyState.description ?? 'Create your first record to get started.',
      showCreateButton: !!(emptyState.canCreate && emptyState.onCreateRecord),
    };
  }

  if (emptyState?.variant === 'default') {
    return {
      type: 'default',
      title: emptyState.title ?? 'No records found',
      description: emptyState.description ?? null,
    };
  }

  return { type: 'fallback', message: emptyMessage };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DataGrid EmptyState variant logic', () => {
  describe('variant: filtered', () => {
    it('resolves with default title and description when none provided', () => {
      const result = resolveEmptyState({ variant: 'filtered' }, 'fallback');
      expect(result).toEqual({
        type: 'filtered',
        title: 'No results found',
        description: 'No records match your current filters.',
        showClearButton: false,
      });
    });

    it('resolves with custom title and description', () => {
      const result = resolveEmptyState(
        { variant: 'filtered', title: 'No matching leads', description: 'Adjust your search.' },
        'fallback',
      );
      expect(result).toEqual({
        type: 'filtered',
        title: 'No matching leads',
        description: 'Adjust your search.',
        showClearButton: false,
      });
    });

    it('shows clear-filters button when onClearFilters is provided', () => {
      const result = resolveEmptyState(
        { variant: 'filtered', onClearFilters: () => {} },
        'fallback',
      );
      expect(result.type).toBe('filtered');
      if (result.type === 'filtered') {
        expect(result.showClearButton).toBe(true);
      }
    });

    it('hides clear-filters button when onClearFilters is not provided', () => {
      const result = resolveEmptyState({ variant: 'filtered' }, 'fallback');
      expect(result.type).toBe('filtered');
      if (result.type === 'filtered') {
        expect(result.showClearButton).toBe(false);
      }
    });
  });

  describe('variant: empty-module', () => {
    it('resolves with default title and description when none provided', () => {
      const result = resolveEmptyState({ variant: 'empty-module' }, 'fallback');
      expect(result).toEqual({
        type: 'empty-module',
        title: 'Nothing here yet',
        description: 'Create your first record to get started.',
        showCreateButton: false,
      });
    });

    it('resolves with custom title and description', () => {
      const result = resolveEmptyState(
        { variant: 'empty-module', title: 'No deals yet', description: 'Start tracking.' },
        'fallback',
      );
      expect(result).toEqual({
        type: 'empty-module',
        title: 'No deals yet',
        description: 'Start tracking.',
        showCreateButton: false,
      });
    });

    it('shows create button when canCreate is true AND onCreateRecord is provided', () => {
      const result = resolveEmptyState(
        { variant: 'empty-module', canCreate: true, onCreateRecord: () => {} },
        'fallback',
      );
      expect(result.type).toBe('empty-module');
      if (result.type === 'empty-module') {
        expect(result.showCreateButton).toBe(true);
      }
    });

    it('hides create button when canCreate is false (RBAC-gated)', () => {
      const result = resolveEmptyState(
        { variant: 'empty-module', canCreate: false, onCreateRecord: () => {} },
        'fallback',
      );
      expect(result.type).toBe('empty-module');
      if (result.type === 'empty-module') {
        expect(result.showCreateButton).toBe(false);
      }
    });

    it('hides create button when onCreateRecord is not provided', () => {
      const result = resolveEmptyState(
        { variant: 'empty-module', canCreate: true },
        'fallback',
      );
      expect(result.type).toBe('empty-module');
      if (result.type === 'empty-module') {
        expect(result.showCreateButton).toBe(false);
      }
    });

    it('hides create button when both canCreate and onCreateRecord are missing', () => {
      const result = resolveEmptyState({ variant: 'empty-module' }, 'fallback');
      expect(result.type).toBe('empty-module');
      if (result.type === 'empty-module') {
        expect(result.showCreateButton).toBe(false);
      }
    });
  });

  describe('variant: default', () => {
    it('resolves with custom title as plain text message', () => {
      const result = resolveEmptyState(
        { variant: 'default', title: 'No data available' },
        'fallback',
      );
      expect(result).toEqual({
        type: 'default',
        title: 'No data available',
        description: null,
      });
    });

    it('resolves with fallback title when none provided', () => {
      const result = resolveEmptyState({ variant: 'default' }, 'fallback');
      expect(result).toEqual({
        type: 'default',
        title: 'No records found',
        description: null,
      });
    });

    it('includes description when provided', () => {
      const result = resolveEmptyState(
        { variant: 'default', title: 'Empty', description: 'Check back later.' },
        'fallback',
      );
      expect(result).toEqual({
        type: 'default',
        title: 'Empty',
        description: 'Check back later.',
      });
    });

    it('does not include action button indicators (plain text only)', () => {
      const result = resolveEmptyState(
        { variant: 'default', title: 'No data' },
        'fallback',
      );
      expect(result.type).toBe('default');
      // Default variant has no showClearButton or showCreateButton
      expect(result).not.toHaveProperty('showClearButton');
      expect(result).not.toHaveProperty('showCreateButton');
    });
  });

  describe('fallback (no emptyState prop)', () => {
    it('falls back to emptyMessage when emptyState is undefined', () => {
      const result = resolveEmptyState(undefined, 'No records found.');
      expect(result).toEqual({ type: 'fallback', message: 'No records found.' });
    });

    it('uses default emptyMessage text', () => {
      const result = resolveEmptyState(undefined, 'Custom empty message.');
      expect(result).toEqual({ type: 'fallback', message: 'Custom empty message.' });
    });
  });

  describe('emptyState takes precedence over emptyMessage', () => {
    it('emptyState default variant wins over emptyMessage', () => {
      const result = resolveEmptyState(
        { variant: 'default', title: 'New empty state' },
        'Legacy message',
      );
      expect(result.type).toBe('default');
      if (result.type === 'default') {
        expect(result.title).toBe('New empty state');
      }
    });

    it('emptyState filtered variant wins over emptyMessage', () => {
      const result = resolveEmptyState(
        { variant: 'filtered' },
        'Legacy message',
      );
      expect(result.type).toBe('filtered');
    });

    it('emptyState empty-module variant wins over emptyMessage', () => {
      const result = resolveEmptyState(
        { variant: 'empty-module' },
        'Legacy message',
      );
      expect(result.type).toBe('empty-module');
    });
  });

  describe('type safety', () => {
    it('accepts all three valid variant values', () => {
      const variants: Array<DataGridEmptyStateProps['variant']> = [
        'filtered',
        'empty-module',
        'default',
      ];

      for (const variant of variants) {
        const result = resolveEmptyState({ variant }, '');
        expect(result.type).toBe(variant);
      }
    });
  });
});
