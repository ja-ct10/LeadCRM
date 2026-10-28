import React, { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PhilippinePhoneInput } from './philippine-phone-input';
import { normalizePhInput, toE164, validatePhMobile } from '@/shared/utils/ph-phone';
afterEach(cleanup);
function Editor({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <PhilippinePhoneInput value={value} onChange={setValue} />;
}
it.each(['+639123456789', '639123456789', '09123456789', '9123456789', '+63 (912) 345-6789'])('displays a pasted %s locally', input => {
  render(<Editor />);
  const field = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.paste(field, { clipboardData: { getData: () => input } });
  expect(field.value).toBe('9123456789'); expect(field.selectionStart).toBe(10);
});
it('strips a prefix while typing before reaching the local length limit', () => {
  render(<Editor />); const field = screen.getByRole('textbox') as HTMLInputElement;
  for (const digit of '639123456789') fireEvent.change(field, { target: { value: field.value + digit, selectionStart: field.value.length + 1 } });
  expect(field.value).toBe('9123456789');
});
it('replaces only selected digits and leaves the caret next to the insertion', () => {
  render(<Editor initial="9123456789" />); const field = screen.getByRole('textbox') as HTMLInputElement;
  field.focus(); field.setSelectionRange(3, 6);
  fireEvent.paste(field, { clipboardData: { getData: () => '000' } });
  expect(field.value).toBe('9120006789'); expect(field.selectionStart).toBe(6);
});
it('preserves valid local values and is stable across repeated normalization', () => {
  for (const number of ['9123456789', '9631234567', '9987654321']) expect(normalizePhInput(normalizePhInput(number))).toBe(number);
});
it('places the caret after an identical selection replacement', () => {
  render(<Editor initial="9123456789" />); const field = screen.getByRole('textbox') as HTMLInputElement;
  field.focus(); field.setSelectionRange(3, 6);
  fireEvent.paste(field, { clipboardData: { getData: () => '345' } });
  expect(field.value).toBe('9123456789'); expect(field.selectionStart).toBe(6); expect(field.selectionEnd).toBe(6);
});
it('keeps existing Philippine validation and canonical storage', () => {
  const local = normalizePhInput('+639123456789');
  expect(validatePhMobile(local)).toBeNull(); expect(toE164(local)).toBe('+639123456789');
  expect(validatePhMobile('8123456789')).toBeTruthy(); expect(validatePhMobile('912')).toBeTruthy();
});
