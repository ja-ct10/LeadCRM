import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProductInterest } from '@leadcrm/shared';
vi.mock('@/shared/hooks/use-product-interests', () => ({ useProductInterests: () => ({ products: [], loading: false, error: '' }) }));
import { ProductInterestSelect } from '../product-interest-select';

afterEach(cleanup);
const products = [{ id: 'a', name: 'Network', dealValue: 25 }, { id: 'b', name: 'CCTV', dealValue: 40 }] as ProductInterest[];
it.each(['id', 'name'] as const)('keeps multiple %s selections checked after Escape and reopening', mode => {
  const change = vi.fn();
  function Form() {
    const [values, setValues] = useState<string[]>([]);
    return <ProductInterestSelect products={products} values={values} valueMode={mode} onChange={next => { change(next); setValues(next); }} />;
  }
  render(<Form />);
  const trigger = screen.getByRole('button', { name: 'Product Interest' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Network' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'CCTV' }));
  expect(change).toHaveBeenLastCalledWith(mode === 'id' ? ['a', 'b'] : ['Network', 'CCTV']);
  fireEvent.keyDown(screen.getByRole('checkbox', { name: 'CCTV' }), { key: 'Escape' });
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(trigger.textContent).toContain('2 selected');
  expect(screen.queryByText('Network')).toBeNull();
  expect(screen.queryByText('CCTV')).toBeNull();
  fireEvent.click(trigger);
  expect((screen.getByRole('checkbox', { name: 'Network' }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('checkbox', { name: 'CCTV' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Network' }));
  expect(change).toHaveBeenLastCalledWith([mode === 'id' ? 'b' : 'CCTV']);
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('checkbox')).toBeNull();
});

it('supports arrow-key focus and preserves unavailable historical selections', () => {
  render(<ProductInterestSelect products={products} values={['old']} labels={{ old: 'Historical product' }} onChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Product Interest' }));
  const first = screen.getByRole('checkbox', { name: 'Network' });
  first.focus(); fireEvent.keyDown(first, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'CCTV' }));
  expect((screen.getByRole('checkbox', { name: 'Historical product' }) as HTMLInputElement).checked).toBe(true);
});

it('preserves the single-product radio selector and existing trigger accessibility', () => {
  const change = vi.fn();
  function Form() {
    const [values, setValues] = useState(['a']);
    return <ProductInterestSelect id="deal-product" ariaLabel="Deal product" products={products} values={values} single onChange={next => { change(next); setValues(next); }} />;
  }
  render(<Form />);
  const trigger = screen.getByRole('button', { name: 'Deal product' });
  expect(trigger.id).toBe('deal-product');
  expect(trigger.textContent).toBe('Network');
  fireEvent.click(trigger);
  expect(screen.getByRole('group', { name: 'Product interests' })).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'CCTV' }));
  expect(change).toHaveBeenLastCalledWith(['b']);
  expect(screen.getByRole('radio', { name: 'Network' })).toHaveProperty('checked', false);
  expect(screen.getByRole('radio', { name: 'CCTV' })).toHaveProperty('checked', true);
  expect(trigger.textContent).toBe('CCTV');
});

it.each([
  ['id', 'Unavailable product'],
  ['name', 'Retired product'],
] as const)('retains the %s-mode historical fallback without a supplied label', (mode, label) => {
  render(<ProductInterestSelect products={[]} values={['Retired product']} valueMode={mode} onChange={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Product Interest' });
  expect(trigger.textContent).toBe(label);
  fireEvent.click(trigger);
  expect(screen.getByRole('checkbox', { name: label })).toHaveProperty('checked', true);
});

it('retains the Product Interest placeholder, empty message and disabled state', () => {
  const { rerender } = render(<ProductInterestSelect products={[]} values={[]} onChange={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Product Interest' });
  expect(trigger.textContent).toBe('Select product interests…');
  fireEvent.click(trigger);
  expect(screen.getByText('No configured Product Interests.')).toBeTruthy();
  fireEvent.keyDown(document, { key: 'Escape' });
  rerender(<ProductInterestSelect products={products} values={[]} onChange={vi.fn()} disabled />);
  expect(trigger).toHaveProperty('disabled', true);
  fireEvent.click(trigger);
  expect(screen.queryByRole('checkbox')).toBeNull();
});

it('filters by category while retaining previously selected products', () => {
  render(<ProductInterestSelect products={[{ ...products[0], category: 'Services' }, products[1]]} values={['a']} onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Product Interest' }));
  fireEvent.change(screen.getByLabelText('Product category'), { target: { value: '__uncategorized' } });
  expect(screen.getByRole('checkbox', { name: 'Network' })).toHaveProperty('checked', true);
  expect(screen.getByRole('checkbox', { name: 'CCTV' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Product category'), { target: { value: 'Services' } });
  expect(screen.queryByRole('checkbox', { name: 'CCTV' })).toBeNull();
});

it.each(['id', 'name'] as const)('hides the special category in CRM %s mode without losing legacy products or new catalog categories', mode => {
  const records = [{ ...products[0], category: 'Services' }, products[1]];
  const value = mode === 'id' ? 'b' : 'CCTV';
  const change = vi.fn();
  const { rerender } = render(<ProductInterestSelect products={records} categories={['Services', 'New category']} showUncategorized={false} values={[value]} valueMode={mode} onChange={change} />);
  expect(screen.queryByRole('option', { name: 'Uncategorized' })).toBeNull();
  expect(screen.getByRole('option', { name: 'All categories' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'New category' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Product Interest' }));
  expect(screen.getByRole('checkbox', { name: 'CCTV' })).toHaveProperty('checked', true);
  fireEvent.change(screen.getByLabelText('Product category'), { target: { value: 'New category' } });
  expect(screen.queryByRole('checkbox', { name: 'Network' })).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'CCTV' })).toHaveProperty('checked', true);
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Product category'), { target: { value: '' } });
  expect(screen.getByRole('checkbox', { name: 'Network' })).toBeTruthy();
  rerender(<ProductInterestSelect products={records} categories={['Services', 'New category', 'Added later']} showUncategorized={false} values={[value]} valueMode={mode} onChange={change} />);
  expect(screen.getByRole('option', { name: 'Added later' })).toBeTruthy();
});

it('filters the checkbox list without dropping hidden selections when checking or unchecking products', () => {
  const change = vi.fn();
  function Form() {
    const [values, setValues] = useState<string[]>([]);
    return <ProductInterestSelect presentation="checkbox-list" showUncategorized={false} products={[{ ...products[0], category: 'Network' }, { ...products[1], category: 'Security' }]} categories={['Security', 'Empty', 'Network']} values={values} onChange={next => { change(next); setValues(next); }} />;
  }
  render(<Form />);
  const category = screen.getByLabelText('Product category');
  expect(category).toHaveProperty('value', '');
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['All categories', 'Empty', 'Network', 'Security']);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Network' }));
  fireEvent.change(category, { target: { value: 'Security' } });
  expect(screen.queryByRole('checkbox', { name: 'Network' })).toBeNull();
  expect(change).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('checkbox', { name: 'CCTV' }));
  expect(change).toHaveBeenLastCalledWith(['a', 'b']);
  fireEvent.click(screen.getByRole('checkbox', { name: 'CCTV' }));
  expect(change).toHaveBeenLastCalledWith(['a']);
  fireEvent.change(category, { target: { value: 'Empty' } });
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.getByText('No products match this category.')).toBeTruthy();
  fireEvent.change(category, { target: { value: '' } });
  expect(screen.getByRole('checkbox', { name: 'Network' })).toHaveProperty('checked', true);
  expect(screen.getByRole('checkbox', { name: 'CCTV' })).toHaveProperty('checked', false);
});

it('refreshes inline category options and keeps uncategorized products available under All categories', () => {
  const { rerender } = render(<ProductInterestSelect presentation="checkbox-list" showUncategorized={false} products={products} categories={[]} values={['b']} onChange={vi.fn()} />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  expect(screen.queryByRole('option', { name: 'Uncategorized' })).toBeNull();
  rerender(<ProductInterestSelect presentation="checkbox-list" showUncategorized={false} products={products} categories={['Added later']} values={['b']} onChange={vi.fn()} />);
  expect(screen.getByRole('option', { name: 'Added later' })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'CCTV' })).toHaveProperty('checked', true);
});
