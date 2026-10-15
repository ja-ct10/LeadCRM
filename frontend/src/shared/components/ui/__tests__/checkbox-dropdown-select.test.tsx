import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CheckboxDropdownSelect } from '../checkbox-dropdown-select';

afterEach(cleanup);
const options = [{ value: 'it', label: 'IT' }, { value: 'sales', label: 'Sales' }, { value: 'operations', label: 'Operations' }];
const props = { options, placeholder: 'Select groups...', ariaLabel: 'Groups' };

it('uses controlled values, summarizes selections and retains multiple choices after reopening', () => {
  const change = vi.fn();
  function Form() {
    const [values, setValues] = useState<string[]>([]);
    return <CheckboxDropdownSelect {...props} values={values} onChange={next => { change(next); setValues(next); }} />;
  }
  render(<Form />);
  const trigger = screen.getByRole('button', { name: 'Groups' });
  expect(trigger.textContent).toBe('Select groups...');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Sales' }));
  expect(trigger.textContent).toBe('Sales');
  fireEvent.click(screen.getByRole('checkbox', { name: 'IT' }));
  expect(trigger.textContent).toBe('2 selected');
  expect(change).toHaveBeenLastCalledWith(['sales', 'it']);
  fireEvent.keyDown(screen.getByRole('checkbox', { name: 'IT' }), { key: 'Escape' });
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  expect(screen.getByRole('checkbox', { name: 'Sales' })).toHaveProperty('checked', true);
  expect(screen.getByRole('checkbox', { name: 'IT' })).toHaveProperty('checked', true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'IT' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Sales' }));
  expect(trigger.textContent).toBe('Select groups...');
  expect(change).toHaveBeenLastCalledWith([]);
});

it('retains checkbox keyboard navigation and outside dismissal', () => {
  render(<CheckboxDropdownSelect {...props} values={[]} onChange={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Groups' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const first = screen.getByRole('checkbox', { name: 'IT' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'ArrowDown' });
  const middle = screen.getByRole('checkbox', { name: 'Sales' });
  expect(document.activeElement).toBe(middle);
  fireEvent.keyDown(middle, { key: 'End' });
  const last = screen.getByRole('checkbox', { name: 'Operations' });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'ArrowUp' });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: 'Home' });
  expect(document.activeElement).toBe(first);
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('shows caller-provided empty text and keeps disabled triggers closed', () => {
  const change = vi.fn();
  const { rerender } = render(<CheckboxDropdownSelect {...props} options={[]} values={[]} onChange={change} emptyMessage="No groups have been created." />);
  fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
  expect(screen.getByText('No groups have been created.')).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  fireEvent.keyDown(document, { key: 'Escape' });
  rerender(<CheckboxDropdownSelect {...props} values={[]} onChange={change} disabled />);
  const trigger = screen.getByRole('button', { name: 'Groups' });
  expect(trigger).toHaveProperty('disabled', true);
  fireEvent.click(trigger);
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(change).not.toHaveBeenCalled();
});
