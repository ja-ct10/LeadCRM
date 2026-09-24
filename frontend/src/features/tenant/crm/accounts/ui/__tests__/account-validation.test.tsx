import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: [] }) }));
vi.mock('@/shared/hooks/use-scroll-to-error', () => ({ useScrollToError: vi.fn() }));
import { AccountFormInner } from '../account-form';
afterEach(cleanup);
const message = 'Tax ID must contain exactly 9 digits.';
const setup = (taxId = '') => {
  const save = vi.fn();
  render(<AccountFormInner initialData={{ id: 'account', tenantId: 'tenant', name: 'Account', country: 'Other', taxId, createdAt: '2026-09-24T00:00:00Z' }} onSave={save} onCancel={vi.fn()} />);
  return { input: screen.getByLabelText('Tax ID') as HTMLInputElement, save };
};

it('validates immediately, preserves leading zeros, caps digits, and allows clearing', async () => {
  const { input, save } = setup();
  expect(input.inputMode).toBe('numeric'); expect(input.maxLength).toBe(9);
  fireEvent.change(input, { target: { value: '12345678' } });
  await screen.findByText(message);
  expect(screen.getAllByText(message)).toHaveLength(1);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain(message);
  fireEvent.change(input, { target: { value: '0123456789' } });
  await waitFor(() => expect(screen.queryByText(message)).toBeNull());
  expect(input.value).toBe('012345678');
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.submit(input.closest('form')!);
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0]).toMatchObject({ taxId: '', country: 'Philippines' });
  expect((screen.getByLabelText('Country') as HTMLInputElement).readOnly).toBe(true);
});

it.each([['12ABC6789', '126789'], ['123-456-789', '123456789'], [' 123 456 789 ', '123456789'], ['1234567890', '123456789']])('sanitizes pasted %s', async (text, expected) => {
  const { input } = setup();
  fireEvent.paste(input, { clipboardData: { getData: () => text } });
  await waitFor(() => expect(input.value).toBe(expected));
});

it('replaces selected digits without changing unselected digits on paste', async () => {
  const { input } = setup('123456789');
  input.setSelectionRange(2, 5);
  fireEvent.paste(input, { clipboardData: { getData: () => '000999' } });
  await waitFor(() => expect(input.value).toBe('120006789'));
});
