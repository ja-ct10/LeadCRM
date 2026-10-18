/**
 * Unit tests for ManageColumnsDrawer save with retry and unsaved-changes guard.
 *
 * Validates Requirements:
 * - 5.2: Save persists via onSave (PUT /api/v1/preferences/columns/:module)
 * - 5.3: Inline error with Retry button, 3 attempts max, then "close and try again"
 * - 5.7: Confirmation dialog on close with unsaved changes
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import React from 'react';
import { ManageColumnsDrawer } from '../manage-columns-drawer';
import type { ColumnDefinition, ColumnConfigItem } from '@leadcrm/shared';
import { LEADS_TABLE_COLUMNS, ACCOUNTS_TABLE_COLUMNS, reconcileTableColumns } from '@leadcrm/shared';

vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => ({ data: undefined }) }));

it('offers Company Address and excludes removed Account columns after saved preference reconciliation', async () => {
  const columns = reconcileTableColumns('accounts', [{ id: 'name', visible: true, order: 0 }, { id: 'city', visible: true, order: 1, width: 245 }, { id: 'internalNotes', visible: true, order: 2 }, { id: 'activeProductIds', visible: true, order: 3 }], ACCOUNTS_TABLE_COLUMNS);
  const save = vi.fn().mockResolvedValue(undefined);
  renderDrawer({ module: 'accounts', registry: ACCOUNTS_TABLE_COLUMNS, effectiveColumns: columns, onSave: save });
  for (const label of ['Active Products', 'Internal Notes', 'City', 'Province', 'Country']) expect(screen.queryByText(label)).toBeNull();
  fireEvent.click(screen.getByRole('switch', { name: 'Toggle Company Address visibility' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].find((column: ColumnConfigItem) => column.id === 'address')).toMatchObject({ visible: false, width: 245 });
});

it('confirms both name switches in the draft, cancels without changes, and saves through the existing action', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const defaults = LEADS_TABLE_COLUMNS.map(column => ({ id: column.id, order: column.defaultOrder, visible: column.defaultVisible, width: 222 }));
  render(<ManageColumnsDrawer isOpen module="leads" registry={LEADS_TABLE_COLUMNS} effectiveColumns={defaults} onSave={save} onReset={vi.fn()} onClose={vi.fn()} />);
  const toggle = (name: string) => screen.getByRole('switch', { name: `Toggle ${name} visibility` });
  fireEvent.click(toggle('First Name'));
  expect(screen.getByText('Name already combines First Name and Last Name. To display these separately, Name needs to be hidden. Would you like to switch columns?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(toggle('Name').getAttribute('aria-checked')).toBe('true');
  expect(toggle('First Name').getAttribute('aria-checked')).toBe('false');
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(toggle('First Name'));
  fireEvent.click(screen.getByRole('button', { name: 'Switch Columns' }));
  await waitFor(() => expect(toggle('Name').getAttribute('aria-checked')).toBe('false'));
  expect(toggle('First Name').getAttribute('aria-checked')).toBe('true');
  fireEvent.click(toggle('Last Name'));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  fireEvent.click(toggle('Name'));
  expect(screen.getByText('Showing Name will hide the separate First Name and Last Name columns. Continue?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(toggle('First Name').getAttribute('aria-checked')).toBe('true');
  fireEvent.click(toggle('Name')); fireEvent.click(screen.getByRole('button', { name: 'Switch Columns' }));
  await waitFor(() => expect(toggle('Name').getAttribute('aria-checked')).toBe('true'));
  expect(toggle('First Name').getAttribute('aria-checked')).toBe('false');
  expect(toggle('Last Name').getAttribute('aria-checked')).toBe('false');
  fireEvent.click(toggle('Name')); // Hiding alone is allowed and leaves form data untouched.
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0].find((column: ColumnConfigItem) => column.id === 'name')).toMatchObject({ visible: false, order: 0, width: 222 });
}, 15000);

// Mock @dnd-kit modules used internally by ManageColumnsDrawer
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  verticalListSortingStrategy: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => null } },
}));

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const REGISTRY: ColumnDefinition[] = [
  { id: 'name', label: 'Name', required: true, fixedPosition: 'first', defaultVisible: true, defaultOrder: 0, group: 'General', priority: 'required' },
  { id: 'email', label: 'Email', required: false, defaultVisible: true, defaultOrder: 1, group: 'General', priority: 'high' },
  { id: 'phone', label: 'Phone', required: false, defaultVisible: true, defaultOrder: 2, group: 'Contact', priority: 'medium' },
];

const EFFECTIVE_COLUMNS: ColumnConfigItem[] = [
  { id: 'name', visible: true, order: 0 },
  { id: 'email', visible: true, order: 1 },
  { id: 'phone', visible: true, order: 2 },
];

function renderDrawer(overrides: Partial<React.ComponentProps<typeof ManageColumnsDrawer>> = {}) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    module: 'leads',
    registry: REGISTRY,
    effectiveColumns: EFFECTIVE_COLUMNS,
    onSave: vi.fn().mockResolvedValue(undefined),
    onReset: vi.fn().mockResolvedValue(undefined),
  };

  const props = { ...defaultProps, ...overrides };
  const result = render(React.createElement(ManageColumnsDrawer, props));
  return { ...result, props };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ManageColumnsDrawer — save, retry, and unsaved-changes guard', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('treats registry fallback as the baseline when effective columns are empty', async () => {
    const onClose = vi.fn();
    renderDrawer({ effectiveColumns: [], onClose });
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => fireEvent.click(screen.getByLabelText('Close drawer')));
    expect(screen.queryByText('Discard changes?')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows contiguous group headings in persisted table order and locks fixed Name movement', () => {
    renderDrawer({ effectiveColumns: [EFFECTIVE_COLUMNS[0], { ...EFFECTIVE_COLUMNS[2], order: 1 }, { ...EFFECTIVE_COLUMNS[1], order: 2 }] });
    expect(screen.getAllByRole('listitem').map(item => item.getAttribute('aria-label'))).toEqual([
      'Column Name, position 1 of 3', 'Column Phone, position 2 of 3', 'Column Email, position 3 of 3',
    ]);
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['General', 'Contact', 'General']);
    expect((screen.getByLabelText('Drag to reorder Name') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Name visibility (locked)') as HTMLButtonElement).disabled).toBe(true);
  });

  it('trims column search and retains draft visibility across background updates', async () => {
    const { rerender, props } = renderDrawer();
    await act(async () => fireEvent.click(screen.getByLabelText('Toggle Email visibility')));
    rerender(<ManageColumnsDrawer {...props} effectiveColumns={EFFECTIVE_COLUMNS.map(column => column.id === 'phone' ? { ...column, visible: false } : column)} />);
    expect(screen.getByLabelText('Toggle Email visibility').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByLabelText('Toggle Phone visibility').getAttribute('aria-checked')).toBe('true');
    fireEvent.change(screen.getByLabelText('Search columns'), { target: { value: '  EMAIL  ' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByLabelText('Toggle Email visibility').getAttribute('aria-checked')).toBe('false');
  });

  it('preserves its unsaved draft and Retry through optimistic publish and rollback', async () => {
    let rejectFirst!: (error: Error) => void;
    const persist = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce(undefined);
    function Harness() {
      const [effectiveColumns, setEffectiveColumns] = React.useState(EFFECTIVE_COLUMNS);
      const onSave = async (config: ColumnConfigItem[]) => {
        setEffectiveColumns(config);
        try { await persist(config); }
        catch (error) { setEffectiveColumns(EFFECTIVE_COLUMNS); throw error; }
      };
      return <ManageColumnsDrawer isOpen onClose={vi.fn()} module="leads" registry={REGISTRY} effectiveColumns={effectiveColumns} onSave={onSave} onReset={vi.fn()} />;
    }
    render(<Harness />);
    await act(async () => fireEvent.click(screen.getByLabelText('Toggle Email visibility')));
    await act(async () => fireEvent.click(screen.getByText('Save')));
    expect(screen.getByText('Saving...')).toBeTruthy();
    await act(async () => rejectFirst(new Error('Network failed')));
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.getByLabelText('Toggle Email visibility').getAttribute('aria-checked')).toBe('false');
    await act(async () => fireEvent.click(screen.getByText('Retry')));
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[1][0]).toEqual(persist.mock.calls[0][0]);
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('preserves edits and reports reset failure without closing its confirmation', async () => {
    const onReset = vi.fn().mockRejectedValue(new Error('Network failed'));
    renderDrawer({ onReset });
    await act(async () => fireEvent.click(screen.getByLabelText('Toggle Email visibility')));
    await act(async () => fireEvent.click(screen.getByText('Reset to Default')));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reset' })));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Unable to reset columns. Please try again.').length).toBeGreaterThan(0);
    expect(screen.getByText('Reset to Default?')).toBeTruthy();
    expect(screen.getByLabelText('Toggle Email visibility').getAttribute('aria-checked')).toBe('false');
  });

  describe('Requirement 5.2: Save persists via onSave', () => {
    it('calls onSave with updated column config when Save is clicked', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderDrawer({ onSave });

      // Toggle email visibility to create a change
      const emailToggle = screen.getByLabelText('Toggle Email visibility');
      await act(async () => { fireEvent.click(emailToggle); });

      // Click Save
      const saveButton = screen.getByText('Save');
      await act(async () => { fireEvent.click(saveButton); });

      expect(onSave).toHaveBeenCalledTimes(1);
      const savedConfig = onSave.mock.calls[0][0] as ColumnConfigItem[];
      const emailCol = savedConfig.find((c) => c.id === 'email');
      expect(emailCol?.visible).toBe(false);
    });

    it('Save button is disabled when there are no changes', () => {
      renderDrawer();
      const saveButton = screen.getByText('Save');
      expect(saveButton.hasAttribute('disabled')).toBe(true);
    });

    it('shows "Saving..." during save operation', async () => {
      let resolveSave: () => void;
      const onSave = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
      renderDrawer({ onSave });

      // Create a change
      const emailToggle = screen.getByLabelText('Toggle Email visibility');
      await act(async () => { fireEvent.click(emailToggle); });

      // Click Save (don't resolve yet)
      await act(async () => { fireEvent.click(screen.getByText('Save')); });

      expect(screen.getByText('Saving...')).toBeTruthy();

      // Cleanup: resolve the save
      await act(async () => { resolveSave!(); });
    });

    it('shows "Saved" after successful save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderDrawer({ onSave });

      // Create a change
      const emailToggle = screen.getByLabelText('Toggle Email visibility');
      await act(async () => { fireEvent.click(emailToggle); });

      // Click Save
      await act(async () => { fireEvent.click(screen.getByText('Save')); });

      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeTruthy();
      });
    });
  });

  describe('Requirement 5.3: Inline error with Retry, max 3 attempts', () => {
    it('shows inline error with Retry button on save failure', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
      renderDrawer({ onSave });

      // Create a change
      const emailToggle = screen.getByLabelText('Toggle Email visibility');
      await act(async () => { fireEvent.click(emailToggle); });

      // Click Save — will fail
      await act(async () => { fireEvent.click(screen.getByText('Save')); });

      await waitFor(() => {
        expect(screen.getByText('Unable to save')).toBeTruthy();
        expect(screen.getByText('Retry')).toBeTruthy();
      });
    });

    it('allows up to 3 retry attempts then shows close message', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
      renderDrawer({ onSave });

      // Create a change
      const emailToggle = screen.getByLabelText('Toggle Email visibility');
      await act(async () => { fireEvent.click(emailToggle); });

      // First save attempt (fails) — retryCount becomes 1
      await act(async () => { fireEvent.click(screen.getByText('Save')); });
      await waitFor(() => { expect(screen.getByText('Retry')).toBeTruthy(); });

      // Retry 1 (fails) — retryCount becomes 2
      await act(async () => { fireEvent.click(screen.getByText('Retry')); });
      await waitFor(() => { expect(screen.getByText('Retry')).toBeTruthy(); });

      // Retry 2 (fails) — retryCount becomes 3
      await act(async () => { fireEvent.click(screen.getByText('Retry')); });

      // After 3 consecutive failures: show "close and try again" message, no Retry button
      await waitFor(() => {
        expect(screen.getByText(/close and try again/i)).toBeTruthy();
        expect(screen.queryByText('Retry')).toBeNull();
      });

      expect(onSave).toHaveBeenCalledTimes(3);
    });

    it('resets retry count on successful save after failure', async () => {
      const onSave = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);
      renderDrawer({ onSave });

      // Create a change
      const emailToggle = screen.getByLabelText('Toggle Email visibility');
      await act(async () => { fireEvent.click(emailToggle); });

      // First save attempt (fails)
      await act(async () => { fireEvent.click(screen.getByText('Save')); });
      await waitFor(() => { expect(screen.getByText('Retry')).toBeTruthy(); });

      // Retry succeeds
      await act(async () => { fireEvent.click(screen.getByText('Retry')); });

      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeTruthy();
      });

      expect(screen.queryByText('Unable to save')).toBeNull();
    });
  });

  describe('Requirement 5.7: Confirmation dialog on close with unsaved changes', () => {
    it('Escape dismisses the discard confirmation without also closing its drawer', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose });
      await act(async () => { fireEvent.click(screen.getByLabelText('Toggle Email visibility')); });
      await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
      expect(screen.getByText('Discard changes?')).toBeTruthy();
      await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
      expect(screen.queryByText('Discard changes?')).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Manage Columns - leads' })).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close or open a discard dialog while a save is pending', async () => {
      let finishSave: () => void;
      const onSave = vi.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
      const onClose = vi.fn();
      renderDrawer({ onSave, onClose });
      await act(async () => { fireEvent.click(screen.getByLabelText('Toggle Email visibility')); });
      await act(async () => { fireEvent.click(screen.getByText('Save')); });
      expect((screen.getByLabelText('Close drawer') as HTMLButtonElement).disabled).toBe(true);
      await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
      expect(screen.queryByText('Discard changes?')).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      await act(async () => finishSave());
      expect(screen.getByText('Saved')).toBeTruthy();
    });

    it('shows confirmation dialog when closing with unsaved changes', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose });

      // Create a change
      const emailToggle = screen.getByLabelText('Toggle Email visibility');
      await act(async () => { fireEvent.click(emailToggle); });

      // Click close button
      const closeButton = screen.getByLabelText('Close drawer');
      await act(async () => { fireEvent.click(closeButton); });

      // Confirmation dialog should appear
      expect(screen.getByText('Discard changes?')).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes drawer when user confirms discard', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose });

      // Create a change
      const emailToggle = screen.getByLabelText('Toggle Email visibility');
      await act(async () => { fireEvent.click(emailToggle); });

      // Click close button
      const closeButton = screen.getByLabelText('Close drawer');
      await act(async () => { fireEvent.click(closeButton); });

      // Click Discard in the dialog
      const discardButton = screen.getByText('Discard');
      await act(async () => { fireEvent.click(discardButton); });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps drawer open when user cancels the discard dialog', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose });

      // Create a change
      const emailToggle = screen.getByLabelText('Toggle Email visibility');
      await act(async () => { fireEvent.click(emailToggle); });

      // Click close button
      const closeButton = screen.getByLabelText('Close drawer');
      await act(async () => { fireEvent.click(closeButton); });

      // Click "Keep editing" in the dialog
      const keepEditingButton = screen.getByText('Keep editing');
      await act(async () => { fireEvent.click(keepEditingButton); });

      expect(onClose).not.toHaveBeenCalled();
      // Dialog should be dismissed
      expect(screen.queryByText('Discard changes?')).toBeNull();
    });

    it('closes directly without dialog when no unsaved changes', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose });

      // Click close button without making changes
      const closeButton = screen.getByLabelText('Close drawer');
      await act(async () => { fireEvent.click(closeButton); });

      // No dialog, just close
      expect(screen.queryByText('Discard changes?')).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
