import React, { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Checkbox } from '../checkbox';

afterEach(cleanup);

it('renders native and visible mixed state, forwards refs, and updates when controlled', () => {
  const ref = createRef<HTMLInputElement>();
  const change = vi.fn();
  const view = render(<Checkbox ref={ref} aria-label="Permissions" checked={false} indeterminate onCheckedChange={change} />);
  const input = screen.getByRole('checkbox') as HTMLInputElement;
  expect(ref.current).toBe(input);
  expect(input.indeterminate).toBe(true);
  expect(input.getAttribute('aria-checked')).toBe('mixed');
  expect(input.parentElement?.querySelector('svg')).toBeTruthy();
  fireEvent.click(input);
  expect(change).toHaveBeenCalledExactlyOnceWith(true);
  view.rerender(<Checkbox ref={ref} aria-label="Permissions" checked indeterminate={false} onCheckedChange={change} />);
  expect(input.checked).toBe(true);
  expect(input.indeterminate).toBe(false);
  expect(input.getAttribute('aria-checked')).toBe('true');
  view.unmount(); expect(ref.current).toBeNull();
});

it('retains uncontrolled and disabled behavior when no mixed state is requested', () => {
  const change = vi.fn();
  const view = render(<Checkbox aria-label="Existing checkbox" defaultChecked onCheckedChange={change} />);
  const input = screen.getByRole('checkbox') as HTMLInputElement;
  expect(input.checked).toBe(true); expect(input.indeterminate).toBe(false);
  fireEvent.click(input); expect(input.checked).toBe(false);
  expect(change).toHaveBeenCalledExactlyOnceWith(false);
  view.rerender(<Checkbox aria-label="Existing checkbox" disabled onCheckedChange={change} />);
  fireEvent.click(input); expect(change).toHaveBeenCalledTimes(1);
});
