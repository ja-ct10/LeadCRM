/**
 * Unit tests for CurrencyInput component.
 *
 * Validates Requirements:
 * - 10.5: Currency input accepts 0.00 to 999,999,999.99, 2 decimal places,
 *         currency prefix, rejects non-numeric input
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CurrencyInput } from '../currency-input';

describe('CurrencyInput', () => {
  it('renders with currency symbol prefix', () => {
    render(<CurrencyInput value={100} onChange={vi.fn()} currencySymbol="₱" />);
    expect(screen.getByText('₱')).toBeTruthy();
  });

  it('renders with custom currency symbol', () => {
    render(<CurrencyInput value={100} onChange={vi.fn()} currencySymbol="$" />);
    expect(screen.getByText('$')).toBeTruthy();
  });

  it('displays formatted value with 2 decimal places', () => {
    render(<CurrencyInput value={1234.5} onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('1,234.50');
  });

  it('displays empty string when value is undefined', () => {
    render(<CurrencyInput value={undefined} onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('displays empty string when value is null', () => {
    render(<CurrencyInput value={null} onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('calls onChange with numeric value on valid input', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={undefined} onChange={onChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '500.25' } });

    expect(onChange).toHaveBeenCalledWith(500.25);
  });

  it('rejects non-numeric characters by stripping them', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={undefined} onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);
    // Type a value with letters — the onChange handler strips non-numeric
    fireEvent.change(input, { target: { value: '100abc' } });

    // The component strips non-numeric chars, resulting in '100'
    expect(onChange).toHaveBeenCalledWith(100);
    expect(input.value).toBe('100');
  });

  it('does not call onChange when value exceeds maximum during typing', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={undefined} onChange={onChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1000000000' } });

    // Value exceeds max (999,999,999.99) — onChange should not be called
    expect(onChange).not.toHaveBeenCalledWith(1000000000);
  });

  it('clamps to max on blur when value exceeds limit', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={undefined} onChange={onChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1000000000.50' } });
    fireEvent.blur(input);

    // On blur, should clamp to max
    expect(onChange).toHaveBeenCalledWith(999999999.99);
  });

  it('formats display to 2 decimal places on blur', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={undefined} onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);

    // Should round to 2 decimal places
    expect(onChange).toHaveBeenCalledWith(42.00);
    expect(input.value).toBe('42.00');
  });

  it('accepts zero as a valid value', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={undefined} onChange={onChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0' } });

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('shows placeholder when no value', () => {
    render(<CurrencyInput value={undefined} onChange={vi.fn()} placeholder="0.00" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.getAttribute('placeholder')).toBe('0.00');
  });

  it('applies error styling when error prop is true', () => {
    const { container } = render(<CurrencyInput value={100} onChange={vi.fn()} error={true} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-red-500');
  });

  it('is disabled when disabled prop is true', () => {
    render(<CurrencyInput value={100} onChange={vi.fn()} disabled={true} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('strips thousand separators on focus for easy editing', () => {
    render(<CurrencyInput value={1234567.89} onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Before focus: formatted with commas
    expect(input.value).toBe('1,234,567.89');

    // After focus: raw number for editing
    fireEvent.focus(input);
    expect(input.value).toBe('1234567.89');
  });

  it('calls external onBlur callback', () => {
    const onBlur = vi.fn();
    render(<CurrencyInput value={100} onChange={vi.fn()} onBlur={onBlur} />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onBlur).toHaveBeenCalled();
  });

  it('limits input to 2 decimal places', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={undefined} onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '123.456' } });

    // Should truncate to 2 decimals
    expect(input.value).toBe('123.45');
  });

  it('sets aria-invalid when error is true', () => {
    render(<CurrencyInput value={100} onChange={vi.fn()} error={true} />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('uses inputMode decimal for mobile numeric keyboard', () => {
    render(<CurrencyInput value={100} onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });
});
