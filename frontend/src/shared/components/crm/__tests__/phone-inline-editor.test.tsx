import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { STAFF_PHONE_CONFLICT } from '@leadcrm/shared';
import { InlineEditRows } from '../inline-edit-rows';
import { PhoneInlineEditor } from '../phone-inline-editor';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: mocks.get } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'staff', tenantId: 'tenant', role: 'Custom' } }) }));
beforeEach(() => mocks.get.mockReset().mockResolvedValue({ success: true, data: { available: true } }));
afterEach(cleanup);
it.each(['leads', 'contacts'] as const)('blocks staff phone in a %s inline edit, displays the exact error and saves a corrected number', async module => {
  mocks.get.mockResolvedValue({ success: true, data: { available: false, reason: 'STAFF_PHONE_NOT_ALLOWED' } });
  const save = vi.fn().mockResolvedValue(undefined);
  render(<InlineEditRows canEdit onSave={save} rows={[{ label: 'Phone', value: '+639171234567', type: 'tel', apiField: 'phone', customEditorActions: true,
    renderEditor: props => <PhoneInlineEditor {...props} module={module} /> }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Phone' }));
  const error = await screen.findByText(STAFF_PHONE_CONFLICT);
  const input = screen.getByPlaceholderText('9xxxxxxxxx');
  expect(document.getElementById(input.getAttribute('aria-describedby')!)).toBe(error);
  fireEvent.click(screen.getByRole('button', { name: 'Save' })); expect(save).not.toHaveBeenCalled();
  mocks.get.mockResolvedValue({ success: true, data: { available: true } });
  fireEvent.change(input, { target: { value: '9181234567' } });
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false), { timeout: 2000 });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith('phone', '+639181234567'));
});
it('displays a save-time rejection below the inline phone and permits clearing an optional value', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error(STAFF_PHONE_CONFLICT)).mockResolvedValue(undefined);
  render(<InlineEditRows canEdit onSave={save} rows={[{ label: 'Phone', value: '+639171234567', type: 'tel', apiField: 'phone', customEditorActions: true,
    renderEditor: props => <PhoneInlineEditor {...props} module="leads" /> }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Phone' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(STAFF_PHONE_CONFLICT)).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('9xxxxxxxxx'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(save).toHaveBeenLastCalledWith('phone', ''));
});
